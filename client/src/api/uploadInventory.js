import * as XLSX from 'xlsx';
import { db, storage } from '../firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, Timestamp
} from 'firebase/firestore';
import {
  ref, uploadBytes, deleteObject, getMetadata
} from 'firebase/storage';

const INVENTORY_COLLECTION = 'inventory';

// Sanitize material code for Firestore doc ID
// Firestore can't handle '/' in doc IDs (path separator)
// Also avoid leading/trailing dots and reserved __*__ patterns
function sanitizeDocId(code) {
  let id = code.replace(/\//g, '_').replace(/\.\./g, '_');
  // Remove leading/trailing dots
  id = id.replace(/^\.+|\.+$/g, '');
  // If empty after sanitizing, use a hash
  if (!id) id = 'unknown_' + Math.random().toString(36).slice(2, 8);
  return id;
}

// ============================================================
// 1. PARSE THE EXCEL FILE
// ============================================================
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
          reject(new Error('Excel file is empty or has no data rows.'));
          return;
        }

        const header = rows[0];
        if (!header || header.length < 7) {
          reject(new Error('Invalid file format: Expected at least 7 columns (A through G).'));
          return;
        }

        const materialsMap = new Map();
        let skippedRows = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) { skippedRows++; continue; }

          const materialCode = row[0] != null ? String(row[0]).trim() : '';
          const materialName = row[1] != null ? String(row[1]).trim() : '';
          const plant = row[3] != null ? String(row[3]).trim() : '';
          const storageLocation = row[4] != null ? String(row[4]).trim() : '';
          const quantity = parseFloat(row[5]) || 0;
          const unit = row[6] != null ? String(row[6]).trim() : '';

          if (!materialCode || !plant || !storageLocation) { skippedRows++; continue; }

          if (!materialsMap.has(materialCode)) {
            materialsMap.set(materialCode, {
              materialCode,
              materialName: materialName || '',
              stockMap: new Map()
            });
          }

          const material = materialsMap.get(materialCode);
          if (!material.materialName && materialName) material.materialName = materialName;

          const stockKey = `${plant}|${storageLocation}`;
          if (!material.stockMap.has(stockKey)) {
            material.stockMap.set(stockKey, { plant, storageLocation, quantity: 0, unit: unit || '' });
          }

          const stockEntry = material.stockMap.get(stockKey);
          stockEntry.quantity += quantity;
          if (!stockEntry.unit && unit) stockEntry.unit = unit;
        }

        const parsedMaterials = [];
        const plantsSet = new Set();

        materialsMap.forEach((mat) => {
          const stockArray = [];
          mat.stockMap.forEach((entry) => {
            stockArray.push({
              plant: entry.plant,
              storageLocation: entry.storageLocation,
              quantity: entry.quantity,
              unit: entry.unit
            });
            plantsSet.add(entry.plant);
          });
          parsedMaterials.push({
            materialCode: mat.materialCode,
            materialName: mat.materialName,
            stock: stockArray
          });
        });

        resolve({
          materials: parsedMaterials,
          stats: {
            totalMaterials: parsedMaterials.length,
            totalPlants: plantsSet.size,
            totalRows: rows.length - 1,
            skippedRows
          }
        });
      } catch (err) {
        reject(new Error('Failed to parse Excel file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// 2. PERMISSION CHECK — write to 'materials' (known working)
//    then try 'inventory' to compare behavior
// ============================================================
async function checkPermissions() {
  // Test 1: Write to 'materials' collection (known to work)
  console.log('[INV] Testing write to materials collection...');
  const matTestRef = doc(db, 'materials', 'zz_permission_test');
  const matTimeout = raceTimeout(setDoc(matTestRef, { _test: true }), 8000);
  
  try {
    await matTimeout;
    await deleteDoc(matTestRef);
    console.log('[INV] ✅ materials collection write OK');
  } catch (err) {
    console.error('[INV] ❌ Even materials collection failed:', err.message);
    throw new Error('Firestore connection issue. Check your network and Firebase project.');
  }

  // Test 2: Write to 'inventory' collection
  console.log('[INV] Testing write to inventory collection...');
  const invTestRef = doc(db, INVENTORY_COLLECTION, 'zz_permission_test');
  const invTimeout = raceTimeout(setDoc(invTestRef, { _test: true }), 8000);
  
  try {
    await invTimeout;
    await deleteDoc(invTestRef);
    console.log('[INV] ✅ inventory collection write OK');
  } catch (err) {
    console.error('[INV] ❌ inventory collection BLOCKED:', err.message);
    throw new Error(
      'Cannot write to "inventory" collection but CAN write to "materials". ' +
      'Your Firestore rules are missing the inventory collection. ' +
      'Set rules to: match /{document=**} { allow read, write: if true; }'
    );
  }
}

function raceTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms))
  ]);
}

// ============================================================
// 3. DELETE ALL EXISTING INVENTORY DOCUMENTS
// ============================================================
async function clearInventory(onProgress) {
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  console.log('[INV] Reading existing inventory docs...');
  const snapshot = await getDocs(inventoryRef);

  if (snapshot.empty) {
    console.log('[INV] Collection empty, nothing to clear.');
    return 0;
  }

  const docs = snapshot.docs;
  console.log(`[INV] Deleting ${docs.length} docs...`);
  let deleted = 0;

  for (let i = 0; i < docs.length; i += 10) {
    const group = docs.slice(i, i + 10);
    await Promise.all(group.map(d => deleteDoc(d.ref)));
    deleted += group.length;
    if (onProgress) onProgress(deleted, docs.length);
  }

  console.log(`[INV] Deleted ${deleted} docs.`);
  return deleted;
}

// ============================================================
// 4. WRITE INVENTORY DATA (individual setDoc calls)
// ============================================================
async function writeInventory(materials, fileName, onProgress) {
  const now = Timestamp.now();
  let written = 0;

  for (let i = 0; i < materials.length; i += 10) {
    const group = materials.slice(i, i + 10);
    await Promise.all(group.map(mat => {
      const docId = sanitizeDocId(mat.materialCode);
      return setDoc(doc(db, INVENTORY_COLLECTION, docId), {
        materialCode: mat.materialCode,
        materialName: mat.materialName,
        lastUpdated: now,
        uploadedFileName: fileName,
        stock: mat.stock
      });
    }));
    written += group.length;
    if (onProgress) onProgress(written, materials.length);
    if (written % 100 === 0 || written === materials.length) {
      console.log(`[INV] Written ${written}/${materials.length}`);
    }
  }

  return written;
}

// ============================================================
// 5. MAIN ORCHESTRATOR
// ============================================================
export async function processAndUploadInventory(file, onProgress) {
  const progress = (step, message, pct) => {
    if (onProgress) onProgress({ step, message, percentage: pct });
  };

  try {
    // Step 1: Parse
    progress(1, 'Parsing Excel file...', 10);
    console.log('[INV] === STEP 1: Parsing ===');
    const { materials, stats } = await parseExcelFile(file);
    console.log(`[INV] Parsed ${stats.totalMaterials} materials from ${stats.totalRows} rows`);

    if (materials.length === 0) {
      throw new Error('No valid materials found in the file.');
    }

    // Step 2: Check permissions
    progress(2, 'Checking Firestore access...', 20);
    console.log('[INV] === STEP 2: Permission check ===');
    await checkPermissions();

    // Optional: Storage upload
    try {
      const storageRef = ref(storage, 'sap-exports/latest.xlsx');
      await raceTimeout(uploadBytes(storageRef, file), 5000);
      console.log('[INV] Storage upload done');
    } catch {
      console.warn('[INV] Storage skipped (not activated or timed out)');
    }

    // Step 3: Clear old data
    progress(3, 'Clearing old data...', 30);
    console.log('[INV] === STEP 3: Clearing ===');
    await clearInventory((done, total) => {
      progress(3, `Clearing... ${done}/${total}`, 30 + Math.round((done / total) * 15));
    });

    // Step 4: Write new data
    progress(4, `Writing 0/${stats.totalMaterials.toLocaleString()}...`, 50);
    console.log('[INV] === STEP 4: Writing ===');
    await writeInventory(materials, file.name, (done, total) => {
      const pct = 50 + Math.round((done / total) * 45);
      progress(4, `Writing... ${done.toLocaleString()}/${total.toLocaleString()}`, Math.min(pct, 95));
    });

    // Done!
    progress(5, 'Upload complete!', 100);
    console.log('[INV] ✅ ALL DONE!', stats);
    return { success: true, stats };

  } catch (err) {
    console.error('[INV] ❌ FAILED:', err);
    throw new Error(err.message || 'Upload failed.');
  }
}

// ============================================================
// 6. FETCH INVENTORY FOR A SINGLE MATERIAL
// ============================================================
export async function fetchInventoryForMaterial(materialCode) {
  if (!materialCode) return null;

  const trimmedCode = materialCode.trim();
  const docId = sanitizeDocId(trimmedCode);
  const docRef = doc(db, INVENTORY_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}
