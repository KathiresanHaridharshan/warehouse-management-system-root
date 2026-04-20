import * as XLSX from 'xlsx';
import { db, storage } from '../firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch, Timestamp
} from 'firebase/firestore';
import {
  ref, uploadBytes, deleteObject, getMetadata
} from 'firebase/storage';

const inventoryRef = collection(db, 'inventory');
const BATCH_LIMIT = 500;

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
// 2. DELETE ALL EXISTING INVENTORY DOCUMENTS
// ============================================================
async function clearInventoryCollection(onBatchDone) {
  const snapshot = await getDocs(inventoryRef);

  if (snapshot.empty) return 0;

  const docs = snapshot.docs;
  let deletedCount = 0;
  const CONCURRENT = 5; // Run 5 batch deletes in parallel

  // Create all batch chunks
  const chunks = [];
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    chunks.push(docs.slice(i, i + BATCH_LIMIT));
  }

  // Process chunks in parallel groups
  for (let i = 0; i < chunks.length; i += CONCURRENT) {
    const group = chunks.slice(i, i + CONCURRENT);
    await Promise.all(group.map(async (chunk) => {
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
      deletedCount += chunk.length;
      if (onBatchDone) onBatchDone(deletedCount, docs.length);
    }));
  }

  return deletedCount;
}

// ============================================================
// 3. UPLOAD PARSED DATA TO FIRESTORE
// ============================================================
async function uploadInventoryData(parsedMaterials, fileName, onBatchDone) {
  const now = Timestamp.now();
  let writtenCount = 0;
  const CONCURRENT = 5; // Run 5 batch writes in parallel

  // Create all batch chunks
  const chunks = [];
  for (let i = 0; i < parsedMaterials.length; i += BATCH_LIMIT) {
    chunks.push(parsedMaterials.slice(i, i + BATCH_LIMIT));
  }

  // Process chunks in parallel groups
  for (let i = 0; i < chunks.length; i += CONCURRENT) {
    const group = chunks.slice(i, i + CONCURRENT);
    await Promise.all(group.map(async (chunk) => {
      const batch = writeBatch(db);
      chunk.forEach((mat) => {
        const docRef = doc(db, 'inventory', sanitizeDocId(mat.materialCode));
        batch.set(docRef, {
          materialCode: mat.materialCode,
          materialName: mat.materialName,
          lastUpdated: now,
          uploadedFileName: fileName,
          stock: mat.stock
        });
      });
      await batch.commit();
      writtenCount += chunk.length;
      if (onBatchDone) onBatchDone(writtenCount, parsedMaterials.length);
    }));
  }

  return writtenCount;
}

// ============================================================
// 4. UPLOAD RAW EXCEL TO FIREBASE STORAGE
// ============================================================
async function uploadExcelToStorage(file) {
  const storageRef = ref(storage, 'sap-exports/latest.xlsx');

  // Try to delete existing file first
  try {
    await getMetadata(storageRef);
    await deleteObject(storageRef);
  } catch {
    // File doesn't exist — that's fine
  }

  await uploadBytes(storageRef, file);
}

// Helper: wrap a promise with a timeout
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. Check Firebase rules and network connection.`)), ms)
    )
  ]);
}

// ============================================================
// 5. MAIN ORCHESTRATOR
// ============================================================
export async function processAndUploadInventory(file, onProgress) {
  const progress = (step, message, pct) => {
    if (onProgress) onProgress({ step, message, percentage: pct });
  };

  try {
    // Step 1: Parse (client-side only)
    progress(1, 'Parsing Excel file...', 10);
    const { materials, stats } = await parseExcelFile(file);

    if (materials.length === 0) {
      throw new Error('No valid materials found in the file.');
    }

    // Step 2: Upload raw file to Storage (optional — skips fast if Storage not activated)
    progress(2, 'Uploading file to storage...', 20);
    try {
      await withTimeout(uploadExcelToStorage(file), 5000, 'Storage upload');
    } catch (storageErr) {
      console.warn('Storage upload skipped:', storageErr.message);
    }

    // Step 3: Clear existing data (no timeout — let it finish)
    progress(3, 'Clearing previous inventory data...', 30);
    await clearInventoryCollection((deleted, total) => {
      const pct = 30 + Math.round((deleted / total) * 20);
      progress(3, `Clearing old data... ${deleted.toLocaleString()}/${total.toLocaleString()}`, pct);
    });

    // Step 4: Write new data (no timeout — with live progress)
    progress(4, `Writing ${stats.totalMaterials.toLocaleString()} materials...`, 50);
    await uploadInventoryData(materials, file.name, (written, total) => {
      const pct = 50 + Math.round((written / total) * 45);
      progress(4, `Writing materials... ${written.toLocaleString()}/${total.toLocaleString()}`, Math.min(pct, 95));
    });

    // Done
    progress(5, 'Upload complete!', 100);

    return {
      success: true,
      stats
    };
  } catch (err) {
    console.error('Inventory upload failed:', err);
    throw new Error(err.message || 'Upload failed. Please check Firebase permissions and try again.');
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
