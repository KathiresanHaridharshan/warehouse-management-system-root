import { useState } from 'react';
import { parseSlot, serializeSlot } from '../api/materials';

export default function FloorPlanEditor({ config, materials, onSave, onClose }) {
  const [rows, setRows] = useState(() =>
    config.rows.map(r => ({
      label: r.label || '',
      count: r.count || 4,
      slots: (r.slots || []).map(s => {
        const ids = parseSlot(s);
        return ids.length > 0 ? ids : [];
      }),
    }))
  );

  const [draggedMaterial, setDraggedMaterial] = useState(null);

  const updateRow = (rowIdx, key, value) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const updated = { ...r, [key]: value };
      if (key === 'count') {
        const newCount = Math.max(1, Math.min(12, parseInt(value) || 1));
        updated.count = newCount;
        const newSlots = [...r.slots];
        while (newSlots.length < newCount) newSlots.push([]);
        while (newSlots.length > newCount) newSlots.pop();
        updated.slots = newSlots;
      }
      return updated;
    }));
  };

  const assignToSlot = (rowIdx, slotIdx, materialId, position = 0) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const newSlots = [...r.slots];
      const current = [...(newSlots[slotIdx] || [])];
      if (position === 0) {
        current[0] = materialId;
      } else {
        current[1] = materialId;
      }
      newSlots[slotIdx] = current.filter(Boolean);
      return { ...r, slots: newSlots };
    }));
  };

  const clearSlot = (rowIdx, slotIdx, position = -1) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const newSlots = [...r.slots];
      if (position === -1) {
        newSlots[slotIdx] = [];
      } else {
        const current = [...(newSlots[slotIdx] || [])];
        current.splice(position, 1);
        newSlots[slotIdx] = current;
      }
      return { ...r, slots: newSlots };
    }));
  };

  const addRow = () => {
    const label = `Row ${String.fromCharCode(65 + rows.length)}`;
    setRows(prev => [...prev, { label, count: 4, slots: [[], [], [], []] }]);
  };

  const removeRow = (idx) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rows.length) return;
    setRows(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleSave = () => {
    const serialized = {
      rows: rows.map(r => ({
        label: r.label,
        count: r.count,
        slots: r.slots.map(ids => serializeSlot(ids)),
      }))
    };
    onSave(serialized);
  };

  // Drag handlers for materials list
  const handleMaterialDragStart = (e, materialId) => {
    setDraggedMaterial(materialId);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', materialId);
  };

  const handleSlotDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleSlotDrop = (e, rowIdx, slotIdx) => {
    e.preventDefault();
    const materialId = e.dataTransfer.getData('text/plain') || draggedMaterial;
    if (!materialId) return;
    
    const current = rows[rowIdx]?.slots[slotIdx] || [];
    if (current.length === 0) {
      assignToSlot(rowIdx, slotIdx, materialId, 0);
    } else if (current.length === 1) {
      assignToSlot(rowIdx, slotIdx, materialId, 1);
    }
    setDraggedMaterial(null);
  };

  // Get all assigned material IDs
  const assignedIds = new Set();
  rows.forEach(r => r.slots.forEach(ids => {
    (ids || []).forEach(id => id && assignedIds.add(id));
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="fp-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Floor Plan</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fp-editor-layout">
          {/* Materials Panel - drag source */}
          <div className="fp-editor-materials-panel">
            <h3 className="fp-editor-panel-title">📦 Materials</h3>
            <p className="fp-editor-panel-hint">Drag materials onto pallet slots</p>
            <div className="fp-editor-materials-list">
              {materials.map(m => (
                <div
                  key={m.id}
                  className={`fp-editor-material-chip${assignedIds.has(m.id) ? ' assigned' : ''}`}
                  draggable
                  onDragStart={(e) => handleMaterialDragStart(e, m.id)}
                >
                  <div className="fp-chip-color" style={{ background: m.colorHex || '#ccc' }} />
                  <div className="fp-chip-info">
                    <span className="fp-chip-name">{m.itemName}</span>
                    <span className="fp-chip-code">{m.itemCode}</span>
                  </div>
                  <span className="fp-chip-qty">{m.quantity} kg</span>
                  {assignedIds.has(m.id) && <span className="fp-chip-placed">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Floor Plan Grid - drop targets */}
          <div className="fp-editor-grid-panel">
            <div className="fp-editor-rows">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="fp-editor-row">
                  <div className="fp-editor-row-header">
                    <div className="fp-editor-row-controls">
                      <button className="fp-editor-arrow" onClick={() => moveRow(rowIdx, -1)} disabled={rowIdx === 0} title="Move up">↑</button>
                      <button className="fp-editor-arrow" onClick={() => moveRow(rowIdx, 1)} disabled={rowIdx === rows.length - 1} title="Move down">↓</button>
                    </div>
                    <input
                      className="fp-editor-label-input"
                      value={row.label}
                      onChange={e => updateRow(rowIdx, 'label', e.target.value)}
                      placeholder="Row label"
                    />
                    <div className="fp-editor-count-wrapper">
                      <label>Pallets:</label>
                      <input
                        type="number"
                        className="fp-editor-count-input"
                        min={1}
                        max={12}
                        value={row.count}
                        onChange={e => updateRow(rowIdx, 'count', e.target.value)}
                      />
                    </div>
                    <button className="fp-editor-remove-row" onClick={() => removeRow(rowIdx)} disabled={rows.length <= 1} title="Remove row">🗑️</button>
                  </div>

                  <div className="fp-editor-slots">
                    {row.slots.map((slotIds, slotIdx) => {
                      const mats = (slotIds || []).map(id => materials.find(m => m.id === id)).filter(Boolean);
                      return (
                        <div
                          key={slotIdx}
                          className={`fp-editor-slot-drop${mats.length > 0 ? ' has-material' : ''}`}
                          onDragOver={handleSlotDragOver}
                          onDrop={(e) => handleSlotDrop(e, rowIdx, slotIdx)}
                        >
                          <span className="fp-editor-slot-num">P{slotIdx + 1}</span>
                          {mats.length === 0 ? (
                            <div className="fp-editor-slot-empty-drop">
                              <span className="fp-drop-icon">+</span>
                              <span className="fp-drop-text">Drop here</span>
                            </div>
                          ) : (
                            <div className="fp-editor-slot-materials">
                              {mats.map((m, mIdx) => (
                                <div key={m.id} className="fp-editor-slot-mat">
                                  <div className="fp-slot-mat-color" style={{ background: m.colorHex || '#ccc' }} />
                                  <span className="fp-slot-mat-name">{m.itemName}</span>
                                  <button className="fp-slot-mat-remove" onClick={() => clearSlot(rowIdx, slotIdx, mIdx)} title="Remove">×</button>
                                </div>
                              ))}
                              {mats.length < 2 && (
                                <div className="fp-editor-slot-add-more">+ Drop 2nd</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button className="fp-editor-add-row" onClick={addRow}>
                + Add Row
              </button>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Floor Plan</button>
        </div>
      </div>
    </div>
  );
}
