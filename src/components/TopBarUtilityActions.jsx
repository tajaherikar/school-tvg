import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function getStorageSnapshot() {
  if (typeof window === 'undefined') return { attendanceSets: 0, resultsSets: 0 };

  const keys = Object.keys(window.localStorage);
  return {
    attendanceSets: keys.filter((key) => key.startsWith('tvg_att_marks_')).length,
    resultsSets: keys.filter((key) => key.startsWith('tvg_res_marks_')).length,
  };
}

function downloadBackup() {
  const payload = {};
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('tvg_'))
    .forEach((key) => {
      payload[key] = window.localStorage.getItem(key);
    });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tvg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clearAcademicData() {
  const keys = Object.keys(window.localStorage).filter((key) => key.startsWith('tvg_att_') || key.startsWith('tvg_res_'));
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export default function TopBarUtilityActions({ searchQuery, onSearchChange, onLogout }) {
  const [activePanel, setActivePanel] = useState('');
  const [snapshotTick, setSnapshotTick] = useState(0);
  const wrapperRef = useRef(null);
  const snapshot = useMemo(() => getStorageSnapshot(), [snapshotTick]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setActivePanel('');
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function togglePanel(panel) {
    setSnapshotTick((value) => value + 1);
    setActivePanel((current) => (current === panel ? '' : panel));
  }

  function handleClearSearch() {
    onSearchChange('');
    setActivePanel('');
  }

  function handleBackupDownload() {
    downloadBackup();
    setActivePanel('');
  }

  function handleClearData() {
    const confirmed = window.confirm('Clear all saved attendance and results data from this browser?');
    if (!confirmed) return;
    clearAcademicData();
    setActivePanel('');
    window.location.reload();
  }

  return (
    <div className="stitch-top-utility" ref={wrapperRef}>
      <button type="button" aria-label="Notifications" className="stitch-icon-btn" onClick={() => togglePanel('notifications')}>
        <span className="material-symbols-outlined">notifications</span>
        <i />
      </button>

      <button type="button" aria-label="Settings" className="stitch-icon-btn" onClick={() => togglePanel('settings')}>
        <span className="material-symbols-outlined">settings</span>
      </button>

      {activePanel === 'notifications' ? (
        <div className="stitch-popover-panel">
          <h4>Notifications</h4>
          <p>Attendance datasets: {snapshot.attendanceSets}</p>
          <p>Result datasets: {snapshot.resultsSets}</p>
          {searchQuery ? <p>Active search: {searchQuery}</p> : <p>No active search filter.</p>}
          <div className="stitch-popover-links">
            <Link to="/attendance" onClick={() => setActivePanel('')}>Go to Attendance</Link>
            <Link to="/results" onClick={() => setActivePanel('')}>Go to Results</Link>
            <Link to="/reports" onClick={() => setActivePanel('')}>Go to Reports</Link>
          </div>
        </div>
      ) : null}

      {activePanel === 'settings' ? (
        <div className="stitch-popover-panel">
          <h4>Settings</h4>
          <div className="stitch-popover-actions">
            <button type="button" onClick={handleClearSearch} disabled={!searchQuery}>Clear Search</button>
            <button type="button" onClick={handleBackupDownload}>Download Backup</button>
            <button type="button" onClick={handleClearData}>Clear Academic Data</button>
            {typeof onLogout === 'function' ? <button type="button" onClick={onLogout}>Logout</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
