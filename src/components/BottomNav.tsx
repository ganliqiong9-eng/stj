import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/quiz', icon: '✍️', label: '练习' },
  { path: '/bank', icon: '📚', label: '题库' },
  { path: '/compiler', icon: '💻', label: '编译器' },
];

export default function BottomNav() {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <nav style={{
      position:'fixed', bottom:0, left:0, right:0,
      background:'rgba(255,255,255,.95)', backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      display:'flex', padding:'2px 0 calc(env(safe-area-inset-bottom,6px))',
      borderTop:'2px solid var(--border)',
      zIndex:50
    }}>
      {navItems.map(item => {
        const active = (item.path === '/' && loc.pathname === '/') ||
          (item.path !== '/' && loc.pathname.startsWith(item.path));
        return (
          <button key={item.path} onClick={() => nav(item.path)}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              gap:'1px', padding:'6px 0 4px', border:'none', background:'none',
              cursor:'pointer', color: active ? 'var(--primary)' : 'var(--text-tertiary)',
              fontSize:'10px', fontWeight:600, fontFamily:'var(--font)',
              transition:'color .15s'
            }}>
            <span style={{fontSize:'20px', lineHeight:1, marginBottom:'1px'}}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
