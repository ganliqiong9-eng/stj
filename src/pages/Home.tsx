import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tips, type Tip } from '../data/tips';
import { subjectData, chaptersList } from '../data/chapters';
import db from '../store/db';
import StatusBar from '../components/StatusBar';

const subjectList = ['sql', 'py', 'da', 'dma'];

function ringStyle(subj: string, pct: number): React.CSSProperties {
  const colors: Record<string, string> = {
    sql: '#7C3AED', py: '#ff9600', da: '#ce82ff', dma: '#58cc02'
  };
  const c = colors[subj] || '#1cb0f6';
  const deg = Math.round(pct * 3.6);
  return {
    background: `conic-gradient(${c} 0deg ${deg}deg, #e5e5e5 ${deg}deg 360deg)`
  };
}

export default function Home() {
  const nav = useNavigate();
  const [tip, setTip] = useState<Tip | null>(null);
  const [starred, setStarred] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const totalCount = chaptersList.length;

  const refreshStats = useCallback(async () => {
    const n = await db.getStarredCount();
    setStarred(n);
    const completed = await db.getCompletedCount();
    setCompletedCount(completed);
    const xpVal = await db.getXp();
    setXp(xpVal);
    const review = await db.getReviewCount();
    setReviewCount(review);
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  useEffect(() => {
    if (tips.length > 0) {
      setTip(tips[Math.floor(Math.random() * tips.length)]);
    }
  }, []);

  const nextTip = () => {
    if (tips.length === 0) return;
    let i: number;
    do { i = Math.floor(Math.random() * tips.length); } while (tips.length > 1 && tip && tips[i].saying === tip.saying);
    setTip(tips[i]);
  };

  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="page">
      <StatusBar />
      <div className="page-header">
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>🏠 kye-test</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700 }}>{xp} XP</span>
      </div>
      <div className="scroll">
        {/* 继续学习主卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary), #7C3AED)',
          borderRadius: 'var(--radius)', padding: '18px 18px 16px', marginBottom: 16,
          color: '#fff', cursor: 'pointer', boxShadow: '0 8px 20px rgba(124,58,237,.25)',
        }} onClick={() => nav('/subject/sql')}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: .85, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>📖 继续学习</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>JOIN 多表连接</div>
          <div style={{ fontSize: 12, opacity: .85, marginBottom: 12 }}>SQL · 5 小节 · 第 2 节</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: '#fff', width: `${pct}%`, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{pct}%</span>
          </div>
        </div>

        {/* 统计横栏 */}
        <div className="stat-row">
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => nav('/review')}>
            <div className="value" style={{ color: reviewCount > 0 ? 'var(--rose)' : 'var(--green)' }}>🔥 {reviewCount}</div>
            <div className="label">待复习</div>
          </div>
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => nav('/report')}>
            <div className="value" style={{ color: 'var(--green)' }}>📝 {completedCount}</div>
            <div className="label">已掌握</div>
          </div>
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => nav('/quiz')}>
            <div className="value" style={{ color: 'var(--orange)' }}>⭐ {starred}</div>
            <div className="label">收藏</div>
          </div>
        </div>

        <div className="section-title">📚 学习科目</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          {subjectList.map(s => {
            const sd = subjectData[s];
            return (
              <div key={s} style={{ padding: 14, cursor: 'pointer', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}
                onClick={() => nav(`/subject/${s}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
                    ...ringStyle(s, sd.pct)
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#fff', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 700
                    }}>{sd.icon}</div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{sd.name}</h4>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sd.pct}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-title">💡 今日一学</div>
        {tip && (
          <div onClick={nextTip} style={{
            background: 'linear-gradient(135deg, var(--primary-light), var(--green-light))',
            borderRadius: 'var(--radius)', padding: 16, marginBottom: 4, cursor: 'pointer',
            position: 'relative',
          }}>
            <button onClick={(e) => { e.stopPropagation(); nextTip(); }}
              style={{
                position: 'absolute', top: 12, right: 12, border: 'none',
                background: 'rgba(255,255,255,.5)', borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13
              }}>🔄</button>
            <div style={{ fontSize: 32, marginBottom: 4 }}>{tip.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{tip.title}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{tip.saying}</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{tip.explain}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--primary)', padding: '2px 10px', borderRadius: 4 }}>{tip.tag}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>点一下换一条</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
