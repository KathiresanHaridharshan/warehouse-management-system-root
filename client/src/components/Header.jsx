export default function Header({ view, onViewChange }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">🏭</div>
        <div>
          <div className="header-title">Warehouse Manager</div>
          <div className="header-subtitle">Material Pallet Tracking System</div>
        </div>
      </div>
      <div className="header-right">
        <button
          className={`nav-btn${view === 'home' ? ' active' : ''}`}
          onClick={() => onViewChange('home')}
          id="nav-home"
        >
          🏠 Home
        </button>
        <button
          className={`nav-btn${view === 'inventory' ? ' active' : ''}`}
          onClick={() => onViewChange('inventory')}
          id="nav-inventory"
        >
          📋 Inventory
        </button>
        <button
          className={`nav-btn${view === 'history' ? ' active' : ''}`}
          onClick={() => onViewChange('history')}
          id="nav-history"
        >
          🕒 History
        </button>
        <button
          className={`nav-btn${view === 'admin' ? ' active' : ''}`}
          onClick={() => onViewChange('admin')}
          id="nav-admin"
        >
          ⚙️ Admin
        </button>
      </div>
    </header>
  );
}
