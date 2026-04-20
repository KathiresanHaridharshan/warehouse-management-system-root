import { useState, useRef } from 'react';
import { processAndUploadInventory } from '../api/uploadInventory';

const STEPS = [
  { id: 1, label: 'Parse' },
  { id: 2, label: 'Upload File' },
  { id: 3, label: 'Clear Old' },
  { id: 4, label: 'Write Data' },
  { id: 5, label: 'Done' }
];

export default function InventoryUpload({ onToast }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setError('Please select a valid Excel file (.xlsx)');
      setFile(null);
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);
    setProgress({ step: 0, message: 'Starting…', percentage: 0 });

    try {
      const res = await processAndUploadInventory(file, (p) => {
        setProgress(p);
      });

      setResult(res.stats);
      setProgress({ step: 5, message: 'Upload complete!', percentage: 100 });
      onToast && onToast(
        `Uploaded successfully. ${res.stats.totalMaterials.toLocaleString()} materials updated across ${res.stats.totalPlants} plant${res.stats.totalPlants !== 1 ? 's' : ''}.`
      );
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setProgress(null);
      onToast && onToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setProgress(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="iu-container admin-card">
      <div className="card-header">
        <h3>📊 Upload SAP Inventory</h3>
        <span className="badge">Daily Export</span>
      </div>

      <div className="iu-body">
        {/* File Drop Zone */}
        {!uploading && !result && (
          <div
            className={`iu-dropzone${dragOver ? ' iu-dragover' : ''}${file ? ' iu-has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              hidden
            />

            {file ? (
              <div className="iu-file-info">
                <span className="iu-file-icon">📄</span>
                <div className="iu-file-details">
                  <span className="iu-file-name">{file.name}</span>
                  <span className="iu-file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  className="iu-file-remove"
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="iu-drop-content">
                <span className="iu-drop-icon">📥</span>
                <span className="iu-drop-text">Drop SAP Excel file here</span>
                <span className="iu-drop-sub">or click to browse (.xlsx)</span>
              </div>
            )}
          </div>
        )}

        {/* Progress Indicator */}
        {uploading && progress && (
          <div className="iu-progress-container">
            <div className="iu-progress-steps">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`iu-step${progress.step >= step.id ? ' iu-step-done' : ''}${progress.step === step.id ? ' iu-step-active' : ''}`}
                >
                  <div className="iu-step-dot">
                    {progress.step > step.id ? '✓' : step.id}
                  </div>
                  <span className="iu-step-label">{step.label}</span>
                </div>
              ))}
            </div>

            <div className="iu-progress-bar-track">
              <div
                className="iu-progress-bar-fill"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="iu-progress-message">
              <div className="spinner iu-mini-spinner" />
              <span>{progress.message}</span>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && !uploading && (
          <div className="iu-result">
            <div className="iu-result-icon">✅</div>
            <div className="iu-result-title">Upload Complete!</div>
            <div className="iu-result-stats">
              <div className="iu-stat">
                <span className="iu-stat-value">{result.totalMaterials.toLocaleString()}</span>
                <span className="iu-stat-label">Materials</span>
              </div>
              <div className="iu-stat">
                <span className="iu-stat-value">{result.totalPlants}</span>
                <span className="iu-stat-label">Plants</span>
              </div>
              <div className="iu-stat">
                <span className="iu-stat-value">{result.totalRows.toLocaleString()}</span>
                <span className="iu-stat-label">Rows Processed</span>
              </div>
              {result.skippedRows > 0 && (
                <div className="iu-stat iu-stat-warn">
                  <span className="iu-stat-value">{result.skippedRows.toLocaleString()}</span>
                  <span className="iu-stat-label">Skipped</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="iu-error">
            <span className="iu-error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="iu-actions">
          {result ? (
            <button className="btn btn-secondary" onClick={handleReset}>
              📊 Upload Another File
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? 'Processing…' : '🚀 Upload & Process'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
