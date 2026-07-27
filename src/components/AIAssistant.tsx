import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';
const ENDPOINT_KEY = 'sbuddy_endpoint';
const API_KEY = 'sbuddy_key';
const MODEL_KEY = 'sbuddy_model';

function g(key: string, def: string): string { try { return localStorage.getItem(key) || def; } catch { return def; } }
function s(key: string, v: string) { try { localStorage.setItem(key, v); } catch {} }

async function callAPI(messages: Message[]): Promise<string> {
  const key = g(API_KEY, '');
  if (!key) throw new Error('NO_KEY');
  const ep = g(ENDPOINT_KEY, DEFAULT_ENDPOINT);
  const model = g(MODEL_KEY, DEFAULT_MODEL);
  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个学习助手，帮助用户学习SQL、Python、数据分析、DAMA数据管理知识。请用中文回答，简洁专业。' },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    let d = '';
    try { const j = await res.json(); d = j.error?.message || ''; } catch {}
    const msg = d ? `${d} (HTTP ${res.status})` : `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`KEY_INVALID|${msg}`);
    if (res.status === 429) throw new Error(`RATE_LIMITED|${msg}`);
    throw new Error(`ERR: ${msg}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(无返回)';
}

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

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);
  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.text) { setOpen(true); setInput(ce.detail.text); }
    };
    window.addEventListener('ask-ai', h);
    return () => window.removeEventListener('ask-ai', h);
  }, []);

  const hasKey = !!g(API_KEY, '');

  const save = () => {
    s(ENDPOINT_KEY, epInput);
    s(API_KEY, keyInput);
    s(MODEL_KEY, mdInput);
    setShowSetup(false);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const msgs2 = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(msgs2);
    setLoading(true);
    try {
      const a = await callAPI(msgs2);
      setMsgs(p => [...p, { role: 'assistant', content: a }]);
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
      <button onClick={() => setOpen(true)}
        style={{
          position: 'absolute', bottom: 62, right: 12, zIndex: 900,
          width: 46, height: 46, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg,#1cb0f6,#0f8ac9)',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          boxShadow: '0 3px 12px rgba(28,176,246,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        🤖
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px 12px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px 20px 16px 16px',
              width: '100%', maxWidth: 380, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,.15)',
            }}>

            {/* Always-visible setup form */}
            <div style={{
              padding: '14px 14px 10px', borderBottom: '1px solid #eee',
              background: showSetup ? '#f0f7ff' : '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showSetup ? 8 : 0 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
                  AI 学习助手
                  {hasKey ? <span style={{ fontSize: 10, background: '#e5f5d0', color: '#58cc02', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>已配置</span> : <span style={{ fontSize: 10, background: '#fef3c7', color: '#b36b00', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>需配置</span>}
                </span>
                <button onClick={() => setShowSetup(!showSetup)}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#eee', cursor: 'pointer', fontSize: 13 }}>⚙️</button>
                <button onClick={() => setOpen(false)}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#eee', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>

              {showSetup && (
                <>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 6, lineHeight: 1.5 }}>
                    默认 DeepSeek 免费。前往 <a href="https://platform.deepseek.com" style={{color:'#1cb0f6'}} target="_blank" rel="noreferrer">platform.deepseek.com</a> → API Keys 创建免费 Key
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input value={epInput} onChange={e => setEpInput(e.target.value)} placeholder="API 地址"
                      style={{ flex: 1, padding: '7px 10px', border: '2px solid #e5e5e5', borderRadius: 6, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                    <button onClick={save}
                      style={{ padding: '7px 12px', border: 'none', borderRadius: 6, background: '#1cb0f6', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>保存</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="API Key"
                      style={{ flex: 1, padding: '7px 10px', border: '2px solid #e5e5e5', borderRadius: 6, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                    <input value={mdInput} onChange={e => setMdInput(e.target.value)} placeholder="deepseek-chat"
                      style={{ width: 100, padding: '7px 10px', border: '2px solid #e5e5e5', borderRadius: 6, fontSize: 11, outline: 'none', fontFamily: 'var(--font)' }} />
                  </div>
                </>
              )}
            </div>

            {/* Chat messages */}
            <div ref={ref}
              style={{
                flex: 1, overflowY: 'auto', padding: '10px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                minHeight: 140, maxHeight: 360, background: '#f8f9fa',
              }}>
              {msgs.length === 0 && (
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, padding: '20px 0' }}>
                  {hasKey ? '输入问题开始学习 👇' : '填写上方 API Key 并保存后开始提问'}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: m.role === 'user' ? '#1cb0f6' : '#fff',
                    color: m.role === 'user' ? '#fff' : '#2b2b2b',
                    fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    boxShadow: m.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.06)',
                  }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#fff', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>思考中...</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid #eee', background: '#fff', borderRadius: '0 0 16px 16px' }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="输入问题..."
                style={{ flex: 1, padding: '10px 14px', border: '2px solid #e5e5e5', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'var(--font)' }} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{
                  padding: '10px 16px', border: 'none', borderRadius: 10,
                  background: input.trim() ? '#1cb0f6' : '#e5e5e5',
                  color: input.trim() ? '#fff' : '#aaa',
                  fontSize: 14, fontWeight: 600,
                  cursor: input.trim() ? 'pointer' : 'default',
                  fontFamily: 'var(--font)',
                }}>发送</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
