import { useState, useRef } from 'react';
import { createMaterial, updateMaterial, deleteMaterial, uploadImage } from '../api/materials';

const emptyForm = {
  itemCode: '',
  itemName: '',
  supplier: '',
  location: '',
  colorHex: '#cccccc',
  quantity: 0,
  description: '',
};

export default function AdminPanel({ materials, onRefresh, onToast }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEdit = (material) => {
    setEditingId(material.id);
    setForm({
      itemCode: material.itemCode,
      itemName: material.itemName,
      supplier: material.supplier || '',
      location: material.location || '',
      colorHex: material.colorHex || '#cccccc',
      quantity: material.quantity,
      description: material.description || '',
    });
    setImagePreview(material.imageURL || '');
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    try {
      await deleteMaterial(id);
      onToast('Material deleted', 'success');
      onRefresh();
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let material;
      if (editingId) {
        material = await updateMaterial(editingId, form);
        onToast('Material updated', 'success');
      } else {
        material = await createMaterial(form);
        onToast('Material added', 'success');
      }

      if (imageFile && material.id) {
        await uploadImage(material.id, imageFile);
      }

      handleCancel();
      onRefresh();
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2 className="admin-title">{editingId ? '✏️ Edit Material' : '➕ Add New Material'}</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Item Code *</label>
            <input
              className="form-input"
              type="text"
              value={form.itemCode}
              onChange={(e) => handleChange('itemCode', e.target.value)}
              required
              placeholder="e.g. 290-1001"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Item Name *</label>
            <input
              className="form-input"
              type="text"
              value={form.itemName}
              onChange={(e) => handleChange('itemName', e.target.value)}
              required
              placeholder="e.g. Polycarbonate White"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <input
              className="form-input"
              type="text"
              value={form.supplier}
              onChange={(e) => handleChange('supplier', e.target.value)}
              placeholder="e.g. SABIC"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Storage Location</label>
            <input
              className="form-input"
              type="text"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g. Rack A1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Color Code</label>
            <div className="form-color-wrapper">
              <input
                className="form-color-input"
                type="color"
                value={form.colorHex}
                onChange={(e) => handleChange('colorHex', e.target.value)}
              />
              <input
                className="form-input"
                type="text"
                value={form.colorHex}
                onChange={(e) => handleChange('colorHex', e.target.value)}
                placeholder="#cccccc"
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Initial Quantity</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Description / Usage</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="What is this material used for?"
            />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Product Image</label>
            <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
              />
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              ) : (
                <span>📷 Click to upload image (JPG, PNG, WebP — max 5MB)</span>
              )}
            </div>
          </div>
          <div className="form-actions">
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Material' : 'Add Material'}
            </button>
          </div>
        </div>
      </form>

      <div className="admin-materials-list">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
          All Materials ({materials.length})
        </h3>
        {materials.map((m) => (
          <div key={m.id} className="admin-material-item">
            <div className="admin-material-color" style={{ background: m.colorHex }} />
            <div className="admin-material-info">
              <div className="admin-material-name">{m.itemName}</div>
              <div className="admin-material-code">{m.itemCode} · Qty: {m.quantity} · Slot #{m.palletSlot}</div>
            </div>
            <div className="admin-material-actions">
              <button className="icon-btn" onClick={() => handleEdit(m)} title="Edit">✏️</button>
              <button className="icon-btn delete" onClick={() => handleDelete(m.id)} title="Delete">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
