export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-input-wrapper">
      <span className="search-icon">🔍</span>
      <input
        id="search-input"
        className="search-input"
        type="text"
        placeholder="Quick search materials..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
