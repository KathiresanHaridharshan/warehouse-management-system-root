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

  const [pickerTarget, setPickerTarget] = useState(null);
  const [dragSlot, setDragSlot] = useState(null);

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
    setPickerTarget(null);
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

  // Slot drag-and-drop reordering within a row
  const handleSlotDragStart = (e, rowIdx, slotIdx) => {
    setDragSlot({ rowIdx, slotIdx });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${rowIdx}-${slotIdx}`);
  };

  const handleSlotDragOver = (e, rowIdx) => {
    e.preventDefault();
    if (!dragSlot || dragSlot.rowIdx !== rowIdx) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSlotDrop = (e, rowIdx, slotIdx) => {
    e.preventDefault();
    if (!dragSlot || dragSlot.rowIdx !== rowIdx || dragSlot.slotIdx === slotIdx) {
      setDragSlot(null);
      return;
    }
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const newSlots = [...r.slots];
      const [moved] = newSlots.splice(dragSlot.slotIdx, 1);
      newSlots.splice(slotIdx, 0, moved);
      return { ...r, slots: newSlots };
    }));
    setDragSlot(null);
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

        <div className="fp-editor-body">
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
                  const isDragging = dragSlot && dragSlot.rowIdx === rowIdx && dragSlot.slotIdx === slotIdx;

                  return (
                    <div
                      key={slotIdx}
                      className={`fp-editor-slot-card${isDragging ? ' dragging' : ''}${mats.length > 0 ? ' has-material' : ''}`}
                      draggable
                      onDragStart={(e) => handleSlotDragStart(e, rowIdx, slotIdx)}
                      onDragOver={(e) => handleSlotDragOver(e, rowIdx)}
                      onDrop={(e) => handleSlotDrop(e, rowIdx, slotIdx)}
                      onDragEnd={() => setDragSlot(null)}
                    >
                      <div className="fp-editor-slot-top">
                        <span className="fp-editor-slot-num">P{slotIdx + 1}</span>
                        <span className="fp-editor-slot-drag-handle" title="Drag to reorder">⠿</span>
                      </div>

                      {mats.length === 0 ? (
                        <button
                          className="fp-editor-add-btn"
                          onClick={() => setPickerTarget({ rowIdx, slotIdx, position: 0 })}
                        >
                          + Add Material
                        </button>
                      ) : (
                        <div className="fp-editor-slot-mats">
                          {mats.map((m, mIdx) => (
                            <div key={m.id} className="fp-editor-mat-chip">
                              <div className="fp-editor-mat-color" style={{ background: m.colorHex || '#ccc' }} />
                              <span className="fp-editor-mat-name">{m.itemName}</span>
                              <button className="fp-editor-mat-x" onClick={(e) => { e.stopPropagation(); clearSlot(rowIdx, slotIdx, mIdx); }}>×</button>
                            </div>
                          ))}
                          {mats.length < 2 && (
                            <button
                              className="fp-editor-add-second"
                              onClick={() => setPickerTarget({ rowIdx, slotIdx, position: 1 })}
                            >
                              + Add 2nd Material
                            </button>
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

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Floor Plan</button>
        </div>

        {/* Material Picker Modal */}
        {pickerTarget && (
          <div className="fp-picker-overlay" onClick={() => setPickerTarget(null)}>
            <div className="fp-picker-modal" onClick={e => e.stopPropagation()}>
              <div className="fp-picker-header">
                <h3>Select Material</h3>
                <button className="modal-close" onClick={() => setPickerTarget(null)}>×</button>
              </div>
              <div className="fp-picker-list">
                {materials.map(m => (
                  <button
                    key={m.id}
                    className={`fp-picker-item${assignedIds.has(m.id) ? ' assigned' : ''}`}
                    onClick={() => assignToSlot(pickerTarget.rowIdx, pickerTarget.slotIdx, m.id, pickerTarget.position)}
                  >
                    <div className="fp-picker-color" style={{ background: m.colorHex || '#ccc' }} />
                    <div className="fp-picker-info">
                      <span className="fp-picker-name">{m.itemName}</span>
                      <span className="fp-picker-code">{m.itemCode}</span>
                    </div>
                    <span className="fp-picker-qty">{m.quantity} kg</span>
                    {assignedIds.has(m.id) && <span className="fp-picker-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
