import { useState } from 'react';
import { adjustQuantity } from '../api/materials';

export default function DetailModal({ material, onClose, onUpdated }) {
  const [delta, setDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!material) return null;

  const previewQty = material.quantity + delta;
  const minQty = material.minQuantity || 100;
  const isLow = previewQty <= minQty;

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
      <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="detail-modal-header">
          <div className="detail-modal-title">
            <span className="dm-title-text">{material.itemName}</span>
            <span className="dm-badge" style={{ background: material.colorHex || '#ccc' }}>
              {material.itemCode}
            </span>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="detail-modal-body">
          {/* Left Column: Image & Details */}
          <div className="dm-left">
            <div className="dm-image-container">
              {material.imageURL ? (
                <img className="dm-image" src={material.imageURL} alt={material.itemName} />
              ) : (
                <div className="dm-image-placeholder">📦</div>
              )}
            </div>
            <div className="dm-info-grid">
              <div className="dm-info-item">
                <span className="dm-info-label">Supplier</span>
                <span className="dm-info-val">{material.supplier || '—'}</span>
              </div>
              <div className="dm-info-item">
                <span className="dm-info-label">Location</span>
                <span className="dm-info-val">{material.location || '—'}</span>
              </div>
              <div className="dm-info-item">
                <span className="dm-info-label">Low Alert</span>
                <span className="dm-info-val">{minQty} kg</span>
              </div>
            </div>
          </div>

          {/* Right Column: Quantity Management */}
          <div className="dm-right">
            <div className="dm-stock-card">
              <div className="dm-stock-header">
                <span className="dm-stock-label">Current Stock</span>
                {isLow && <span className="dm-low-badge">⚠ LOW</span>}
              </div>
              
              <div className="dm-stock-value-wrapper">
                <span className={`dm-stock-value ${isLow ? 'low' : ''}`}>{previewQty}</span>
                <span className="dm-stock-unit">kg</span>
              </div>

              {delta !== 0 && (
                <div className={`dm-stock-delta ${delta > 0 ? 'positive' : 'negative'}`}>
                  {delta > 0 ? '+' : ''}{delta} kg ({delta > 0 ? '+' : ''}{delta / 25} Sack{Math.abs(delta / 25) === 1 ? '' : 's'})
                </div>
              )}
            </div>

            <div className="dm-controls-wrapper">
              <span className="dm-controls-label">Adjust Quantity (±25kg Sacks)</span>
              <div className="dm-controls">
                <button className="dm-btn-minus" onClick={() => handleAdjust(-25)}>−25</button>
                <input
                  className="dm-input-qty"
                  type="number"
                  value={delta}
                  onChange={(e) => handleCustomInput(e.target.value)}
                />
                <button className="dm-btn-plus" onClick={() => handleAdjust(25)}>+25</button>
              </div>
            </div>

            {error && <div className="dm-error">{error}</div>}
          </div>
        </div>

        <div className="detail-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || (material.quantity + delta < 0)}
          >
            {saving ? 'Saving...' : delta === 0 ? 'Done' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
