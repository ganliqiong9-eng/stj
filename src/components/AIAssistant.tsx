import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

const ENDPOINT_STORAGE = 'study_buddy_endpoint';
const API_KEY_STORAGE = 'study_buddy_doubao_key';
const MODEL_STORAGE = 'study_buddy_model';

function getEndpoint(): string { return localStorage.getItem(ENDPOINT_STORAGE) || DEFAULT_ENDPOINT; }
function setEndpoint(v: string) { localStorage.setItem(ENDPOINT_STORAGE, v); }
function getApiKey(): string { return localStorage.getItem(API_KEY_STORAGE) || ''; }
function setApiKey(v: string) { localStorage.setItem(API_KEY_STORAGE, v); }
function getModel(): string { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; }
function setModel(v: string) { localStorage.setItem(MODEL_STORAGE, v); }

const localResponses = [
  '💡 当前是本地模式。请在设置中配置 API Key 即可使用 AI 回答。',
  '**费曼学习法**：尝试用大白话把一个概念讲给 8 岁小孩听。如果讲不清楚，说明你没真正理解。',
];

async function callDoubao(messages: Message[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  const endpoint = getEndpoint();
  const model = getModel();

  const body = {
    model,
    messages: [
      { role: 'system', content: '你是一个学习助手，帮助用户学习SQL、Python、数据分析、DAMA数据管理知识。请用中文回答，简洁专业，适当使用例子。' },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ],
    max_tokens: 1024,
    temperature: 0.7,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try { const d = await res.json(); detail = d.error?.message || ''; } catch(e) {}
    const msg = detail ? `${detail} (HTTP ${res.status})` : `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`API_KEY_INVALID|${msg}`);
    if (res.status === 429) throw new Error(`RATE_LIMITED|${msg}`);
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '抱歉，没有返回有效内容。';
}

function getLocalResponse(): string {
  return localResponses[Math.floor(Math.random() * localResponses.length)];
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [endpointInput, setEndpointInput] = useState(getEndpoint());
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [modelInput, setModelInput] = useState(getModel());
  const [msgs, setMsgs] = useState<Message[]>([
    { role: 'assistant', content: '👋 学习中遇到不懂的了？直接输入问题问我吧！' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);
  useEffect(() => { if (open) setShowSettings(true); }, [open]);

  const saveConfig = () => {
    setEndpoint(endpointInput);
    setApiKey(apiKeyInput);
    setModel(modelInput);
    setShowSettings(false);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const answer = await callDoubao(newMsgs);
      setMsgs(p => [...p, { role: 'assistant', content: answer }]);
    } catch (e: unknown) {
      const err = (e as Error).message;
      if (err.startsWith('NO_API_KEY')) {
        setMsgs(p => [...p, { role: 'assistant', content: '⚠️ 还没设置 API Key。请在设置中填写。' }]);
      } else if (err.startsWith('API_KEY_INVALID')) {
        setMsgs(p => [...p, { role: 'assistant', content: `⚠️ API Key 无效：${err.split('|')[1] || ''}` }]);
      } else if (err.startsWith('RATE_LIMITED')) {
        setMsgs(p => [...p, { role: 'assistant', content: `⏳ ${err.split('|')[1] || '请求受限'}\n请稍后再试。` }]);
      } else {
        const detail = err.startsWith('API_ERROR:') ? err.substring(10) : err;
        setMsgs(p => [...p, { role: 'assistant', content: `😅 API 错误：${detail}\n\n${getLocalResponse()}` }]);
      }
    } finally { setLoading(false); }
  };

  const hasKey = !!getApiKey();

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
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.4)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
            padding: '20px 12px',
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px 20px 16px 16px',
              width: '100%', maxWidth: 380, maxHeight: '75vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,.15)',
            }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px 10px', borderBottom: '1px solid #e5e5e5',
            }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  AI 学习助手
                  {hasKey ? (
                    <span style={{ fontSize: 9, background: '#e5f5d0', color: '#58cc02', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>已连接</span>
                  ) : (
                    <span style={{ fontSize: 9, background: '#fef3c7', color: '#b36b00', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>未配置</span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowSettings(!showSettings)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: showSettings ? '#1cb0f6' : '#eee',
                  color: showSettings ? '#fff' : '#666',
                  cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>⚙️</button>
              <button onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: '#eee', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
            </div>

            {/* Settings */}
            <div style={{
              display: showSettings ? 'block' : 'none',
              padding: '12px 14px', background: '#f8f9fa',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>API 配置</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6, lineHeight: 1.5 }}>
                默认使用 DeepSeek 免费 API。
                前往 <a href="https://platform.deepseek.com" style={{color:'#1cb0f6'}} target="_blank" rel="noreferrer">platform.deepseek.com</a>
                → API Keys → 创建免费 Key
              </div>
              <div style={{display:'flex',gap:6,marginBottom:5}}>
                <input value={endpointInput} onChange={e => setEndpointInput(e.target.value)}
                  placeholder="API 地址" style={{flex:1, padding:'8px 12px', border:'2px solid #e5e5e5', borderRadius:8, fontSize:12, outline:'none', fontFamily:'var(--font)'}} />
              </div>
              <div style={{display:'flex',gap:6,marginBottom:5}}>
                <input value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="API Key" style={{flex:1, padding:'8px 12px', border:'2px solid #e5e5e5', borderRadius:8, fontSize:12, outline:'none', fontFamily:'var(--font)'}} />
              </div>
              <div style={{display:'flex',gap:6}}>
                <input value={modelInput} onChange={e => setModelInput(e.target.value)}
                  placeholder="模型名 (deepseek-chat)" style={{flex:1, padding:'8px 12px', border:'2px solid #e5e5e5', borderRadius:8, fontSize:12, outline:'none', fontFamily:'var(--font)'}} />
                <button onClick={saveConfig}
                  style={{padding:'8px 14px', border:'none', borderRadius:8, background:'#1cb0f6', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)'}}>保存</button>
              </div>
            </div>

            {/* Chat */}
            <div ref={ref} style={{
              flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8,
              minHeight:160, maxHeight:350, background:'#f8f9fa',
            }}>
              {msgs.map((m, i) => (
                <div key={i} style={{display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                  <div style={{
                    maxWidth:'85%', padding:'10px 14px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: m.role === 'user' ? '#1cb0f6' : '#fff',
                    color: m.role === 'user' ? '#fff' : '#2b2b2b',
                    fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap',
                    boxShadow: m.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.06)',
                  }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{display:'flex', justifyContent:'flex-start'}}>
                  <div style={{padding:'10px 14px', borderRadius:'16px 16px 16px 4px', background:'#fff', fontSize:13, boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>思考中...</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{display:'flex', gap:8, padding:'10px 14px 14px', borderTop:'1px solid #e5e5e5', background:'#fff', borderRadius:'0 0 16px 16px'}}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="输入问题..." style={{flex:1, padding:'10px 14px', border:'2px solid #e5e5e5', borderRadius:10, fontSize:13, outline:'none', fontFamily:'var(--font)'}} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{padding:'10px 16px', border:'none', borderRadius:10, background: input.trim() ? '#1cb0f6' : '#e5e5e5', color: input.trim() ? '#fff' : '#aaa', fontSize:14, fontWeight:600, cursor: input.trim() ? 'pointer' : 'default', fontFamily:'var(--font)'}}>发送</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
