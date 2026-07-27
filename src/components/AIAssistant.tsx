import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const keywords: Record<string, string[]> = {
  sql: ['sql', 'select', 'join', 'where', 'group', 'having', 'order', 'database', '查询', '数据库', '表', '索引', '主键'],
  python: ['python', 'list', 'dict', 'tuple', 'def', 'class', 'import', 'print', '循环', '列表', '字典', '函数'],
  data: ['数据分析', 'pandas', 'dataframe', '可视化', 'matplotlib', 'seaborn', '清洗', 'etl', '报表'],
  dama: ['dama', '数据治理', '数据质量', '元数据', '数据架构', '数据安全', '数据标准', 'dmbok'],
};

function generateResponse(question: string): string {
  const q = question.toLowerCase();
  const scores: Record<string, number> = { sql: 0, python: 0, data: 0, dama: 0 };
  for (const [cat, kws] of Object.entries(keywords)) {
    scores[cat] = kws.filter(k => q.includes(k)).length;
  }
  const bestCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  const sqlResponses = [
    '**SQL 查询执行顺序**：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。记住这个顺序对理解查询行为很有帮助。',
    '**INNER JOIN vs LEFT JOIN**：INNER JOIN 只保留两表都匹配的行（交集），LEFT JOIN 保留左表所有行（右表无匹配填 NULL）。选择哪个取决于业务需求：需要全部主表数据就用 LEFT JOIN。',
    '**索引优化建议**：① 给 WHERE 和 JOIN 条件中的列建索引 ② 避免在索引列上用函数 ③ 复合索引遵循最左前缀原则 ④ 不要过度索引，会影响写入性能。',
    '**窗口函数入门**：ROW_NUMBER()、RANK()、DENSE_RANK() 是最常用的三种排名函数。配合 PARTITION BY 可以在分组内排序，非常强大。',
  ];
  const pyResponses = [
    '**列表推导式**：[x**2 for x in range(10)] 比 for 循环更简洁、更快。但不要过度嵌套，超过两层可读性会大幅下降。',
    '**字典的 get 方法**：dict.get(key, default) 比 dict[key] 更安全，key 不存在时返回默认值而不是抛 KeyError。适合处理可能缺失的键。',
    '**Pandas 核心技巧**：① df.groupby() 是数据分析的核心操作 ② merge() 替代 SQL JOIN ③ apply() 对复杂转换很有用。',
    '**生成器 vs 列表**：生成器 (yield) 按需生成值，节省内存。处理大数据集时优先考虑生成器。',
  ];
  const daResponses = [
    '**辛普森悖论**：分组看趋势和整体看趋势可能完全相反！做分析时既要看整体也要看分组，避免被汇总数据误导。',
    '**AB 测试注意**：① 样本量要足够大 ② 确保实验组和对照组只有单一变量不同 ③ 跑足够长时间。',
    '**数据清洗黄金法则**：① 先备份原始数据 ② 处理缺失值 ③ 处理异常值 ④ 统一格式 ⑤ 去重。',
  ];
  const damaResponses = [
    '**数据治理 vs 数据管理**：数据治理是制定规则和决策权，数据管理是执行这些规则。治理定方向，管理保落地。',
    '**DAMA-DMBOK 核心领域**：数据治理、数据架构、数据建模、数据存储、数据安全、数据集成、数据质量。考试重点！',
    '**数据质量六维度**：完整性、准确性、一致性、及时性、唯一性、有效性。评估时从这六维度逐一检查。',
  ];
  const generalResponses = [
    '**费曼学习法**：尝试用大白话把一个概念讲给 8 岁小孩听。如果讲不清楚，说明你没真正理解。',
    '**刻意练习**：不是简单地重复，而是① 有明确目标 ② 在舒适区边缘 ③ 及时反馈 ④ 不断调整。',
    '这个问题很有意思！建议从这几个角度思考：① 理解核心概念 ② 多动手写代码 ③ 结合工作场景 ④ 做知识输出。',
  ];

  let pool: string[];
  if (bestCat[1] > 0) {
    if (bestCat[0] === 'sql') pool = sqlResponses;
    else if (bestCat[0] === 'python') pool = pyResponses;
    else if (bestCat[0] === 'data') pool = daResponses;
    else pool = damaResponses;
  } else {
    pool = generalResponses;
  }
  const response = pool[Math.floor(Math.random() * pool.length)];
  if (bestCat[1] === 0) {
    return response + '\n\n> 💡 试试问更具体的问题，比如「SQL 的 JOIN 怎么用」「Python 列表推导式」「数据治理核心领域」等。';
  }
  return response;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 你好！我是学习助手，可以帮你解答 SQL、Python、数据分析、DAMA 相关问题。直接提问吧！' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    const answer = generateResponse(q);
    setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 74, right: 16, zIndex: 1000,
          width: 50, height: 50, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg,#1cb0f6,#0f8ac9)',
          color: '#fff', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(28,176,246,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        🤖
      </button>

      {open && (
        <div onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.4)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center',
            padding: '20px 12px',
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px 20px 16px 16px',
              width: '100%', maxWidth: 380, maxHeight: '80vh',
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
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>免费 · 知识问答</div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{
                  width: 30, height: 30, borderRadius: '50%', border: 'none',
                  background: 'var(--bg)', color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 16,
                }}>✕</button>
            </div>

            <div ref={chatRef}
              style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 10,
                minHeight: 200, maxHeight: 400,
                background: '#f8f9fa',
              }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'var(--primary)' : '#fff',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: msg.role === 'user' ? 'none' : '0 1px 4px rgba(0,0,0,.06)',
                    whiteSpace: 'pre-wrap',
                  }}>{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                    background: '#fff', fontSize: 13,
                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
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
                onKeyDown={handleKey}
                placeholder="输入你的问题..."
                style={{
                  flex: 1, padding: '10px 14px', border: '2px solid var(--border)',
                  borderRadius: 10, fontSize: 13, outline: 'none',
                  fontFamily: 'var(--font)', color: 'var(--text)',
                }} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{
                  padding: '10px 16px', border: 'none', borderRadius: 10,
                  background: input.trim() ? 'var(--primary)' : 'var(--border)',
                  color: input.trim() ? '#fff' : 'var(--text-tertiary)',
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
