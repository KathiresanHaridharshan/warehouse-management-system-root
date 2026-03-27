import { db, storage } from '../firebase';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const materialsRef = collection(db, 'materials');
const historyRef = collection(db, 'transactions');

async function logTransaction(tx) {
  await addDoc(historyRef, { ...tx, timestamp: new Date().toISOString() });
}

export async function fetchMaterials(search = '') {
  const snapshot = await getDocs(materialsRef);
  const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort by order field if present, fallback to itemName
  materials.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    return (a.itemName || '').localeCompare(b.itemName || '');
  });

  if (search) {
    const lower = search.toLowerCase();
    const filtered = materials.filter(m => 
      (m.itemName || '').toLowerCase().includes(lower) || 
      (m.itemCode || '').toLowerCase().includes(lower) ||
      (m.supplier || '').toLowerCase().includes(lower)
    );
    return filtered.map(m => ({ ...m, isLowStock: m.quantity <= 10 }));
  }
  return materials.map(m => ({ ...m, isLowStock: m.quantity <= 10 }));
}

export async function fetchMaterial(id) {
  const docRef = doc(db, 'materials', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Material not found');
  const material = { id: docSnap.id, ...docSnap.data() };
  return { ...material, isLowStock: material.quantity <= 10 };
}

export async function createMaterial(material) {
  const snapshot = await getDocs(materialsRef);
  const materials = snapshot.docs.map(d => d.data());
  const existing = materials.find(m => m.itemCode === (material.itemCode || '').trim());
  if (existing) throw new Error(`Item code "${material.itemCode}" already exists`);

  const qty = parseInt(material.quantity) || 0;
  
  const newMaterial = {
    itemCode: (material.itemCode || '').trim(),
    itemName: (material.itemName || '').trim(),
    supplier: (material.supplier || '').trim(),
    location: (material.location || '').trim(),
    colorHex: material.colorHex || '#cccccc',
    imageURL: material.imageURL || '',
    quantity: qty,
    description: (material.description || '').trim(),
    createdAt: serverTimestamp()
  };
  
  const docRef = await addDoc(materialsRef, newMaterial);

  await logTransaction({
    materialId: docRef.id,
    itemName: newMaterial.itemName,
    type: 'ADD',
    quantityChange: qty,
    newQuantity: qty
  });

  return { id: docRef.id, ...newMaterial, isLowStock: newMaterial.quantity <= 10 };
}

export async function updateMaterial(id, updates) {
  const docRef = doc(db, 'materials', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Material not found');
  const oldMaterial = docSnap.data();

  if (updates.itemCode) {
    const snapshot = await getDocs(materialsRef);
    const existing = snapshot.docs.find(d => d.id !== id && d.data().itemCode === updates.itemCode.trim());
    if (existing) {
      throw new Error(`Item code "${updates.itemCode}" already exists`);
    }
  }

  const updatedMaterial = { ...oldMaterial, ...updates };

  if (updates.quantity !== undefined && updates.quantity !== oldMaterial.quantity) {
    const qty = parseInt(updates.quantity) || 0;
    updatedMaterial.quantity = qty;
    const delta = qty - oldMaterial.quantity;
    await logTransaction({
      materialId: id,
      itemName: updatedMaterial.itemName,
      type: delta > 0 ? 'INCREASE' : 'DECREASE',
      quantityChange: delta,
      newQuantity: qty
    });
  }

  await updateDoc(docRef, updatedMaterial);
  return { id, ...updatedMaterial, isLowStock: updatedMaterial.quantity <= 10 };
}

export async function adjustQuantity(id, delta) {
  const docRef = doc(db, 'materials', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Material not found');
  const material = docSnap.data();

  const newQty = parseInt(material.quantity) + parseInt(delta);
  if (newQty < 0) throw new Error('Quantity cannot be negative');

  await updateDoc(docRef, { quantity: newQty });

  await logTransaction({
    materialId: id,
    itemName: material.itemName,
    type: parseInt(delta) > 0 ? 'INCREASE' : 'DECREASE',
    quantityChange: parseInt(delta),
    newQuantity: newQty
  });

  return { id, ...material, quantity: newQty, isLowStock: newQty <= 10 };
}

export async function deleteMaterial(id) {
  const docRef = doc(db, 'materials', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Material not found');
  const material = docSnap.data();

  await logTransaction({
    materialId: id,
    itemName: material.itemName,
    type: 'DELETE',
    quantityChange: -material.quantity,
    newQuantity: 0
  });

  await deleteDoc(docRef);
  return { id, ...material };
}

export async function uploadImage(id, file) {
  const storageRef = ref(storage, `materials/${id}_${file.name}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  
  const docRef = doc(db, 'materials', id);
  await updateDoc(docRef, { imageURL: downloadURL });
  
  return fetchMaterial(id);
}

export async function fetchHistory() {
  const q = query(historyRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function exportData() {
  const matSnap = await getDocs(materialsRef);
  const histSnap = await getDocs(historyRef);
  
  const materials = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const data = JSON.stringify({ materials, history }, null, 2);
  
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warehouse_backup_firebase_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const batch = writeBatch(db);
        
        if (data.materials) {
          data.materials.forEach(m => {
            const mRef = doc(db, 'materials', m.id ? String(m.id) : doc(materialsRef).id);
            batch.set(mRef, m);
          });
        }
        
        if (data.history) {
          data.history.forEach(h => {
            const hRef = doc(db, 'transactions', h.id ? String(h.id) : doc(historyRef).id);
            batch.set(hRef, h);
          });
        }
        
        await batch.commit();
        resolve(true);
        window.location.reload();
      } catch (err) {
        reject(new Error('Invalid backup file format or upload failed'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function reorderMaterials(fromIndex, toIndex) {
  const materials = await fetchMaterials();
  const [moved] = materials.splice(fromIndex, 1);
  materials.splice(toIndex, 0, moved);
  
  const batch = writeBatch(db);
  materials.forEach((m, index) => {
    const docRef = doc(db, 'materials', m.id);
    batch.update(docRef, { order: index });
  });
  await batch.commit();
  
  return materials;
}
