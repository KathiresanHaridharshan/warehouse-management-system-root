import { useState, useRef } from 'react';
import { createMaterial, deleteMaterial, exportData, importData, reorderMaterials, uploadImage, updateMaterial } from '../api/materials';

export default function AdminPanel({ materials, onRefresh, onToast }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);
  const [newItem, setNewItem] = useState({
    itemName: '',
    itemCode: '',
    quantity: 0,
    minQuantity: 100,
    colorHex: '#E4242C',
    location: '',
    imageURL: '',
  });

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAdd = async () => {
    if (!newItem.itemName || !newItem.itemCode) {
      onToast('Name and code are required', 'error');
      return;
    }
    try {
      let material;
      if (editingId) {
        material = await updateMaterial(editingId, newItem);
      } else {
        material = await createMaterial(newItem);
      }

      if (imageFile && material.id) {
        await uploadImage(material.id, imageFile);
      }

      setNewItem({
        itemName: '',
        itemCode: '',
        quantity: 0,
        minQuantity: 100,
        colorHex: '#E4242C',
        location: '',
        imageURL: '',
      });
      setImageFile(null);
      setImagePreview('');
      setIsAdding(false);
      setEditingId(null);
      onRefresh();
      onToast(`Material ${editingId ? 'updated' : 'added'} successfully`);
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      await deleteMaterial(id);
      onRefresh();
      onToast('Material deleted');
    }
  };

  const handleExport = () => {
    exportData();
    onToast('Inventory exported successfully');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importData(file);
      onToast('Inventory imported successfully');
      onRefresh();
    } catch (err) {
      onToast(err.message, 'error');
    }
  };

  // Drag and Drop Logic
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    try {
      await reorderMaterials(draggedIndex, targetIndex);
      onRefresh();
    } catch (err) {
      onToast(err.message, 'error');
    } finally {
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="admin-title-group">
          <h2 className="admin-title">System Administration</h2>
          <p className="admin-subtitle">Manage inventory items, data backups, and material ordering.</p>
        </div>
        <div className="admin-actions">
          <label className="btn btn-secondary">
            📥 Import Data
            <input type="file" hidden accept=".json" onChange={handleImport} />
          </label>
          <button className="btn btn-secondary" onClick={handleExport}>
            📤 Export Data
          </button>
          <button className="btn btn-primary" onClick={() => {
            setEditingId(null);
            setNewItem({
              itemName: '', itemCode: '', quantity: 0, minQuantity: 100,
              colorHex: '#E4242C', location: '', imageURL: ''
            });
            setImageFile(null);
            setImagePreview('');
            setIsAdding(true);
          }}>
            + Add New Material
          </button>
        </div>
      </header>

      {isAdding && (
        <div className="admin-card form-card">
          <div className="card-header">
            <h3>{editingId ? 'Edit Material' : 'Add New Material'}</h3>
            <button className="close-btn" onClick={() => { setIsAdding(false); setEditingId(null); }}>×</button>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Item Name</label>
              <input
                type="text"
                placeholder="Ex: Polycarbonate"
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Item Code</label>
              <input
                type="text"
                placeholder="Ex: 290-1000"
                value={newItem.itemCode}
                onChange={(e) => setNewItem({ ...newItem, itemCode: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Current Stock (kg)</label>
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="form-field">
              <label>Low Stock Alert (kg)</label>
              <input
                type="number"
                value={newItem.minQuantity}
                onChange={(e) => setNewItem({ ...newItem, minQuantity: parseInt(e.target.value) || 100 })}
                placeholder="100"
              />
            </div>

            <div className="form-field">
              <label>Location / Rack</label>
              <input
                type="text"
                placeholder="Ex: Rack A-01"
                value={newItem.location}
                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Color Identifier</label>
              <div className="color-input-wrapper">
                <input
                  type="color"
                  value={newItem.colorHex}
                  onChange={(e) => setNewItem({ ...newItem, colorHex: e.target.value })}
                />
                <input
                  type="text"
                  value={newItem.colorHex}
                  onChange={(e) => setNewItem({ ...newItem, colorHex: e.target.value })}
                />
              </div>
            </div>
            <div className="form-field full-width">
              <label>Product Image</label>
              <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  hidden
                />
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <span>Click to upload image (JPG, PNG, WebP)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-actions">
            <button className="btn btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); setImageFile(null); setImagePreview(''); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>{editingId ? 'Save Changes' : 'Save Material'}</button>
          </div>
        </div>
      )}

      <div className="admin-card list-card">
        <div className="card-header">
          <h3>Material Sequence</h3>
          <span className="badge">Drag to reorder</span>
        </div>
        <div className="admin-list">
          {materials.map((m, index) => (
            <div
              key={m.id}
              className={`admin-list-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
            >
              <div className="drag-handle">⋮⋮</div>
              <div className="item-color" style={{ background: m.colorHex }} />
              <div className="item-info">
                <span className="item-name">{m.itemName}</span>
                <span className="item-code">{m.itemCode}</span>
              </div>
              <div className="item-stats">
                <span className="stock-count">{m.quantity} kg</span>
                <span className="location-tag">{m.location || 'N/A'}</span>
              </div>
              <div className="item-actions">
                <button className="action-btn edit" onClick={() => {
                  setEditingId(m.id);
                  setNewItem({
                    itemName: m.itemName || '',
                    itemCode: m.itemCode || '',
                    quantity: m.quantity || 0,
                    minQuantity: m.minQuantity || 100,
                    colorHex: m.colorHex || '#E4242C',
                    location: m.location || '',
                    imageURL: m.imageURL || ''
                  });
                  setImagePreview(m.imageURL || '');
                  setImageFile(null);
                  setIsAdding(true);
                }}>✏️</button>
                <button className="action-btn delete" onClick={() => handleDelete(m.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
