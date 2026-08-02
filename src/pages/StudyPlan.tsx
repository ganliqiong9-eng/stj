import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, BookOpen, RefreshCw, AlertTriangle, Target, Check } from 'lucide-react';
import db from '../store/db';
import StatusBar from '../components/StatusBar';
import { tips, type Tip } from '../data/tips';

export default function StudyPlan() {
  const nav = useNavigate();
  const [reviewCount, setReviewCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [doneToday, setDoneToday] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    (async () => {
      const [review, wrong, allK] = await Promise.all([
        db.getReviewCount(),
        db.wrongAnswers.count(),
        db.getAllKnowledge(),
      ]);
      setReviewCount(review);
      setWrongCount(wrong);
      setChunkCount(allK.reduce((s, e) => s + e.sections.length, 0));
      const today = new Date().toISOString().slice(0, 10);
      const history = await db.getQuizHistory();
      setDoneToday(history.some(h => h.date === today));
      try {
        const saved = JSON.parse(localStorage.getItem('plan_done') || '{}');
        setChecked(saved);
      } catch {}
      if (tips.length > 0) setTip(tips[Math.floor(Math.random() * tips.length)]);
    })();
  }, []);

  const tasks = [
    { key: 'review', icon: <RefreshCw size={16} />, color: '#3370ff', title: '间隔复习', desc: reviewCount > 0 ? `今日 ${reviewCount} 个知识点待复习` : '今日复习已完成', link: '/review', done: reviewCount === 0 },
    { key: 'wrong', icon: <AlertTriangle size={16} />, color: '#f53f3f', title: '错题回顾', desc: wrongCount > 0 ? `累计 ${wrongCount} 道错题，建议过一遍` : '暂无错题，继续保持', link: '/wrong-answers', done: wrongCount === 0 },
    { key: 'new', icon: <BookOpen size={16} />, color: '#00b365', title: '新学知识点', desc: `知识库共 ${chunkCount} 个知识点，建议今天学 2 个`, link: '/tutor', done: doneToday },
    { key: 'quiz', icon: <Target size={16} />, color: '#7c3aed', title: '巩固刷题', desc: doneToday ? '今天已刷题，可以再来一组' : '建议完成一组 AI 刷题', link: '/quiz', done: doneToday },
  ];

  const toggle = (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    localStorage.setItem('plan_done', JSON.stringify(next));
  };

  const doneCount = tasks.filter(t => checked[t.key] || t.done).length;
  const pct = Math.round((doneCount / tasks.length) * 100);

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>今日学习计划</h2>
        <CalendarCheck size={18} color="var(--primary)" />
      </div>
      <div className="scroll" style={{ padding: '12px 16px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 10, border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--primary)' }}>{pct}%</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>今日计划完成度</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>复习 / 错题 / 新学 / 刷题，完成一项勾一项</div>
            </div>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,var(--primary),var(--green))', width: `${pct}%`, transition: 'width .4s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(t => (
            <div key={t.key} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 12, border: '2px solid', borderColor: checked[t.key] || t.done ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
              <button onClick={() => toggle(t.key)} style={{
                width: 26, height: 26, borderRadius: '50%', border: '2px solid',
                borderColor: checked[t.key] || t.done ? 'var(--green)' : 'var(--border)',
                background: checked[t.key] || t.done ? 'var(--green)' : 'transparent',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0
              }}>
                {(checked[t.key] || t.done) && <Check size={14} />}
              </button>
              <span style={{ color: t.color, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => nav(t.link)}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.desc}</div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>›</span>
            </div>
          ))}
        </div>

        {tip && (
          <div style={{ marginTop: 10, background: 'linear-gradient(135deg,var(--primary-light),var(--green-light))', borderRadius: 'var(--radius)', padding: 14 }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>{tip.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{tip.title}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{tip.saying}</div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{tip.explain}</div>
          </div>
        )}
      </div>
    </div>
  );
}
