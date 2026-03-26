const InventoryTable = ({ materials, onRowClick }) => {
  return (
    <div className="inventory-table-container">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Item Code</th>
            <th>Supplier</th>
            <th>Location</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => (
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
              <td className={`qty-cell ${material.isLowStock ? 'low' : ''}`}>
                {material.quantity}
              </td>
            </tr>
          ))}
          {materials.length === 0 && (
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
