import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import db from '../store/db';
import StatusBar from '../components/StatusBar';

export default function WrongAnswersView() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    db.getWrongAnswers().then(setItems);
  }, []);

  const clearAll = async () => {
    await db.clearWrongAnswers();
    setItems([]);
  };

  const toggle = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const typeLabel = (t: string) => t === 'choice' ? '选择' : t === 'fill' ? '填空' : '简答';

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>错题回顾</h2>
        {items.length > 0 && (
          <button onClick={clearAll} style={{ border: 'none', background: 'none', color: 'var(--rose)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Trash2 size={12} /> 清空
          </button>
        )}
      </div>
      <div className="scroll">
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <BookOpen size={40} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无错题</div>
            <div style={{ fontSize: 12 }}>刷题时答错的题目会自动收录到这里</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, paddingLeft: 4 }}>共 {items.length} 道错题</div>
        )}
        {items.map((item, i) => {
          const isExpanded = expanded.has(i);
          const k = typeof item.knowledge === 'string' ? JSON.parse(item.knowledge || 'null') : item.knowledge;
          return (
            <div key={item.id || i} onClick={() => toggle(i)} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 8, border: '2px solid var(--rose-light)', cursor: 'pointer', position: 'relative' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#ffece8', color: '#f53f3f' }}>{typeLabel(item.type || 'choice')}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: 'var(--text)', marginBottom: 4, paddingRight: 20 }}>{item.question}</div>
              <div style={{ fontSize: 11, color: 'var(--rose)', marginBottom: 2 }}>你的答案: {item.userAnswer || '(未作答)'}</div>
              {isExpanded && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 2 }}>正确答案: {item.correctAnswer}</div>
                  {item.explanation && <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{item.explanation}</div>}
                  {k && (
                    <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'var(--primary-light)', fontSize: 10 }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 2 }}>知识点溯源</div>
                      {k.title && <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{k.title}</div>}
                      {k.body && <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{k.body.substring(0, 200)}</div>}
                    </div>
                  )}
                </div>
              )}
              <div style={{ position: 'absolute', right: 10, top: 10 }}>
                {isExpanded ? <ChevronDown size={16} color="var(--text-tertiary)" /> : <ChevronRight size={16} color="var(--text-tertiary)" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
