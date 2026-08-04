import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import { listLearningPaths, type LearningPathSummary } from '../api';

const PATH_COLORS: Record<string, string> = {
  'dama-dmbok': '#7C3AED',
  'python-basics': '#00b365',
  'sql-fundamentals': '#3370ff',
  'english-essentials': '#DC2626',
};

export default function LearnHome() {
  const nav = useNavigate();
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const r = await listLearningPaths();
      if (r.ok) setPaths(r.paths);
      else setError(r.error || '加载失败');
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page">
      <StatusBar />
      <div style={{ padding: '14px 16px 8px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📚 学习路径</h2>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>系统学习，按部就班</div>
      </div>
      <div className="scroll">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 108, borderRadius: 'var(--radius)', background: 'var(--border)', animation: 'pulse 1.2s ease-in-out infinite' }} />
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--rose-light)', color: 'var(--rose)', fontSize: 12 }}>
            {error}
          </div>
        )}
        {paths.map(p => {
          const color = PATH_COLORS[p.id] || 'var(--primary)';
          const pct = p.progress.percent;
          return (
            <div key={p.id} onClick={() => nav(`/learn/${p.id}`)} style={{
              display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden',
              background: 'var(--surface)', border: '1.5px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)', marginBottom: 12, cursor: 'pointer',
            }}>
              <div style={{ width: 4, background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.description}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {p.progress.completed}/{p.progress.total} 知识点已学
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
