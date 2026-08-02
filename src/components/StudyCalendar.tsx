export default function StudyCalendar() {
  const days: string[] = (() => { try { return JSON.parse(localStorage.getItem('study_days') || '[]'); } catch { return []; } })();
  const today = new Date();
  const cells: { date: string; studied: boolean; day: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    cells.push({ date: d.toISOString().slice(0, 10), studied: days.includes(d.toISOString().slice(0, 10)), day: d.getDate() });
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>学习日历（30天）</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {['日','一','二','三','四','五','六'].map(d => <div key={d} style={{ fontSize: 8, color: 'var(--text-tertiary)', textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
        {new Array(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29).getDay()).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {cells.map(c => (
          <div key={c.date} style={{ aspectRatio: '1', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: c.studied ? 700 : 400, background: c.studied ? 'var(--green)' : 'var(--border-light)', color: c.studied ? '#fff' : 'var(--text-tertiary)' }}>
            {c.day}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'center' }}>{days.filter(d => d.startsWith(today.toISOString().slice(0, 7))).length} 天学习</div>
    </div>
  );
}
