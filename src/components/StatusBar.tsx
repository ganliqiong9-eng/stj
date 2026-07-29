export default function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="10" viewBox="0 0 14 10" style={{ display: 'block' }}>
          <rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor" />
          <rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor" />
          <rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor" />
          <rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor" />
        </svg>
        <svg width="18" height="10" viewBox="0 0 18 10" style={{ display: 'block' }}>
          <rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor" />
          <rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}
