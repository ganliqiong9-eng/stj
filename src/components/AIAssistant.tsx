import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const API_KEY_STORAGE = 'study_buddy_doubao_key';

function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

const localResponses = [
  '💡 当前是本地模式。要获取更好的 AI 回答，请点击右上角 ⚙️ 设置你的豆包 API Key。',
  '**费曼学习法**：尝试用大白话把一个概念讲给 8 岁小孩听。如果讲不清楚，说明你没真正理解。',
  '试试问更具体的问题，比如「SQL的JOIN怎么用」「Python列表推导式」「数据治理核心领域」等。',
];

async function callDoubao(messages: Message[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const systemPrompt = '你是一个学习助手，帮助用户学习SQL、Python、数据分析、DAMA数据管理知识。请用中文回答，简洁专业，适当使用例子。';

  const body = {
    model: 'doubao-lite-32k',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ],
    max_tokens: 1024,
    temperature: 0.7,
  };

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try { const errData = await res.json(); detail = errData.error?.message || ''; } catch(e) {}
    const msg = detail ? `${detail} (HTTP ${res.status})` : `HTTP ${res.status}`;
    if (res.status === 401) { throw new Error(`API_KEY_INVALID|${msg}`); }
    if (res.status === 429) { throw new Error(`RATE_LIMITED|${msg}`); }
    throw new Error(`API_ERROR: ${msg}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '抱歉，AI 没有返回有效内容。';
}

function getLocalResponse(): string {
  return localResponses[Math.floor(Math.random() * localResponses.length)];
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [msgs, setMsgs] = useState<Message[]>([
    { role: 'assistant', content: '👋 学习中遇到不懂的了？直接输入问题问我吧！' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [msgs]);

  const saveKey = () => {
    setApiKey(apiKeyInput);
    setShowSettings(false);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs: Message[] = [...msgs, { role: 'user', content: q }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const answer = await callDoubao(newMsgs);
      setMsgs(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (e: unknown) {
      const err = (e as Error).message;
      if (err.startsWith('NO_API_KEY')) {
        setMsgs(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ 还没设置 API Key。点击右上角 ⚙️ 配置豆包 API Key 即可使用 AI 回答。'
        }]);
      } else if (err.startsWith('API_KEY_INVALID')) {
        const detail = err.split('|')[1] || '';
        setMsgs(p => [...p, { role: 'assistant', content: `⚠️ API Key 无效：${detail}\n\n请检查：\n1. API Key 是否完整正确（不含多余空格）\n2. 在火山引擎方舟确认已创建"推理接入点"（需用接入点ID作为model参数,不是模型名）\n3. 或开启"快捷推理"后用模型名 doubao-lite-32k\n\n点击 ⚙️ 修改设置。` }]);
      } else if (err.startsWith('RATE_LIMITED')) {
        const detail = err.split('|')[1] || '';
        setMsgs(p => [...p, { role: 'assistant', content: `⏳ 请求过于频繁或配额不足：${detail}\n请稍后再试。` }]);
      } else {
        const detail = err.startsWith('API_ERROR:') ? err.substring(10) : err;
        setMsgs(p => [...p, { role: 'assistant', content: `😅 API 错误：${detail}\n\n先用本地回复：\n\n${getLocalResponse()}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const hasKey = !!getApiKey();
  useEffect(() => {
    if (open && !hasKey && !showSettings) {
      setMsgs(prev => {
        if (prev.length === 1 && prev[0].content.startsWith('👋')) {
          return [{
            role: 'assistant',
            content: '👋 欢迎！你需要先设置豆包 API Key 才能使用 AI 问答。\n\n点击右上角 <b>⚙️ 设置</b> 按钮，粘贴你的 API Key 后保存即可使用。\n\n还没有 Key？前往火山引擎方舟平台创建免费 API Key。'
          }];
        }
        return prev;
      });
    }
  }, [open]);

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
          opacity: hasKey ? 1 : 0.8,
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
                <div style={{ fontSize: 11, color: '#aaa' }}>
                  {hasKey ? '豆包 · 火山引擎' : '需设置 API Key'}
                </div>
              </div>
              <button onClick={() => setShowSettings(!showSettings)}
                title="设置 API Key"
                style={{
                  width: hasKey ? 28 : 34, height: hasKey ? 28 : 34,
                  borderRadius: '50%', border: hasKey ? 'none' : '2px solid #1cb0f6',
                  background: hasKey ? (showSettings ? '#1cb0f6' : '#eee') : '#fff',
                  color: hasKey ? (showSettings ? '#fff' : '#666') : '#1cb0f6',
                  cursor: 'pointer', fontSize: hasKey ? 14 : 16,
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: hasKey ? 'none' : 'pulse 2s infinite',
                }}>⚙️</button>
              <button onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: '#eee', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div style={{
                padding: '12px 14px', background: '#f8f9fa',
                borderBottom: '1px solid #e5e5e5',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>设置豆包 API Key</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                  前往 <a href="https://console.volcengine.com/ark" target="_blank" rel="noreferrer" style={{ color: '#1cb0f6' }}>火山引擎方舟平台</a>
                  → 模型推理 → 创建API Key，免费额度可使用 doubao-lite-32k 模型。
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="输入你的 API Key..."
                    style={{
                      flex: 1, padding: '8px 12px', border: '2px solid #e5e5e5',
                      borderRadius: 8, fontSize: 12, outline: 'none',
                      fontFamily: 'var(--font)',
                    }} />
                  <button onClick={saveKey}
                    style={{
                      padding: '8px 14px', border: 'none', borderRadius: 8,
                      background: '#1cb0f6', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'var(--font)',
                    }}>保存</button>
                </div>
              </div>
            )}

            {/* Chat area */}
            <div ref={ref}
              style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                minHeight: 160, maxHeight: 350, background: '#f8f9fa',
              }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: m.role === 'user' ? '#1cb0f6' : '#fff',
                    color: m.role === 'user' ? '#fff' : '#2b2b2b',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: m.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.06)',
                    whiteSpace: 'pre-wrap',
                  }}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                    background: '#fff', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  }}>思考中...</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              display: 'flex', gap: 8, padding: '10px 14px 14px',
              borderTop: '1px solid #e5e5e5', background: '#fff',
              borderRadius: '0 0 16px 16px',
            }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="输入问题..."
                style={{
                  flex: 1, padding: '10px 14px', border: '2px solid #e5e5e5',
                  borderRadius: 10, fontSize: 13, outline: 'none',
                  fontFamily: 'var(--font)',
                }} />
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
