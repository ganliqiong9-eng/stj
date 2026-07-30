import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Filter, ChevronDown, ChevronRight, Loader, Sparkles } from 'lucide-react';
import StatusBar from '../components/StatusBar';
import { getKnowledgePoints } from '../api';

const CERT_TYPES = [
  { key: '', label: '全部', icon: '📚' },
  { key: 'caie', label: 'CAIE AI', icon: '🤖' },
  { key: 'cda', label: 'CDA 分析师', icon: '📊' },
  { key: 'cdmp', label: 'CDMP 数据管理', icon: '🏛️' },
  { key: 'python', label: 'Python', icon: '🐍' },
  { key: 'procurement', label: '采购管理', icon: '📦' },
  { key: 'sql', label: 'SQL', icon: '🗃️' },
];

export default function Library() {
  const nav = useNavigate();
  const [cert, setCert] = useState('');
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    const r = await getKnowledgePoints({ cert: cert || undefined, limit: 100 });
    if (r.ok) setPoints(r.items);
    setLoading(false);
  };

  useEffect(() => { load(); }, [cert]);

  const toggle = (i: number) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  };

  const diffBadge = (d: number) => {
    if (d <= 2) return { label: '简单', color: '#00b365', bg: '#e6f7ef' };
    if (d <= 3) return { label: '中等', color: '#ff7d00', bg: '#fff3e0' };
    return { label: '困难', color: '#f53f3f', bg: '#ffece8' };
  };

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>资料库</h2>
      </div>

      {/* Cert type tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 12px 8px', overflowX: 'auto' }}>
        {CERT_TYPES.map(c => (
          <span key={c.key} onClick={() => setCert(c.key)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '2px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font)',
              borderColor: cert === c.key ? 'var(--primary)' : 'var(--border)',
              background: cert === c.key ? 'var(--primary)' : 'var(--surface)',
              color: cert === c.key ? '#fff' : 'var(--text-secondary)' }}>
            {c.icon} {c.label}
          </span>
        ))}
      </div>

      <div className="scroll">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
        ) : points.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <BookOpen size={40} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无知识点</div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>上传资料后，AI 会自动拆解为知识点<br />在「知识中心」上传文档即可</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, paddingLeft: 4 }}>共 {points.length} 个知识点</div>
            {points.map((p, i) => {
              const isExpanded = expanded.has(i);
              const db = diffBadge(p.difficulty || 3);
              return (
                <div key={p.id || i} onClick={() => toggle(i)} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 6, border: '2px solid var(--border-light)', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: db.bg, color: db.color }}>{db.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>重要度: {'⭐'.repeat(p.importance || 3)}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                      {(p.tags || []).slice(0, 2).map((t: string, ti: number) => (
                        <span key={ti} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>{t}</span>
                      ))}
                    </div>
                    {isExpanded ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.title}</div>
                  {isExpanded && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 6 }}>{p.content}</div>
                      {p.mnemonic && (
                        <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--warning-light)', fontSize: 10, lineHeight: 1.5, color: 'var(--text)' }}>
                          <Sparkles size={10} style={{ display: 'inline', marginRight: 4 }} />
                          {p.mnemonic}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
