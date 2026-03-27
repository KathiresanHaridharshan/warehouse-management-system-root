import PalletCard from './PalletCard';

export default function PalletGrid({ materials, onCardClick, filledCount, lowCount }) {
  return (
    <div className="pallet-grid-container">
      <div className="stats-grid stats-grid-centered">
        <div className="stat-card accent">
          <div className="stat-info">
            <span className="stat-value">{filledCount}</span>
            <span className="stat-label">Total Materials</span>
          </div>
          <div className="stat-icon-wrapper">📦</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-info">
            <span className="stat-value">{lowCount}</span>
            <span className="stat-label">Low Stock Items</span>
          </div>
          <div className="stat-icon-wrapper">⚠️</div>
        </div>
      </div>

      <h2 className="section-title">Material Inventory</h2>
      
      <div className="pallet-grid">
        {materials.map((m) => (
          <PalletCard key={m.id} material={m} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
