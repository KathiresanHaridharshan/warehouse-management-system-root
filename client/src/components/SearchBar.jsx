export default function SearchBar({ value, onChange, filledCount, lowCount }) {
  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          id="search-input"
          className="search-input"
          type="text"
          placeholder="Search by name or item code…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-dot filled" />
          <span>{filledCount} Filled</span>
        </div>
        <div className="stat-item">
          <span className="stat-dot empty" />
          <span>{24 - filledCount} Empty</span>
        </div>
        {lowCount > 0 && (
          <div className="stat-item">
            <span className="stat-dot low" />
            <span>{lowCount} Low Stock</span>
          </div>
        )}
      </div>
    </div>
  );
}
