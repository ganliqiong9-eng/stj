import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const keywordResponses: Record<string, string[]> = {
  sql: [
    '**SQL 查询执行顺序**：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。记住这个顺序对理解查询行为很有帮助。',
    '**INNER JOIN vs LEFT JOIN**：INNER JOIN 只保留两表都匹配的行（交集），LEFT JOIN 保留左表所有行（右表无匹配填 NULL）。',
    '**索引优化建议**：① 给 WHERE 和 JOIN 条件中的列建索引 ② 避免在索引列上用函数 ③ 复合索引遵循最左前缀原则。',
    '**窗口函数入门**：ROW_NUMBER()、RANK()、DENSE_RANK() 是最常用的三种排名函数。配合 PARTITION BY 可以在分组内排序。',
  ],
  python: [
    '**列表推导式**：[x**2 for x in range(10)] 比 for 循环更简洁、更快。但不要过度嵌套，超过两层可读性会大幅下降。',
    '**字典的 get 方法**：dict.get(key, default) 比 dict[key] 更安全，key 不存在时返回默认值而不是抛 KeyError。',
    '**Pandas 核心技巧**：① df.groupby() 是数据分析的核心 ② merge() 替代 SQL JOIN ③ apply() 处理复杂转换。',
  ],
  data: [
    '**辛普森悖论**：分组看趋势和整体看趋势可能完全相反！做分析时既要看整体也要看分组，避免被汇总数据误导。',
    '**数据清洗黄金法则**：① 先备份原始数据 ② 处理缺失值 ③ 处理异常值 ④ 统一格式 ⑤ 去重。',
  ],
  dama: [
    '**数据治理 vs 数据管理**：数据治理是制定规则和决策权，数据管理是执行这些规则。治理定方向，管理保落地。',
    '**DAMA-DMBOK 核心领域**：数据治理、数据架构、数据建模、数据存储、数据安全、数据集成、数据质量。考试重点！',
    '**数据质量六维度**：完整性、准确性、一致性、及时性、唯一性、有效性。',
  ],
};

const generalResponses = [
  '**费曼学习法**：尝试用大白话把一个概念讲给 8 岁小孩听。如果讲不清楚，说明你没真正理解。',
  '试试问更具体的知识问题，比如「SQL 的 JOIN 怎么用」「Python 列表推导式」「数据治理核心领域」等。',
];

function getResponse(q: string): string {
  const lower = q.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [cat, kws] of Object.entries(keywordResponses)) {
    scores[cat] = kws.filter(k => lower.includes(k.toLowerCase())).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) {
    const pool = keywordResponses[best[0]];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return generalResponses[Math.floor(Math.random() * generalResponses.length)];
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([
    { role: 'assistant', content: '👋 学习中遇到不懂的？直接问我吧！' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMsgs(p => [...p, { role: 'user', content: q }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
    setMsgs(p => [...p, { role: 'assistant', content: getResponse(q) }]);
    setLoading(false);
  };

  return (
    <>
      {/* FAB button - inside page-container, absolute positioning */}
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

      {/* Modal */}
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px 10px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>AI 学习助手</div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: '#eee', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
            </div>
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
            <div style={{
              display: 'flex', gap: 8, padding: '10px 14px 14px',
              borderTop: '1px solid var(--border)', background: '#fff',
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
