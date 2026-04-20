import * as XLSX from 'xlsx';
import { db, storage } from '../firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch, Timestamp
} from 'firebase/firestore';
import {
  ref, uploadBytes, deleteObject, getMetadata
} from 'firebase/storage';

const inventoryRef = collection(db, 'inventory');

// Sanitize material code for use as Firestore document ID
// Firestore treats '/' as path separator, so replace with '__'
function sanitizeDocId(code) {
  return code.replace(/\//g, '__');
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

        // Convert to array of arrays (each row is an array)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
          reject(new Error('Excel file is empty or has no data rows.'));
          return;
        }

        // Validate header row (row 0)
        const header = rows[0];
        if (!header || header.length < 7) {
          reject(new Error('Invalid file format: Expected at least 7 columns (A through G).'));
          return;
        }

        // Group by material code
        const materialsMap = new Map();
        let skippedRows = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) {
            skippedRows++;
            continue;
          }

          const materialCode = row[0] != null ? String(row[0]).trim() : '';
          const materialName = row[1] != null ? String(row[1]).trim() : '';
          const plant = row[3] != null ? String(row[3]).trim() : '';
          const storageLocation = row[4] != null ? String(row[4]).trim() : '';
          const quantity = parseFloat(row[5]) || 0;
          const unit = row[6] != null ? String(row[6]).trim() : '';

          // Skip rows with missing key fields
          if (!materialCode || !plant || !storageLocation) {
            skippedRows++;
            continue;
          }

          if (!materialsMap.has(materialCode)) {
            materialsMap.set(materialCode, {
              materialCode,
              materialName: materialName || '',
              stockMap: new Map()
            });
          }

          const material = materialsMap.get(materialCode);

          // Use first non-empty material name found
          if (!material.materialName && materialName) {
            material.materialName = materialName;
          }

          // Group by plant + storage location
          const stockKey = `${plant}|${storageLocation}`;
          if (!material.stockMap.has(stockKey)) {
            material.stockMap.set(stockKey, {
              plant,
              storageLocation,
              quantity: 0,
              unit: unit || ''
            });
          }

          const stockEntry = material.stockMap.get(stockKey);
          stockEntry.quantity += quantity;

          // Use first non-empty unit found
          if (!stockEntry.unit && unit) {
            stockEntry.unit = unit;
          }
        }

        // Convert to final format
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
// 2. TEST WRITE ACCESS (single doc test before bulk)
// ============================================================
async function testFirestoreAccess() {
  console.log('[Inventory] Testing write access...');
  const testRef = doc(db, 'inventory', '__write_test__');
  await setDoc(testRef, { _test: true });
  await deleteDoc(testRef);
  console.log('[Inventory] ✅ Write access OK');
}

// ============================================================
// 3. DELETE ALL EXISTING INVENTORY DOCUMENTS
// ============================================================
async function clearInventoryCollection(onProgress) {
  console.log('[Inventory] Reading existing docs...');
  const snapshot = await getDocs(inventoryRef);

  if (snapshot.empty) {
    console.log('[Inventory] Collection empty.');
    return 0;
  }

  const docs = snapshot.docs;
  console.log(`[Inventory] Deleting ${docs.length} docs...`);
  let deleted = 0;

  // Delete 10 at a time in parallel
  for (let i = 0; i < docs.length; i += 10) {
    const group = docs.slice(i, i + 10);
    await Promise.all(group.map(d => deleteDoc(d.ref)));
    deleted += group.length;
    if (onProgress) onProgress(deleted, docs.length);
  }

  console.log(`[Inventory] Deleted ${deleted} docs.`);
  return deleted;
}

// ============================================================
// 4. WRITE INVENTORY DATA (individual setDoc, not batch)
// ============================================================
async function uploadInventoryData(materials, fileName, onProgress) {
  const now = Timestamp.now();
  let written = 0;

  // Write 10 docs in parallel at a time
  for (let i = 0; i < materials.length; i += 10) {
    const group = materials.slice(i, i + 10);
    await Promise.all(group.map(mat => {
      const docId = sanitizeDocId(mat.materialCode);
      return setDoc(doc(db, 'inventory', docId), {
        materialCode: mat.materialCode,
        materialName: mat.materialName,
        lastUpdated: now,
        uploadedFileName: fileName,
        stock: mat.stock
      });
    }));
    written += group.length;
    if (onProgress) onProgress(written, materials.length);
    if (written % 50 === 0) console.log(`[Inventory] Written ${written}/${materials.length}`);
  }

  console.log(`[Inventory] ✅ Written ${written} docs.`);
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
    const { materials, stats } = await parseExcelFile(file);
    console.log(`[Inventory] Parsed: ${stats.totalMaterials} materials, ${stats.totalPlants} plants`);

    if (materials.length === 0) {
      throw new Error('No valid materials found in the file.');
    }

    // Step 2: Test permissions
    progress(2, 'Checking permissions...', 20);
    try {
      await testFirestoreAccess();
    } catch (err) {
      throw new Error(
        'Cannot write to Firestore. Go to Firebase Console → Firestore → Rules and add:\n' +
        'match /inventory/{doc=**} { allow read, write: if true; }\n\n' +
        'Error: ' + err.message
      );
    }

    // Optional: Storage upload (skip fast if not available)
    try {
      const storageRef = ref(storage, 'sap-exports/latest.xlsx');
      await Promise.race([
        uploadBytes(storageRef, file),
        new Promise((_, rej) => setTimeout(() => rej(new Error('skip')), 5000))
      ]);
    } catch {
      console.warn('[Inventory] Storage skipped');
    }

    // Step 3: Clear old data
    progress(3, 'Clearing old data...', 30);
    await clearInventoryCollection((done, total) => {
      progress(3, `Clearing... ${done}/${total}`, 30 + Math.round((done / total) * 15));
    });

    // Step 4: Write new data
    progress(4, `Writing 0/${stats.totalMaterials.toLocaleString()}...`, 50);
    await uploadInventoryData(materials, file.name, (done, total) => {
      const pct = 50 + Math.round((done / total) * 45);
      progress(4, `Writing... ${done.toLocaleString()}/${total.toLocaleString()}`, Math.min(pct, 95));
    });

    // Done!
    progress(5, 'Upload complete!', 100);
    console.log('[Inventory] ✅ ALL DONE', stats);
    return { success: true, stats };

  } catch (err) {
    console.error('[Inventory] ❌ FAILED:', err);
    throw new Error(err.message || 'Upload failed.');
  }
}

// ============================================================
// 6. FETCH INVENTORY FOR A SINGLE MATERIAL
// ============================================================
export async function fetchInventoryForMaterial(materialCode) {
  if (!materialCode) return null;

  const trimmedCode = materialCode.trim();
  const docRef = doc(db, 'inventory', sanitizeDocId(trimmedCode));
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() };
}
