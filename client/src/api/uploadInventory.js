import * as XLSX from 'xlsx';
import { db } from '../firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, Timestamp
} from 'firebase/firestore';

const INVENTORY_COLLECTION = 'inventory';

// Sanitize material code for Firestore doc ID
function sanitizeDocId(code) {
  let id = code.replace(/\//g, '_').replace(/\.\./g, '_');
  id = id.replace(/^\.+|\.+$/g, '');
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
// 2. CLEAR OLD INVENTORY (only if needed)
// ============================================================
async function clearInventory(onProgress) {
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const snapshot = await getDocs(inventoryRef);

  if (snapshot.empty) return 0;

  const docs = snapshot.docs;
  let deleted = 0;

  // Delete one at a time to avoid quota spikes
  for (const docSnap of docs) {
    await deleteDoc(docSnap.ref);
    deleted++;
    if (onProgress) onProgress(deleted, docs.length);
  }

  return deleted;
}

// ============================================================
// 3. WRITE INVENTORY DATA (one at a time to respect quota)
// ============================================================
async function writeInventory(materials, fileName, onProgress) {
  const now = Timestamp.now();
  let written = 0;

  for (const mat of materials) {
    const docId = sanitizeDocId(mat.materialCode);
    await setDoc(doc(db, INVENTORY_COLLECTION, docId), {
      materialCode: mat.materialCode,
      materialName: mat.materialName,
      lastUpdated: now,
      uploadedFileName: fileName,
      stock: mat.stock
    });
    written++;
    if (onProgress) onProgress(written, materials.length);
  }

  return written;
}

// ============================================================
// 4. MAIN ORCHESTRATOR
// ============================================================
export async function processAndUploadInventory(file, onProgress) {
  const progress = (step, message, pct) => {
    if (onProgress) onProgress({ step, message, percentage: pct });
  };

  try {
    // Step 1: Parse
    progress(1, 'Parsing Excel file...', 10);
    const { materials, stats } = await parseExcelFile(file);

    if (materials.length === 0) {
      throw new Error('No valid materials found in the file.');
    }

    // Step 2: Test write access with a single doc
    progress(2, 'Checking access...', 20);
    try {
      const testRef = doc(db, INVENTORY_COLLECTION, 'zz_test');
      await Promise.race([
        setDoc(testRef, { _t: true }).then(() => deleteDoc(testRef)),
        new Promise((_, r) => setTimeout(() => r(new Error(
          'Firestore write timed out. Check rules: match /{document=**} { allow read, write: if true; }'
        )), 10000))
      ]);
    } catch (err) {
      if (err.code === 'resource-exhausted') {
        throw new Error(
          'Firestore daily quota exceeded (free plan limit). ' +
          'Please wait until tomorrow or upgrade to Blaze plan in Firebase Console.'
        );
      }
      throw err;
    }

    // Step 3: Clear old data
    progress(3, 'Clearing old data...', 30);
    await clearInventory((done, total) => {
      progress(3, `Clearing... ${done}/${total}`, 30 + Math.round((done / total) * 15));
    });

    // Step 4: Write new data
    progress(4, `Writing 0/${stats.totalMaterials}...`, 50);
    await writeInventory(materials, file.name, (done, total) => {
      const pct = 50 + Math.round((done / total) * 45);
      progress(4, `Writing... ${done}/${total}`, Math.min(pct, 95));
    });

    // Done!
    progress(5, 'Upload complete!', 100);
    return { success: true, stats };

  } catch (err) {
    // Check for quota error
    if (err.code === 'resource-exhausted' || (err.message && err.message.includes('Quota'))) {
      throw new Error(
        'Firestore daily quota exceeded. Wait until tomorrow or upgrade to Blaze plan in Firebase Console.'
      );
    }
    throw new Error(err.message || 'Upload failed.');
  }
}

// ============================================================
// 5. FETCH INVENTORY FOR A SINGLE MATERIAL
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
