import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, X, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import db from '../store/db';
import StatusBar from '../components/StatusBar';

export default function ReviewView() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);

  const load = async () => {
    setLoading(true);
    const due = await db.getDueReviews();
    setItems(due);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleKnow = async (id: number, knew: boolean) => {
    await db.completeReview(id, knew);
    if (!knew) {
      // Reset and re-add
      const item = items.find(i => i.id === id);
      if (item) {
        await db.addReviewSchedule({
          questionId: item.questionId,
          question: item.question,
          type: item.type,
          userAnswer: item.userAnswer,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation || '',
        });
      }
    }
    setItems(prev => prev.filter(i => i.id !== id));
    setCompleted(c => c + 1);
  };

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>间隔复习</h2>
        <button onClick={load} style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 4 }}><RefreshCw size={18} /></button>
      </div>
      <div className="scroll">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <BookOpen size={40} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {completed > 0 ? '今日复习完成！' : '暂无疑问待复习'}
            </div>
            <div style={{ fontSize: 12 }}>
              {completed > 0 ? `已复习 ${completed} 题` : '答错的知识点会在 1 天后自动进入复习队列'}
            </div>
            {completed > 0 && (
              <button onClick={() => nav('/')} style={{ marginTop: 12, padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
                返回首页
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, paddingLeft: 4 }}>
              今日待复习 {items.length} 题 {completed > 0 ? `(已复习 ${completed} 题)` : ''}
            </div>
            {items.map((item, i) => (
              <div key={item.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 8, border: '2px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: item.type === 'choice' ? 'var(--success-light)' : 'var(--primary-light)', color: item.type === 'choice' ? '#00b365' : '#3370ff' }}>
                    {item.type === 'choice' ? '选择' : item.type === 'fill' ? '填空' : '简答'}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5, color: 'var(--text)', marginBottom: 6 }}>{item.question}</div>
                <div style={{ fontSize: 11, color: 'var(--rose)', marginBottom: 2 }}>你的回答: {item.userAnswer}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>正确答案: {item.correctAnswer}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleKnow(item.id, false)}
                    style={{ flex: 1, padding: '8px 0', border: '2px solid var(--rose)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <X size={14} /> 没记住
                  </button>
                  <button onClick={() => handleKnow(item.id, true)}
                    style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Check size={14} /> 记住了
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
