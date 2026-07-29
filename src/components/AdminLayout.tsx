import { ReactNode } from 'react';
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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5', fontFamily: 'var(--font)' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -.5 }}>STJ</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>管理后台</div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(item => {
            const active = item.path === '/admin' ? loc.pathname === '/admin' : loc.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => nav(item.path)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: 'none', background: active ? '#f0f7ff' : 'transparent', color: active ? '#1cb0f6' : '#555', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, textAlign: 'left', fontFamily: 'var(--font)', borderRight: active ? '3px solid #1cb0f6' : '3px solid transparent' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e0e0e0', fontSize: 11, color: '#999', textAlign: 'center' }}>
          <button onClick={() => nav('/')} style={{ border: 'none', background: 'none', color: '#1cb0f6', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font)' }}>← 返回应用</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {title && <div style={{ padding: '16px 24px', borderBottom: '1px solid #e0e0e0', background: '#fff', fontSize: 18, fontWeight: 700 }}>{title}</div>}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
