import { useState } from 'react';
import { adjustQuantity } from '../api/materials';

export default function DetailModal({ material, onClose, onUpdated }) {
  const [delta, setDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!material) return null;

  const previewQty = material.quantity + delta;
  const isLow = previewQty <= 10;

  const handleAdjust = (amount) => {
    const newDelta = delta + amount;
    if (material.quantity + newDelta < 0) {
      setError('Quantity cannot go below 0');
      return;
    }
    setError('');
    setDelta(newDelta);
  };

  const handleCustomInput = (value) => {
    const num = parseInt(value) || 0;
    setDelta(num);
    if (material.quantity + num < 0) {
      setError('Quantity cannot go below 0');
    } else {
      setError('');
    }
  };

  const handleSave = async () => {
    if (delta === 0) {
      onClose();
      return;
    }
    if (material.quantity + delta < 0) {
      setError('Quantity cannot go below 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adjustQuantity(material.id, delta);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{material.itemName}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="detail-image-section">
            {material.imageURL ? (
              <img className="detail-image" src={material.imageURL} alt={material.itemName} />
            ) : (
              <span className="detail-image-placeholder">📦</span>
            )}
          </div>

          <div className="detail-grid">
            <div className="detail-field">
              <span className="detail-label">Item Code</span>
              <span className="detail-value" style={{ fontFamily: 'monospace' }}>{material.itemCode}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Supplier</span>
              <span className="detail-value">{material.supplier || '—'}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Storage Location</span>
              <span className="detail-value">{material.location || '—'}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Color</span>
              <div className="color-display">
                <span className="color-swatch" style={{ background: material.colorHex }} />
                <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{material.colorHex}</span>
              </div>
            </div>
            <div className="detail-field full-width">
              <span className="detail-label">Description / Usage</span>
              <span className="detail-value">{material.description || '—'}</span>
            </div>
          </div>

          <div className="quantity-section">
            <div className="quantity-header">
              <div>
                <span className="quantity-unit">Current Stock</span>
                <div className={`quantity-current${isLow ? ' low' : ''}`}>
                  {previewQty}
                  {delta !== 0 && (
                    <span style={{ fontSize: '0.8rem', marginLeft: 8, color: delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ({delta > 0 ? '+' : ''}{delta})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="quantity-controls">
              <button className="qty-btn decrease" onClick={() => handleAdjust(-5)}>−5</button>
              <button className="qty-btn decrease" onClick={() => handleAdjust(-1)}>−1</button>
              <input
                className="qty-input"
                type="number"
                value={delta}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder="±"
              />
              <button className="qty-btn increase" onClick={() => handleAdjust(1)}>+1</button>
              <button className="qty-btn increase" onClick={() => handleAdjust(5)}>+5</button>
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>{error}</p>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || (material.quantity + delta < 0)}
          >
            {saving ? 'Saving…' : delta === 0 ? 'Close' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
