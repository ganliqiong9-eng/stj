import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; }

const ENDPOINT_KEY = 'sbuddy_endpoint', API_KEY = 'sbuddy_key', MODEL_KEY = 'sbuddy_model';
const DEFAULT_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
function s(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }

async function callAPI(msgs: Message[]): Promise<string> {
  const key = g(API_KEY, ''); if (!key) throw new Error('NO_KEY');
  const ep = g(ENDPOINT_KEY, DEFAULT_ENDPOINT), model = g(MODEL_KEY, DEFAULT_MODEL);
  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: '你是一个学习助手，帮助用户学习SQL、Python、数据分析、DAMA数据管理知识。请用中文回答，简洁专业。' }, ...msgs.map(m => ({ role: m.role, content: m.content }))], max_tokens: 1024, temperature: 0.7 }),
  });
  if (!res.ok) {
    let d = ''; try { const j = await res.json(); d = j.error?.message || ''; } catch {}
    const m = d ? `${d} (HTTP ${res.status})` : `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`KEY_INVALID|${m}`);
    if (res.status === 429) throw new Error(`RATE_LIMITED|${m}`);
    throw new Error(`ERR: ${m}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(无返回)';
}

function formatContent(text: string): React.ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((p, i) => {
    if (p.startsWith('```')) {
      const code = p.replace(/```\w*\n?/, '').replace(/```$/, '');
      return <pre key={i} style={{background:'#11111b', borderRadius:8, padding:'10px 12px', fontSize:11, fontFamily:'var(--mono)', overflowX:'auto', lineHeight:1.5, color:'#cdd6f4', margin:'4px 0'}}>{code}</pre>;
    }
    const segs = p.split(/(\*\*.*?\*\*|`.*?`)/g);
    return <span key={i}>{segs.map((s, j) => {
      if (s.startsWith('**') && s.endsWith('**')) return <strong key={j} style={{fontWeight:700}}>{s.slice(2,-2)}</strong>;
      if (s.startsWith('`') && s.endsWith('`')) return <code key={j} style={{background:'#313244', padding:'1px 5px', borderRadius:4, fontSize:11, color:'#fab387'}}>{s.slice(1,-1)}</code>;
      const lines = s.split('\n');
      return lines.map((l, k) => <span key={`${j}-${k}`}>{k>0 && <br/>}{l}</span>);
    })}</span>;
  });
}

function ChatIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/>
  </svg>);
}

const BTN = 46;

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [keyInput, setKeyInput] = useState(g(API_KEY, ''));
  const [epInput, setEpInput] = useState(g(ENDPOINT_KEY, DEFAULT_ENDPOINT));
  const [mdInput, setMdInput] = useState(g(MODEL_KEY, DEFAULT_MODEL));
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [snapped, setSnapped] = useState(false);
  const posRef = useRef(pos);
  const drag = useRef(false);
  const start = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const wasSnapped = useRef(false);

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { setPos({ x: window.innerWidth - BTN - 16, y: window.innerHeight - 160 }); }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);
  useEffect(() => {
    const h = (e: Event) => { const c = e as CustomEvent; if (c.detail?.text) { setOpen(true); setInput(c.detail.text); } };
    window.addEventListener('ask-ai', h);
    return () => window.removeEventListener('ask-ai', h);
  }, []);

  // Global drag listeners
  useEffect(() => {
    const move = (cx: number, cy: number) => {
      if (!drag.current) return;
      setPos({ x: start.current.px + cx - start.current.mx, y: start.current.py + cy - start.current.my });
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = false;
      const p = posRef.current;
      const w = window.innerWidth, M = 50;
      if (wasSnapped.current) {
        wasSnapped.current = false;
        const d = Math.min(p.x + 4, w - p.x);
        if (d > 40) { setOpen(true); return; }
      }
      if (p.x < M) { setPos({ x: -1, y: p.y }); setSnapped(true); }
      else if (p.x + BTN > w - M) { setPos({ x: w - 3, y: p.y }); setSnapped(true); }
    };
    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const mu = () => up();
    const tm = (e: TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY);
    const te = () => up();
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.addEventListener('touchmove', tm);
    document.addEventListener('touchend', te);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); };
  }, []);

  const onDown = (cx: number, cy: number) => {
    if (snapped) { setSnapped(false); }
    drag.current = true;
    wasSnapped.current = snapped;
    start.current = { mx: cx, my: cy, px: posRef.current.x, py: posRef.current.y };
  };

  const hasKey = !!g(API_KEY, '');
  const save = () => { s(ENDPOINT_KEY, epInput); s(API_KEY, keyInput); s(MODEL_KEY, mdInput); setShowSetup(false); };

  const send = async () => {
    const q = input.trim(); if (!q || loading) return;
    setInput(''); const msgs2 = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(msgs2); setLoading(true);
    try {
      const a = await callAPI(msgs2); setMsgs(p => [...p, { role: 'assistant', content: a }]);
    } catch (e: unknown) {
      const err = (e as Error).message;
      if (err.startsWith('NO_KEY')) setMsgs(p => [...p, { role: 'assistant', content: '⚠️ 请先在上方填写 API Key 并保存。' }]);
      else if (err.startsWith('KEY_INVALID')) setMsgs(p => [...p, { role: 'assistant', content: `⚠️ API Key 无效：${err.split('|')[1] || ''}` }]);
      else if (err.startsWith('RATE_LIMITED')) setMsgs(p => [...p, { role: 'assistant', content: `⏳ ${err.split('|')[1] || '请求受限'}` }]);
      else setMsgs(p => [...p, { role: 'assistant', content: `😅 错误：${err.startsWith('ERR:') ? err.substring(5) : err}` }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Draggable button */}
      <button onMouseDown={e => onDown(e.clientX, e.clientY)}
        onTouchStart={e => onDown(e.touches[0].clientX, e.touches[0].clientY)}
        onClick={() => { if (!drag.current) setOpen(true); }}
        style={{
          position: 'fixed', zIndex: 900, left: pos.x, top: pos.y,
          width: snapped ? 4 : BTN, height: BTN,
          borderRadius: snapped ? (pos.x > window.innerWidth / 2 ? '2px 0 0 2px' : '0 2px 2px 0') : '50%', border: 'none',
          background: snapped ? '#2b2b2b' : 'linear-gradient(135deg,#ff6b6b,#ee5a24,#f093fb)',
          color: '#fff', cursor: snapped ? 'pointer' : 'grab',
          boxShadow: '0 4px 16px rgba(238,90,36,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: drag.current ? 'none' : 'left .3s ease, width .3s ease, border-radius .3s ease, background .3s ease',
          touchAction: 'none', overflow: 'hidden',
        }}>
        {!snapped && <ChatIcon />}
      </button>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px 12px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1e1e2e', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,.4), 0 4px 16px rgba(0,0,0,.2)' }}>

            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #313244', background: showSetup ? '#313244' : '#1e1e2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showSetup ? 8 : 0 }}>
                <span style={{ fontSize: 18 }}>💬</span>
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
                  AI 学习助手
                  {hasKey ? <span style={{ fontSize: 10, background: '#e5f5d0', color: '#58cc02', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>已配置</span> : <span style={{ fontSize: 10, background: '#fef3c7', color: '#b36b00', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>需配置</span>}
                </span>
                <button onClick={() => setShowSetup(!showSetup)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#313244', color: '#cdd6f4', cursor: 'pointer', fontSize: 13 }}>⚙️</button>
                <button onClick={() => setOpen(false)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#313244', color: '#cdd6f4', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
              {showSetup && (
                <>
                  <div style={{ fontSize: 10, color: '#a6adc8', marginBottom: 6, lineHeight: 1.5 }}>
                    默认 DeepSeek 免费。前往 <a href="https://platform.deepseek.com" style={{color:'#89b4fa'}} target="_blank" rel="noreferrer">platform.deepseek.com</a> → API Keys
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input value={epInput} onChange={e => setEpInput(e.target.value)} placeholder="API 地址" style={{ flex: 1, padding: '7px 10px', border: '2px solid #45475a', background: '#313244', color: '#cdd6f4', borderRadius: 10, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                    <button onClick={save} style={{ padding: '7px 12px', border: 'none', borderRadius: 10, background: '#89b4fa', color: '#1e1e2e', boxShadow: '0 2px 8px rgba(137,180,250,.3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>保存</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="API Key" style={{ flex: 1, padding: '7px 10px', border: '2px solid #45475a', background: '#313244', color: '#cdd6f4', borderRadius: 10, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                    <input value={mdInput} onChange={e => setMdInput(e.target.value)} placeholder="deepseek-chat" style={{ width: 100, padding: '7px 10px', border: '2px solid #45475a', background: '#313244', color: '#cdd6f4', borderRadius: 10, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                  </div>
                </>
              )}
            </div>

            <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140, maxHeight: 360, background: '#11111b' }}>
              {msgs.length === 0 && <div style={{ textAlign: 'center', color: '#585b70', fontSize: 13, padding: '20px 0' }}>{hasKey ? '输入问题开始学习 👇' : '填写上方 API Key 并保存后开始提问'}</div>}
              {msgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.role === 'user' ? '#89b4fa' : '#313244', color: m.role === 'user' ? '#1e1e2e' : '#cdd6f4', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', boxShadow: m.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.2)' }}>{formatContent(m.content)}</div>
                </div>
              ))}
              {loading && <div style={{ display: 'flex', justifyContent: 'flex-start' }}><div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#313244', color: '#a6adc8', fontSize: 13, boxShadow: 'none' }}>思考中...</div></div>}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid #313244', background: '#1e1e2e' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="输入问题..." style={{ flex: 1, padding: '10px 14px', border: '2px solid #45475a', background: '#313244', color: '#cdd6f4', borderRadius: 14, fontSize: 13, outline: 'none', fontFamily: 'var(--font)' }} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{ padding: '10px 16px', border: 'none', borderRadius: 14, background: input.trim() ? '#89b4fa' : '#45475a', color: input.trim() ? '#1e1e2e' : '#585b70', fontSize: 14, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>发送</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
