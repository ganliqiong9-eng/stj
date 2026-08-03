import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import { getLearningPath, type LearningPathDetail } from '../api';

const PATH_COLORS: Record<string, string> = {
  'dama-dmbok': '#7C3AED',
  'python-basics': '#00b365',
  'sql-fundamentals': '#3370ff',
};

export default function PathDetail() {
  const { pathId = '' } = useParams<{ pathId: string }>();
  const nav = useNavigate();
  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getLearningPath(pathId);
      if (r.ok && r.path) setPath(r.path);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [pathId]);

  if (notFound) {
    return (
      <div className="page">
        <StatusBar />
        <PageHeader title="路径不存在" onBack={() => nav('/learn')} />
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤷</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>找不到该学习路径</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            可能路径 ID 有误或尚未初始化
          </div>
          <button onClick={() => nav('/learn')} style={{
            padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>返回学习路径</button>
        </div>
      </div>
    );
  }

  const color = PATH_COLORS[pathId] || 'var(--primary)';
  const lightBg = pathId === 'dama-dmbok' ? '#f3eefa' : pathId === 'python-basics' ? '#e6f7ef' : pathId === 'sql-fundamentals' ? '#e8f0ff' : 'var(--primary-light)';

  return (
    <div className="page">
      <StatusBar />
      <PageHeader title={loading ? '加载中...' : (path?.name || '学习路径')} onBack={() => nav('/learn')} />
      <div className="scroll">
        {loading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>}
        {path && (
          <>
            <div style={{ background: lightBg, borderRadius: 'var(--radius)', padding: '16px 16px 14px', marginBottom: 4 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{path.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{path.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{path.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(0,0,0,.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: color, width: `${path.progress.percent}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {path.progress.completed}/{path.progress.total} · {path.progress.percent}%
                </span>
              </div>
            </div>

            <div className="section-title">📋 章节目录</div>
            {path.chapters.map(ch => (
              <div key={ch.id} onClick={() => nav(`/learn/${path.id}/chapter/${ch.id}`)} style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '14px 16px',
                background: 'var(--surface)', border: '1.5px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color, width: 30, flexShrink: 0 }}>
                  {String(ch.order).padStart(2, '0')}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ch.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{ch.description}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {ch.progress.completed}/{ch.progress.total}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
