import { useState, useRef, useEffect } from 'react';
import FloatingPanel from './FloatingPanel';

interface Message { role: 'user' | 'assistant'; content: string; }

const DEFAULT_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';
const ENDPOINT_KEY = 'sbuddy_endpoint';
const API_KEY = 'sbuddy_key';
const MODEL_KEY = 'sbuddy_model';

function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
function s(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }

async function callAPI(msgs: Message[]): Promise<string> {
  const key = g(API_KEY, ''); if (!key) throw new Error('NO_KEY');
  const ep = g(ENDPOINT_KEY, DEFAULT_ENDPOINT), model = g(MODEL_KEY, DEFAULT_MODEL);
  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个学习助手，帮助用户学习SQL、Python、数据分析、DAMA数据管理知识。请用中文回答，简洁专业。' },
        ...msgs.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 1024, temperature: 0.7,
    }),
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

// Mini modal thumbnail icon
function MiniChatPreview() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{display:'block'}}>
      <rect x="1" y="1" width="26" height="26" rx="6" fill="#1e1e2e" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
      <rect x="4" y="5" width="14" height="2.5" rx="1.25" fill="#313244"/>
      <rect x="10" y="10" width="15" height="2.5" rx="1.25" fill="#89b4fa" opacity="0.7"/>
      <rect x="4" y="15" width="12" height="2.5" rx="1.25" fill="#313244"/>
      <rect x="13" y="20" width="12" height="2.5" rx="1.25" fill="#313244"/>
    </svg>
  );
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

export default function AIAssistant() {
  const [showSetup, setShowSetup] = useState(!g(API_KEY, ''));
  const [keyInput, setKeyInput] = useState(g(API_KEY, ''));
  const [epInput, setEpInput] = useState(g(ENDPOINT_KEY, DEFAULT_ENDPOINT));
  const [mdInput, setMdInput] = useState(g(MODEL_KEY, DEFAULT_MODEL));
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasKey = !!g(API_KEY, '');
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);

  const save = () => {
    s(ENDPOINT_KEY, epInput); s(API_KEY, keyInput);
    s(MODEL_KEY, mdInput); setShowSetup(false);
  };

  const send = async () => {
    const q = input.trim(); if (!q || loading) return;
    setInput(''); const msgs2 = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(msgs2); setLoading(true);
    try {
      const a = await callAPI(msgs2); setMsgs(p => [...p, { role: 'assistant', content: a }]);
    } catch (e: unknown) {
      const err = (e as Error).message;
      if (err.startsWith('NO_KEY')) setMsgs(p => [...p, { role: 'assistant', content: '⚠️ 请先设置 API Key。' }]);
      else if (err.startsWith('KEY_INVALID')) setMsgs(p => [...p, { role: 'assistant', content: `⚠️ API Key 无效：${err.split('|')[1] || ''}` }]);
      else if (err.startsWith('RATE_LIMITED')) setMsgs(p => [...p, { role: 'assistant', content: `⏳ ${err.split('|')[1] || '请求受限'}` }]);
      else setMsgs(p => [...p, { role: 'assistant', content: `😅 错误：${err.startsWith('ERR:') ? err.substring(5) : err}` }]);
    } finally { setLoading(false); }
  };

  // Listen for text selection → ask AI
  useEffect(() => {
    const h = (e: Event) => { const c = e as CustomEvent; if (c.detail?.text) setInput(c.detail.text); };
    window.addEventListener('ask-ai', h);
    return () => window.removeEventListener('ask-ai', h);
  }, []);

  const panelContent = (
    <>
      {/* Draggable header + setup */}
      <div onMouseDown={e => { (window as any).__swipeRef = { active: true, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 }; }}
        onTouchStart={e => { (window as any).__swipeRef = { active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, dy: 0 }; }}
        style={{ padding: '14px 14px 10px', borderBottom: '1px solid #313244', background: showSetup ? '#313244' : '#1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showSetup ? 8 : 0 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
            AI 学习助手
            {hasKey ? <span style={{ fontSize: 10, background: '#e5f5d0', color: '#58cc02', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>已配置</span> : <span style={{ fontSize: 10, background: '#fef3c7', color: '#b36b00', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>需配置</span>}
          </span>
          <button onClick={() => setShowSetup(!showSetup)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#313244', color: '#cdd6f4', cursor: 'pointer', fontSize: 13 }}>⚙️</button>
        </div>
        {showSetup && (
          <>
            <div style={{ fontSize: 10, color: '#a6adc8', marginBottom: 6, lineHeight: 1.5 }}>
              默认 DeepSeek 免费。前往 <a href="https://platform.deepseek.com" style={{color:'#89b4fa'}} target="_blank" rel="noreferrer">platform.deepseek.com</a>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input value={epInput} onChange={e => setEpInput(e.target.value)} placeholder="API 地址"
                style={{ flex: 1, padding: '7px 10px', border: '2px solid #45475a', borderRadius: 10, fontSize: 16, outline: 'none', fontFamily: 'var(--font)', background: '#313244', color: '#cdd6f4' }} />
              <button onClick={save} style={{ padding: '7px 12px', border: 'none', borderRadius: 10, background: '#89b4fa', color: '#1e1e2e', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>保存</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="API Key"
                style={{ flex: 1, padding: '7px 10px', border: '2px solid #45475a', borderRadius: 10, fontSize: 16, outline: 'none', fontFamily: 'var(--font)', background: '#313244', color: '#cdd6f4' }} />
              <input value={mdInput} onChange={e => setMdInput(e.target.value)} placeholder="deepseek-chat"
                style={{ width: 100, padding: '7px 10px', border: '2px solid #45475a', borderRadius: 10, fontSize: 16, outline: 'none', fontFamily: 'var(--font)', background: '#313244', color: '#cdd6f4' }} />
            </div>
          </>
        )}
      </div>

      {/* Chat messages */}
      <div ref={ref} style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 140, maxHeight: 360, background: '#11111b',
      }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#585b70', fontSize: 13, padding: '20px 0' }}>
            {hasKey ? '输入问题开始学习 👇' : '填写上方 API Key 后开始提问'}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#89b4fa' : '#313244',
              color: m.role === 'user' ? '#1e1e2e' : '#cdd6f4',
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: m.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.2)',
            }}>{formatContent(m.content)}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#313244', color: '#a6adc8', fontSize: 13, boxShadow: 'none' }}>思考中...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid #313244', background: '#1e1e2e' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入问题..."
          style={{ flex: 1, padding: '10px 14px', border: '2px solid #45475a', borderRadius: 14, fontSize: 16, outline: 'none', fontFamily: 'var(--font)', background: '#313244', color: '#cdd6f4' }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{
            padding: '10px 16px', border: 'none', borderRadius: 14,
            background: input.trim() ? '#89b4fa' : '#45475a',
            color: input.trim() ? '#1e1e2e' : '#585b70',
            fontSize: 16, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'default',
            fontFamily: 'var(--font)',
          }}>发送</button>
      </div>
    </>
  );

  return (
    <FloatingPanel
      buttonContent={<MiniChatPreview />}
      idleTimeout={2000}
      idleOpacity={0.45}
    >
      {panelContent}
    </FloatingPanel>
  );
}
