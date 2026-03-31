export default function Header({ view, onViewChange }) {
  return (
    <nav className="sidebar sidebar-slim">
      <div className="sidebar-brand">
        <div className="brand-logo">🏭</div>
      </div>

      <div className="sidebar-menu">
        <button
          className={`menu-item${view === 'floorplan' ? ' active' : ''}`}
          onClick={() => onViewChange('floorplan')}
          title="Floor Plan"
        >
          <span className="menu-icon">🗺️</span>
          <span className="menu-tooltip">Floor Plan</span>
        </button>
        <button
          className={`menu-item${view === 'home' ? ' active' : ''}`}
          onClick={() => onViewChange('home')}
          title="Materials"
        >
          <span className="menu-icon">📦</span>
          <span className="menu-tooltip">Materials</span>
        </button>
        <button
          className={`menu-item${view === 'inventory' ? ' active' : ''}`}
          onClick={() => onViewChange('inventory')}
          title="Inventory"
        >
          <span className="menu-icon">📋</span>
          <span className="menu-tooltip">Inventory</span>
        </button>
        <button
          className={`menu-item${view === 'history' ? ' active' : ''}`}
          onClick={() => onViewChange('history')}
          title="History"
        >
          <span className="menu-icon">🕒</span>
          <span className="menu-tooltip">History</span>
        </button>
        <button
          className={`menu-item${view === 'admin' ? ' active' : ''}`}
          onClick={() => onViewChange('admin')}
          title="Settings"
        >
          <span className="menu-icon">⚙️</span>
          <span className="menu-tooltip">Settings</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">👤</div>
        </div>
      </div>
    </nav>
  );
}
