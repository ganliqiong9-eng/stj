import { StrictMode } from 'react'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function showFatal(msg: string) {
  if (document.getElementById('fatal-overlay')) return;
  const div = document.createElement('div');
  div.id = 'fatal-overlay';
  div.style.cssText = 'position:fixed;inset:0;background:#fff;color:#1f2329;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;font:14px/1.6 system-ui,sans-serif;text-align:center;';
  div.innerHTML = `<div style="font-size:20px;font-weight:700;">页面出错了</div><pre style="white-space:pre-wrap;color:#e63946;max-width:100%;overflow:auto;">${String(msg).replace(/</g, '&lt;')}</pre><button onclick="location.reload()" style="padding:10px 24px;border:none;border-radius:8px;background:#3370ff;color:#fff;font-size:14px;cursor:pointer;">重新加载</button>`;
  document.body.appendChild(div);
}

window.addEventListener('error', e => {
  if (e && e.message) showFatal(e.message);
});

class FatalBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown) {
    showFatal(err instanceof Error ? err.message : String(err));
  }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, fontFamily: 'system-ui', color: '#333', textAlign: 'center' }}>页面加载失败，请刷新重试</div>;
    }
    return this.props.children;
  }
}

// 清除所有已注册的 Service Worker 和缓存（防止旧版本缓存导致白屏）
if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FatalBoundary>
      <App />
    </FatalBoundary>
  </StrictMode>,
)
