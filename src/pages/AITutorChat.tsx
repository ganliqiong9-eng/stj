import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, User, RefreshCw, Send } from 'lucide-react';
import { tutorSession } from '../api';
import StatusBar from '../components/StatusBar';

interface ChatMsg {
  role: 'ai' | 'user';
  content: string;
  quiz?: any[];
}

export default function AITutorChat() {
  const nav = useNavigate();
  const [subj, setSubj] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [messages, loading]);

  const start = async () => {
    setLoading(true);
    setError('');
    const r = await tutorSession([], subj || undefined);
    if (r.ok && r.quiz && r.quiz.length > 0) {
      setAnswers({});
      setMessages([{ role: 'ai', content: r.analysis || '来，先做 5 道题热热身！', quiz: r.quiz }]);
    } else {
      setError(r.error || '启动失败，请检查 API Key 配置');
    }
    setLoading(false);
  };

  const submit = async (lastMsg: ChatMsg) => {
    const quiz = lastMsg.quiz || [];
    const lines = quiz.map((q, i) =>
      `第${i + 1}题（${q.type === 'choice' ? '选择' : q.type === 'fill' ? '填空' : '简答'}）: ${q.question}\n我的答案: ${answers[q.id] || '未作答'}\n正确答案: ${q.correctAnswer || ''}\n`
    );
    const newMessages: ChatMsg[] = [...messages, { role: 'user', content: lines.join('\n') }];
    setMessages(newMessages);
    setLoading(true);
    setError('');
    const r = await tutorSession(newMessages.map(m => ({ role: m.role, content: m.content })), subj || undefined);
    if (r.ok && r.quiz && r.quiz.length > 0) {
      setAnswers({});
      setMessages([...newMessages, { role: 'ai', content: r.analysis || '继续下一轮！', quiz: r.quiz }]);
    } else {
      setError(r.error || '出题失败，请重试');
    }
    setLoading(false);
  };

  const choiceLabel = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/quiz')} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>对话式刷题</h2>
        <select value={subj} onChange={e => setSubj(e.target.value)} style={{ border: '2px solid var(--border)', borderRadius: 8, padding: '6px 8px', fontSize: 11, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
          <option value="">全科目</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">数据分析</option><option value="dma">DAMA</option>
        </select>
      </div>

      <div ref={scrollRef} className="scroll" style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '30px 12px', color: 'var(--text-tertiary)' }}>
            <Bot size={34} strokeWidth={1.2} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>AI 刷题教练</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              每轮 5 题，答完后 AI 会分析你的薄弱点，<br />再针对性出下一轮。
            </div>
            <button onClick={start} disabled={loading}
              style={{ marginTop: 14, padding: '12px 28px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={16} /> 开始对话刷题
            </button>
          </div>
        )}

        {messages.map((m, mi) => (
          <div key={mi} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: m.role === 'ai' ? 'var(--primary)' : 'var(--green)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {m.role === 'ai' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div style={{ flex: 1, maxWidth: '86%' }}>
              <div style={{
                background: m.role === 'ai' ? 'var(--surface)' : 'var(--primary-light)',
                borderRadius: m.role === 'ai' ? 'var(--radius-sm) var(--radius-sm) var(--radius-sm) 4px' : 'var(--radius-sm) var(--radius-sm) 4px var(--radius-sm)',
                padding: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap',
                border: '1px solid var(--border-light)'
              }}>{m.content}</div>

              {m.quiz && m.quiz.map((q) => {
                const isChoice = q.type === 'choice';
                return (
                  <div key={q.id} style={{ marginTop: 6, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 10, border: '2px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: isChoice ? 'var(--success-light)' : q.type === 'fill' ? 'var(--primary-light)' : 'var(--warning-light)', color: isChoice ? '#00b365' : q.type === 'fill' ? '#3370ff' : '#ff7d00' }}>
                        {isChoice ? '选择题' : q.type === 'fill' ? '填空题' : '简答题'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{q.question}</div>
                    {isChoice && q.options?.map((opt: string, oi: number) => {
                      const label = choiceLabel(oi);
                      const sel = answers[q.id] === label;
                      return (
                        <div key={oi} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: label }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: '2px solid', cursor: 'pointer', fontSize: 12, borderColor: sel ? 'var(--primary)' : 'var(--border)', background: sel ? 'var(--primary-light)' : 'transparent' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: sel ? 'var(--primary)' : 'var(--border)', color: sel ? '#fff' : 'var(--text)' }}>{label}</span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                    {!isChoice && (
                      <textarea value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={q.type === 'fill' ? '输入答案...' : '输入你的回答...'} rows={q.type === 'fill' ? 2 : 3}
                        style={{ width: '100%', boxSizing: 'border-box', border: '2px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
                    )}
                    {answers[q.id] && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        已答: {answers[q.id]}
                      </div>
                    )}
                  </div>
                );
              })}

              {m.role === 'ai' && m.quiz && m.quiz.length > 0 && (
                <button onClick={() => submit(m)} disabled={loading}
                  style={{ marginTop: 8, padding: '10px 0', width: '100%', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading ? 'var(--border)' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {loading ? 'AI 分析中...' : <><Send size={14} /> 提交本轮答案</>}
                </button>
              )}
            </div>
          </div>
        ))}

        {messages.length > 0 && !loading && (
          <button onClick={() => { setMessages([]); setAnswers({}); setError(''); }} style={{ alignSelf: 'center', marginTop: 4, border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} /> 重新开始
          </button>
        )}

        {error && <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)' }}>{error}</div>}
      </div>
    </div>
  );
}
