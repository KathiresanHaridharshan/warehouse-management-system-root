import { parseSlot } from '../api/materials';

export default function PalletSlot({ slotData, materials, onClick, rowIndex, slotIndex, isFullscreen }) {
  const ids = parseSlot(slotData);

  if (ids.length === 0) {
    return (
      <div className="fp-slot fp-slot-empty" title={`Row ${rowIndex + 1}, Slot ${slotIndex + 1}`}>
        <div className="fp-slot-empty-inner">
          <span className="fp-slot-plus">+</span>
          <span className="fp-slot-label">Empty</span>
        </div>
      </div>
    );
  }

  const mats = ids.map(id => materials.find(m => m.id === id)).filter(Boolean);

  if (mats.length === 0) {
    return (
      <div className="fp-slot fp-slot-empty fp-slot-missing" title="Assigned material not found">
        <div className="fp-slot-empty-inner">
          <span className="fp-slot-plus">?</span>
          <span className="fp-slot-label">Not Found</span>
        </div>
      </div>
    );
  }

  if (mats.length === 1) {
    const m = mats[0];
    const isLow = m.isLowStock;
    return (
      <div
        className={`fp-slot fp-slot-filled${isLow ? ' fp-slot-low' : ''}${isFullscreen ? ' fp-slot-clickable' : ''}`}
        style={{ '--slot-color': m.colorHex || '#cbd5e1' }}
        onClick={() => onClick && onClick(m)}
        title={`${m.itemName} (${m.itemCode}) — Click to manage stock`}
      >
        <div className="fp-slot-color-bar" style={{ background: m.colorHex || '#cbd5e1' }} />
        <div className="fp-slot-content">
          {m.imageURL ? (
            <img className="fp-slot-img" src={m.imageURL} alt={m.itemName} />
          ) : (
            <div className="fp-slot-img-placeholder">📦</div>
          )}
          <div className="fp-slot-info">
            <span className="fp-slot-name">{m.itemName}</span>
            <span className="fp-slot-code">{m.itemCode}</span>
            <span className={`fp-slot-qty${isLow ? ' low' : ''}`}>{m.quantity} kg</span>
            <span className="fp-slot-total">Total: {m.totalStock != null ? m.totalStock : m.quantity} items</span>
          </div>
        </div>
        {isLow && <div className="fp-slot-low-badge">LOW</div>}
      </div>
    );
  }

  // Two materials in one slot (dual/half-half)
  return (
    <div className={`fp-slot fp-slot-dual${isFullscreen ? ' fp-slot-clickable' : ''}`}>
      {mats.map((m) => {
        const isLow = m.isLowStock;
        return (
          <div
            key={m.id}
            className={`fp-slot-half${isLow ? ' fp-half-low' : ''}`}
            style={{ '--slot-color': m.colorHex || '#cbd5e1' }}
            onClick={(e) => { e.stopPropagation(); onClick && onClick(m); }}
          >
            <div className="fp-half-color" style={{ background: m.colorHex || '#cbd5e1' }} />
            <div className="fp-half-content">
              {m.imageURL ? (
                <img className="fp-half-img" src={m.imageURL} alt={m.itemName} />
              ) : (
                <div className="fp-half-placeholder">📦</div>
              )}
              <div className="fp-half-info">
                <span className="fp-half-name">{m.itemName}</span>
                <span className={`fp-half-qty${isLow ? ' low' : ''}`}>{m.quantity} kg</span>
              </div>
            </div>
            {isLow && <div className="fp-half-low-badge">LOW</div>}
          </div>
        );
      })}
    </div>
  );
}
