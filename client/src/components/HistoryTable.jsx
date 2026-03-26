const HistoryTable = ({ history }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getActionStyle = (type) => {
    switch (type) {
      case 'ADD': return { color: 'var(--success)', fontWeight: 700 };
      case 'INCREASE': return { color: 'var(--success)', fontWeight: 700 };
      case 'DECREASE': return { color: 'var(--danger)', fontWeight: 700 };
      case 'DELETE': return { color: 'var(--danger)', fontWeight: 700, opacity: 0.8 };
      default: return {};
    }
  };

  const getChangeLabel = (tx) => {
    if (tx.type === 'ADD') return `+${tx.quantityChange}`;
    if (tx.type === 'DELETE') return `${tx.quantityChange}`;
    return tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange;
  };

  return (
    <div className="inventory-table-container">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Item Name</th>
            <th>Change</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {history.map((tx) => (
            <tr key={tx.id}>
              <td className="code-cell" style={{ fontSize: '0.75rem' }}>
                {formatDate(tx.timestamp)}
              </td>
              <td>
                <span style={getActionStyle(tx.type)}>
                  {tx.type}
                </span>
              </td>
              <td style={{ fontWeight: 500 }}>{tx.itemName}</td>
              <td className="qty-cell" style={getActionStyle(tx.type)}>
                {getChangeLabel(tx)}
              </td>
              <td className="qty-cell">
                {tx.newQuantity}
              </td>
            </tr>
          ))}
          {history.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                No transaction history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
