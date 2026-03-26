export default function PalletCard({ material, slotNumber, onClick }) {
  if (!material) {
    return (
      <div className="pallet-card empty-slot">
        <div className="empty-card-content">
          <span className="empty-icon">📦</span>
          <span className="empty-label">Empty Slot</span>
          <span className="empty-slot-number">#{slotNumber}</span>
        </div>
      </div>
    );
  }

  const isLow = material.isLowStock;
  const imgSrc = material.imageURL || null;

  return (
    <div
      className={`pallet-card${isLow ? ' low-stock' : ''}`}
      onClick={() => onClick(material)}
      id={`pallet-card-${material.id}`}
    >
      <div className="card-color-strip" style={{ background: material.colorHex }} />
      <div className="card-image-container">
        {imgSrc ? (
          <img className="card-image" src={imgSrc} alt={material.itemName} loading="lazy" />
        ) : (
          <span className="card-image-placeholder">📦</span>
        )}
        {isLow && <span className="card-low-badge">Low</span>}
      </div>
      <div className="card-body">
        <span className="card-name">{material.itemName}</span>
        <span className="card-code">{material.itemCode}</span>
        <div className="card-footer">
          <span className={`card-quantity${isLow ? ' low' : ''}`}>
            {material.quantity} <span style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)' }}>units</span>
          </span>
          <span className="card-color-badge" style={{ background: material.colorHex }} />
        </div>
      </div>
    </div>
  );
}
