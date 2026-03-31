import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import FloorPlanView from './components/FloorPlanView';
import PalletGrid from './components/PalletGrid';
import InventoryTable from './components/InventoryTable';
import HistoryTable from './components/HistoryTable';
import DetailModal from './components/DetailModal';
import AdminPanel from './components/AdminPanel';
import { fetchMaterials, fetchHistory } from './api/materials';

export default function App() {
  const [view, setView] = useState('floorplan');
  const [materials, setMaterials] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const loadMaterials = useCallback(async (searchQuery = '') => {
    try {
      const data = await fetchMaterials(searchQuery);
      setMaterials(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') {
      loadHistory();
    } else {
      loadMaterials(search);
    }
  }, [view, loadMaterials, loadHistory]);

  useEffect(() => {
    if (view === 'history') return;
    const timer = setTimeout(() => {
      loadMaterials(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadMaterials, view]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleCardClick = (material) => {
    setSelectedMaterial(material);
  };

  const handleModalClose = () => {
    setSelectedMaterial(null);
  };

  const handleUpdated = () => {
    loadMaterials(search);
    addToast('Quantity updated successfully');
  };

  const filledCount = materials.length;
  const lowCount = materials.filter((m) => m.isLowStock).length;

  const getPageTitle = () => {
    switch (view) {
      case 'floorplan': return 'Floor Plan';
      case 'home': return 'Materials';
      case 'inventory': return 'Inventory Management';
      case 'history': return 'Transaction History';
      case 'admin': return 'Admin Control Panel';
      default: return '';
    }
  };

  const renderContent = () => {
    if (view === 'floorplan') {
      return (
        <FloorPlanView
          materials={materials}
          onCardClick={handleCardClick}
          onToast={addToast}
        />
      );
    }

    if (loading) {
      return (
        <div className="loading-container">
          <div className="spinner" />
        </div>
      );
    }

    switch (view) {
      case 'home':
        return (
          <PalletGrid 
            materials={materials} 
            onCardClick={handleCardClick} 
            filledCount={filledCount}
            lowCount={lowCount}
          />
        );
      case 'inventory':
        return <InventoryTable materials={materials} onRowClick={handleCardClick} />;
      case 'history':
        return <HistoryTable history={history} />;
      case 'admin':
        return (
          <AdminPanel
            materials={materials}
            onRefresh={() => loadMaterials(search)}
            onToast={addToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="layout-container">
      <Header view={view} onViewChange={setView} />
      
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>
          <div className="top-bar-right">
            {view !== 'floorplan' && (
              <SearchBar
                value={search}
                onChange={setSearch}
                filledCount={filledCount}
                lowCount={lowCount}
              />
            )}
          </div>
        </header>

        <div className="content-area">
          {renderContent()}
        </div>
      </main>

      {selectedMaterial && (
        <DetailModal
          material={selectedMaterial}
          onClose={handleModalClose}
          onUpdated={handleUpdated}
        />
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✓' : '⚠'} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
