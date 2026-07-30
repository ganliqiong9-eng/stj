import { useLocation, useNavigate } from 'react-router-dom';
import { House, SquarePen, BookMarked, BookOpen } from 'lucide-react';

const navItems = [
  { path: '/', icon: House, label: '首页' },
  { path: '/quiz', icon: SquarePen, label: '刷题' },
  { path: '/knowledge', icon: BookMarked, label: '上传知识' },
  { path: '/compiler', icon: Code, label: '编译器' },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <nav style={{
      position:'fixed', bottom:0, left:0, right:0,
      background:'var(--bottom-nav-bg)', backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      display:'flex', padding:'2px 0 calc(env(safe-area-inset-bottom,6px))',
      borderTop:'2px solid var(--border)',
      zIndex:50
    }}>
      {navItems.map(item => {
        const active = (item.path === '/' && loc.pathname === '/') ||
          (item.path !== '/' && loc.pathname.startsWith(item.path));
        const Icon = item.icon;
        return (
          <button key={item.path} onClick={() => nav(item.path)}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:2, padding:'8px 0 6px',
              border:'none', background:'none',
              cursor:'pointer', color: active ? 'var(--primary)' : 'var(--text-tertiary)',
              fontSize:'11px', fontWeight:600, fontFamily:'var(--font)',
              transition:'color .15s'
            }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
            <span style={{marginTop:2}}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
