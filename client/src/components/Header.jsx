export default function Header({ view, onViewChange }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">🏭</div>
        <div className="brand-name">
          <span>Warehouse</span>
          <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>MANAGER</span>
        </div>
      </div>

      <div className="sidebar-menu">
        <button
          className={`menu-item${view === 'home' ? ' active' : ''}`}
          onClick={() => onViewChange('home')}
          title="Dashboard"
        >
          <span className="menu-icon">🏠</span>
          <span className="menu-label">Dashboard</span>
        </button>
        <button
          className={`menu-item${view === 'inventory' ? ' active' : ''}`}
          onClick={() => onViewChange('inventory')}
          title="Inventory"
        >
          <span className="menu-icon">📋</span>
          <span className="menu-label">Inventory</span>
        </button>
        <button
          className={`menu-item${view === 'history' ? ' active' : ''}`}
          onClick={() => onViewChange('history')}
          title="History"
        >
          <span className="menu-icon">🕒</span>
          <span className="menu-label">History</span>
        </button>
        <button
          className={`menu-item${view === 'admin' ? ' active' : ''}`}
          onClick={() => onViewChange('admin')}
          title="Admin Settings"
        >
          <span className="menu-icon">⚙️</span>
          <span className="menu-label">Settings</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">👤</div>
          <div className="user-info">
            <span className="user-name">Warehouse Admin</span>
            <span className="user-role">System Manager</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
