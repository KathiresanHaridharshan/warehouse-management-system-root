import { useState, useEffect, useCallback } from 'react';
import PalletSlot from './PalletSlot';
import FloorPlanEditor from './FloorPlanEditor';
import { fetchFloorPlan, saveFloorPlan, parseSlot } from '../api/materials';

export default function FloorPlanView({ materials, onCardClick, onToast }) {
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const data = await fetchFloorPlan();
      setConfig(data);
    } catch (err) {
      onToast && onToast('Failed to load floor plan', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Escape key to exit fullscreen
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  const handleSave = async (newConfig) => {
    try {
      await saveFloorPlan(newConfig);
      setConfig(newConfig);
      setEditing(false);
      onToast && onToast('Floor plan saved successfully');
    } catch (err) {
      onToast && onToast('Failed to save floor plan: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="fp-empty-state">
        <h2>No Floor Plan Configured</h2>
        <p>Click below to set up your warehouse floor plan.</p>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          🗺️ Create Floor Plan
        </button>
        {editing && (
          <FloorPlanEditor
            config={{ rows: [{ label: 'Row A', count: 6, slots: [null,null,null,null,null,null] }] }}
            materials={materials}
            onSave={handleSave}
            onClose={() => setEditing(false)}
          />
        )}
      </div>
    );
  }

  // Count assigned and total slots
  const totalSlots = config.rows.reduce((sum, r) => sum + r.count, 0);
  const filledSlots = config.rows.reduce((sum, r) => {
    return sum + r.slots.filter(s => s !== null).length;
  }, 0);

  // Find the max slot count across all rows for uniform sizing
  const maxSlots = Math.max(...config.rows.map(r => r.count));

  const floorContent = (
    <div className="fp-floor">
      {config.rows.map((row, rowIdx) => (
        <div key={rowIdx} className="fp-row">
          <div className="fp-row-label">
            <span className="fp-row-label-text">{row.label || `Row ${rowIdx + 1}`}</span>
            <span className="fp-row-count">{row.count} pallets</span>
          </div>
          <div className="fp-row-slots" style={{ '--slot-count': maxSlots }}>
            {row.slots.map((slot, slotIdx) => (
              <PalletSlot
                key={slotIdx}
                slotData={slot}
                materials={materials}
                onClick={onCardClick}
                rowIndex={rowIdx}
                slotIndex={slotIdx}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Fullscreen overlay
  if (fullscreen) {
    return (
      <div className="fp-fullscreen-overlay">
        <div className="fp-fullscreen-topbar">
          <h2 className="fp-fullscreen-title">🏭 Warehouse Floor Plan</h2>
          <button className="fp-fullscreen-exit" onClick={() => setFullscreen(false)}>
            ✕ Exit Fullscreen
          </button>
        </div>
        <div className="fp-fullscreen-content">
          {floorContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fp-container">
      <div className="fp-header">
        <div className="fp-header-left">
          <h2 className="fp-title">
            <span className="fp-title-icon">🗺️</span>
            Warehouse Floor Plan
          </h2>
          <div className="fp-stats-row">
            <span className="fp-stat">
              <span className="fp-stat-val">{totalSlots}</span> Pallets
            </span>
            <span className="fp-stat-sep">•</span>
            <span className="fp-stat">
              <span className="fp-stat-val">{filledSlots}</span> Assigned
            </span>
            <span className="fp-stat-sep">•</span>
            <span className="fp-stat">
              <span className="fp-stat-val">{totalSlots - filledSlots}</span> Empty
            </span>
          </div>
        </div>
        <div className="fp-header-actions">
          <button className="btn btn-secondary fp-fullscreen-btn" onClick={() => setFullscreen(true)}>
            ⛶ Fullscreen
          </button>
          <button className="btn btn-primary fp-edit-btn" onClick={() => setEditing(true)}>
            ✏️ Edit Layout
          </button>
        </div>
      </div>

      <div className="fp-legend">
        <span className="fp-legend-title">Legend:</span>
        <span className="fp-legend-item">
          <span className="fp-legend-dot" style={{background: 'var(--gray-200)', border: '2px dashed var(--gray-300)'}}></span>
          Empty
        </span>
        <span className="fp-legend-item">
          <span className="fp-legend-dot" style={{background: 'var(--success)'}}></span>
          In Stock
        </span>
        <span className="fp-legend-item">
          <span className="fp-legend-dot" style={{background: 'var(--danger)'}}></span>
          Low Stock
        </span>
      </div>

      {floorContent}

      {editing && (
        <FloorPlanEditor
          config={config}
          materials={materials}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
