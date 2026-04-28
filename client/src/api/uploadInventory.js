import * as XLSX from 'xlsx';
import { db } from '../firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc,
  writeBatch, Timestamp
} from 'firebase/firestore';

const INVENTORY_COLLECTION = 'inventory';

// Firestore batch limit is 500 — use 499 for safety margin
const BATCH_SIZE = 499;

// How many batches to run concurrently (keeps speed high without hitting rate limits)
const PARALLEL_BATCHES = 3;

// Sanitize material code for Firestore doc ID
function sanitizeDocId(code) {
  let id = code.replace(/\//g, '_').replace(/\.\./g, '_');
  id = id.replace(/^\.+|\.+$/g, '');
  if (!id) id = 'unknown_' + Math.random().toString(36).slice(2, 8);
  return id;
}

// Split an array into chunks of a given size
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
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
// 2. CLEAR OLD INVENTORY (batched deletes — up to 500 per batch)
// ============================================================
async function clearInventory(onProgress) {
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const snapshot = await getDocs(inventoryRef);

  if (snapshot.empty) return 0;

  const docs = snapshot.docs;
  const chunks = chunkArray(docs, BATCH_SIZE);
  let deleted = 0;

  // Process delete batches with controlled parallelism
  for (let i = 0; i < chunks.length; i += PARALLEL_BATCHES) {
    const batchGroup = chunks.slice(i, i + PARALLEL_BATCHES);

    await Promise.all(
      batchGroup.map((chunk) => {
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        return batch.commit();
      })
    );

    deleted += batchGroup.reduce((sum, chunk) => sum + chunk.length, 0);
    if (onProgress) onProgress(deleted, docs.length);
  }

  return deleted;
}

// ============================================================
// 3. WRITE INVENTORY DATA (batched writes — up to 500 per batch)
// ============================================================
async function writeInventory(materials, fileName, onProgress) {
  const now = Timestamp.now();
  const chunks = chunkArray(materials, BATCH_SIZE);
  let written = 0;

  // Process write batches with controlled parallelism
  for (let i = 0; i < chunks.length; i += PARALLEL_BATCHES) {
    const batchGroup = chunks.slice(i, i + PARALLEL_BATCHES);

    await Promise.all(
      batchGroup.map((chunk) => {
        const batch = writeBatch(db);
        chunk.forEach((mat) => {
          const docId = sanitizeDocId(mat.materialCode);
          batch.set(doc(db, INVENTORY_COLLECTION, docId), {
            materialCode: mat.materialCode,
            materialName: mat.materialName,
            lastUpdated: now,
            uploadedFileName: fileName,
            stock: mat.stock
          });
        });
        return batch.commit();
      })
    );

    written += batchGroup.reduce((sum, chunk) => sum + chunk.length, 0);
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

  const startTime = Date.now();

  try {
    // Step 1: Parse
    progress(1, 'Parsing Excel file...', 10);
    const { materials, stats } = await parseExcelFile(file);

    if (materials.length === 0) {
      throw new Error('No valid materials found in the file.');
    }

    progress(1, `Parsed ${stats.totalMaterials.toLocaleString()} materials from ${stats.totalRows.toLocaleString()} rows`, 15);

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

    // Step 3: Clear old data (batched)
    progress(3, 'Clearing old data...', 25);
    await clearInventory((done, total) => {
      const pct = 25 + Math.round((done / total) * 20);
      progress(3, `Clearing... ${done.toLocaleString()}/${total.toLocaleString()}`, pct);
    });

    // Step 4: Write new data (batched with parallelism)
    progress(4, `Writing 0/${stats.totalMaterials.toLocaleString()}...`, 50);
    await writeInventory(materials, file.name, (done, total) => {
      const pct = 50 + Math.round((done / total) * 45);
      progress(4, `Writing... ${done.toLocaleString()}/${total.toLocaleString()}`, Math.min(pct, 95));
    });

    // Done — invalidate cache so next read gets fresh data
    invalidateInventoryCache();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    progress(5, `Upload complete in ${elapsed}s!`, 100);
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
// 5. INVENTORY CACHE — fetch ALL inventory in 1 read, cache for 5 min
// ============================================================
let _inventoryCache = null;
let _inventoryCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the entire inventory collection in a SINGLE Firestore read.
 * Returns a Map keyed by materialCode → inventory doc data.
 * Cached in memory for 5 minutes to avoid repeated reads on refresh.
 */
export async function fetchAllInventory(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _inventoryCache && (now - _inventoryCacheTime < CACHE_TTL_MS)) {
    return _inventoryCache;
  }

  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const snapshot = await getDocs(inventoryRef);

  const map = new Map();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.materialCode) {
      map.set(data.materialCode, { id: docSnap.id, ...data });
    }
  });

  _inventoryCache = map;
  _inventoryCacheTime = now;
  return map;
}

/** Invalidate the inventory cache (call after a new SAP upload) */
export function invalidateInventoryCache() {
  _inventoryCache = null;
  _inventoryCacheTime = 0;
}

/**
 * Fetch inventory for a single material — uses the cache.
 * No extra Firestore reads if cache is warm.
 */
export async function fetchInventoryForMaterial(materialCode) {
  if (!materialCode) return null;
  const trimmedCode = materialCode.trim();

  const cache = await fetchAllInventory();
  return cache.get(trimmedCode) || null;
}
