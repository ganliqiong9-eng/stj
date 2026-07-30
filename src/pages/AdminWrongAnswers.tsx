import { useState, useEffect } from 'react';
import { BookOpen, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import db from '../store/db';

export default function AdminWrongAnswers() {
  const [wrongItems, setWrongItems] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      const items = await db.getWrongAnswers();
      setWrongItems(items);
    })();
  }, []);

  const clearAll = async () => {
    await db.clearWrongAnswers();
    setWrongItems([]);
  };

  const toggle = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const typeLabel = (t: string) => {
    if (t === 'choice') return { label: '选择', color: '#00b365', bg: '#e6f7ef' };
    if (t === 'fill') return { label: '填空', color: '#3370ff', bg: '#e8f0ff' };
    return { label: '简答', color: '#ff7d00', bg: '#fff3e0' };
  };

  return (
    <AdminLayout title="错题回顾">
      {wrongItems.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#999' }}>共 {wrongItems.length} 道错题</span>
          <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: '#f53f3f' }}>
            <Trash2 size={12} /> 清空全部
          </button>
        </div>
      )}

      {wrongItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <BookOpen size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无错题</div>
          <div style={{ fontSize: 12 }}>在刷题模式中答错的题目会出现在这里</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wrongItems.map((item, i) => {
            const tl = typeLabel(item.type || 'choice');
            const k = typeof item.knowledge === 'string' ? JSON.parse(item.knowledge) : item.knowledge;
            const isExpanded = expanded.has(i);

            return (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                <div onClick={() => toggle(i)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: tl.bg, color: tl.color }}>{tl.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1f2329', flex: 1 }}>{item.question}</span>
                    {isExpanded ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />}
                  </div>
                  <div style={{ fontSize: 11, color: '#f53f3f' }}>
                    正确答案: {item.correctAnswer}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>{item.explanation}</div>
                    {k && (
                      <div style={{ marginTop: 6, background: '#f8f9ff', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3370ff', marginBottom: 4 }}>📖 知识点溯源</div>
                        {k.title && <div style={{ fontSize: 11, fontWeight: 600, color: '#1f2329', marginBottom: 2 }}>{k.title}</div>}
                        {k.body && <div style={{ fontSize: 10, lineHeight: 1.5, color: '#555' }}>{k.body}</div>}
                        {k.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {k.tags.map((t: string, ti: number) => (
                              <span key={ti} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#e8f0ff', color: '#3370ff' }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
