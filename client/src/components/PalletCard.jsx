export default function PalletCard({ material, onClick }) {
  if (!material) return null;

  const isLow = material.isLowStock;
  const imgSrc = material.imageURL || null;

  return (
    <div
      className={`pallet-card${isLow ? ' low-stock' : ''}`}
      onClick={() => onClick(material)}
    >
      <div className="card-image-section">
        <div className="card-badge category">Material</div>
        <div className="card-badge location">{material.location || 'No Location'}</div>
        {imgSrc ? (
          <img className="card-image" src={imgSrc} alt={material.itemName} />
        ) : (
          <div className="card-image-placeholder">📦</div>
        )}
        {isLow && <div className="card-low-indicator">LOW STOCK</div>}
      </div>

      <div className="card-content">
        <div className="card-header-info">
          <h3 className="card-name">{material.itemName}</h3>
          <span className="card-code">{material.itemCode}</span>
        </div>

        <div className="card-details-row">
          <div className="card-detail-item">
            <span className="detail-label">Quantity</span>
            <span className={`detail-value${isLow ? ' low' : ''}`}>{material.quantity} kg</span>
          </div>
          <div className="material-color-indicator" style={{ background: material.colorHex }} title={material.colorHex} />
        </div>

        <button className="card-action-btn">
          View Details
          <span className="btn-icon">→</span>
        </button>
      </div>
    </div>
  );
}
