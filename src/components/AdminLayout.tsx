import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/admin', label: '仪表盘', icon: '📊' },
  { path: '/admin/knowledge', label: '知识管理', icon: '📚' },
  { path: '/admin/upload', label: '批量上传', icon: '📤' },
  { path: '/admin/annotate', label: '数据标注', icon: '🏷️' },
  { path: '/admin/quiz', label: '刷题管理', icon: '📝' },
];

export default function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [ragStatus, setRagStatus] = useState('检查中...');

  useEffect(() => {
    try {
      fetch('http://localhost:8086/api/rag/status').then(r => r.json()).then(d => {
        setRagStatus(d.status === 'ready' ? 'RAG 就绪' : `RAG: ${d.status}`);
      }).catch(() => setRagStatus('RAG 离线'));
    } catch {}
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'var(--font)' }}>
      <div style={{ width: 240, minWidth: 240, background: '#1a1a2e', display: 'flex', flexDirection: 'column', flexShrink: 0, color: '#fff' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.5 }}>STJ</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>学习助手 v2.0</div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(item => {
            const active = item.path === '/admin' ? loc.pathname === '/admin' : loc.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => nav(item.path)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', border: 'none', borderLeft: active ? '3px solid #3370ff' : '3px solid transparent', background: active ? 'rgba(255,255,255,.08)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left', fontFamily: 'var(--font)', transition: 'all .2s var(--ease-out)' }}
                onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ragStatus.includes('就绪') || ragStatus.includes('keyword') ? '#00b365' : '#ff7d00', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,.45)' }}>{ragStatus}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {title && <div style={{ padding: '16px 24px', borderBottom: '1px solid #e0e0e0', background: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200 }}>{title}</div>
        </div>}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200, padding: '16px 24px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
