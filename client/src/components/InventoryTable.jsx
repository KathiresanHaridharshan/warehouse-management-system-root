import { useState } from 'react';

const InventoryTable = ({ materials, onRowClick }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'itemName', direction: 'asc' });
  const [showLowStock, setShowLowStock] = useState(false);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredMaterials = showLowStock 
    ? materials.filter(m => m.isLowStock) 
    : materials;

  const sortedMaterials = [...filteredMaterials].sort((a, b) => {
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="inventory-table-container">
      <div className="table-toolbar">
        <label className="checkbox-container">
          <input 
            type="checkbox" 
            checked={showLowStock} 
            onChange={(e) => setShowLowStock(e.target.checked)} 
          />
          <span className="checkbox-label">Show Low Stock Only</span>
        </label>
      </div>
      <table className="inventory-table">
        <thead>
          <tr>
            <th onClick={() => requestSort('itemName')} className="sortable">
              Item Name {sortConfig.key === 'itemName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('itemCode')} className="sortable">
              Item Code {sortConfig.key === 'itemCode' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('supplier')} className="sortable">
              Supplier {sortConfig.key === 'supplier' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('location')} className="sortable">
              Location {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('quantity')} className="sortable text-right">
              Quantity {sortConfig.key === 'quantity' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMaterials.map((material) => (
            <tr key={material.id} onClick={() => onRowClick(material)} style={{ cursor: 'pointer' }}>
              <td>
                <div className="item-name-cell">
                  <span 
                    className="item-color-dot" 
                    style={{ background: material.colorHex }} 
                  />
                  {material.itemName}
                </div>
              </td>
              <td className="code-cell">{material.itemCode}</td>
              <td>{material.supplier || '—'}</td>
              <td>{material.location || '—'}</td>
              <td className={`qty-cell text-right ${material.isLowStock ? 'low' : ''}`}>
                {material.quantity}
              </td>
            </tr>
          ))}
          {sortedMaterials.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                No materials found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryTable;
