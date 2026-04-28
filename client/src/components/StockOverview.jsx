import { useState, useEffect } from 'react';
import { fetchAllInventory } from '../api/uploadInventory';

export default function StockOverview({ materialCode }) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!materialCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        // Uses the in-memory cache — no extra Firestore read
        const allInventory = await fetchAllInventory();
        const data = allInventory.get(materialCode.trim()) || null;
        if (!cancelled) setInventory(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [materialCode]);

  // Format number with thousand separators and 2 decimal places
  const fmt = (num) => {
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format Firestore timestamp
  const formatDate = (ts) => {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Group stock entries by plant
  const groupByPlant = (stock) => {
    const groups = {};
    stock.forEach((entry) => {
      if (!groups[entry.plant]) {
        groups[entry.plant] = [];
      }
      groups[entry.plant].push(entry);
    });
    // Sort storage locations within each plant
    Object.keys(groups).forEach((plant) => {
      groups[plant].sort((a, b) => a.storageLocation.localeCompare(b.storageLocation));
    });
    return groups;
  };

  // Calculate plant total(s), handling mixed units
  const calcPlantTotals = (entries) => {
    const totals = {};
    entries.forEach((e) => {
      const u = e.unit || 'EA';
      totals[u] = (totals[u] || 0) + e.quantity;
    });
    return totals;
  };

  // Calculate grand total, handling mixed units
  const calcGrandTotal = (stock) => {
    const totals = {};
    stock.forEach((e) => {
      const u = e.unit || 'EA';
      totals[u] = (totals[u] || 0) + e.quantity;
    });
    return totals;
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="so-container">
        <div className="so-header">
          <span className="so-icon">📦</span>
          <span className="so-title">Stock Overview</span>
        </div>
        <div className="so-loading">
          <div className="spinner so-spinner" />
          <span>Loading inventory…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="so-container">
        <div className="so-header">
          <span className="so-icon">📦</span>
          <span className="so-title">Stock Overview</span>
        </div>
        <div className="so-error">
          <span className="so-error-icon">⚠</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Generate demo data for preview when no real data exists
  const getDemoData = () => ({
    lastUpdated: new Date(),
    isDemo: true,
    stock: [
      { plant: 'B100', storageLocation: 'RM03', quantity: 12450.50, unit: 'KG' },
      { plant: 'B100', storageLocation: 'QM01', quantity: 3200.00, unit: 'KG' },
      { plant: 'B100', storageLocation: 'EN01', quantity: 870.25, unit: 'KG' },
      { plant: 'B110', storageLocation: 'RM03', quantity: 5680.00, unit: 'KG' },
      { plant: 'B110', storageLocation: 'FG01', quantity: 1240.75, unit: 'KG' },
    ]
  });

  // Use demo data if no real data exists
  const displayData = (inventory && inventory.stock && inventory.stock.length > 0)
    ? inventory
    : getDemoData();
  const isDemo = displayData.isDemo || false;

  const plantGroups = groupByPlant(displayData.stock);
  const plants = Object.keys(plantGroups).sort();
  const grandTotal = calcGrandTotal(displayData.stock);
  const grandUnits = Object.keys(grandTotal);

  return (
    <div className={`so-container${isDemo ? ' so-demo' : ''}`}>
      <div className="so-header">
        <div className="so-header-left">
          <span className="so-icon">📦</span>
          <span className="so-title">Stock Overview</span>
          {isDemo && <span className="so-demo-badge">SAMPLE DATA</span>}
        </div>
        <span className="so-timestamp">
          {isDemo ? '📋 Upload SAP export to see real data' : `🕐 ${formatDate(displayData.lastUpdated)}`}
        </span>
      </div>

      <div className="so-plants">
        {plants.map((plant) => {
          const entries = plantGroups[plant];
          const plantTotals = calcPlantTotals(entries);
          const plantUnits = Object.keys(plantTotals);

          return (
            <div key={plant} className="so-plant-card">
              <div className="so-plant-header">
                <span className="so-plant-icon">🏭</span>
                <span className="so-plant-name">Plant: {plant}</span>
              </div>

              <div className="so-rows">
                {entries.map((entry, idx) => (
                  <div key={idx} className="so-row">
                    <span className="so-row-loc">{entry.storageLocation}</span>
                    <span className="so-row-dots" />
                    <span className="so-row-qty">{fmt(entry.quantity)}</span>
                    <span className="so-row-unit">{entry.unit || 'EA'}</span>
                  </div>
                ))}
              </div>

              <div className="so-plant-total">
                {plantUnits.map((unit) => (
                  <div key={unit} className="so-total-row">
                    <span className="so-total-label">Total {plant}</span>
                    <span className="so-total-dots" />
                    <span className="so-total-qty">{fmt(plantTotals[unit])}</span>
                    <span className="so-total-unit">{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="so-grand-total">
        {grandUnits.map((unit) => (
          <div key={unit} className="so-grand-row">
            <span className="so-grand-label">Grand Total</span>
            <span className="so-grand-dots" />
            <span className="so-grand-qty">{fmt(grandTotal[unit])}</span>
            <span className="so-grand-unit">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
