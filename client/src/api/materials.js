const BASE_URL = '/api/materials';

export async function fetchMaterials(search = '') {
  const url = search ? `${BASE_URL}?search=${encodeURIComponent(search)}` : BASE_URL;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function fetchMaterial(id) {
  const res = await fetch(`${BASE_URL}/${id}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function createMaterial(material) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function updateMaterial(id, material) {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function adjustQuantity(id, delta) {
  const res = await fetch(`${BASE_URL}/${id}/quantity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function deleteMaterial(id) {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function uploadImage(id, file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE_URL}/${id}/image`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function fetchHistory() {
  const res = await fetch(`${BASE_URL}/transactions/history`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
}
