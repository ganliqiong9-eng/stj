import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import db from '../store/db';
import { subjNames } from '../data/questions';
import StatusBar from '../components/StatusBar';

interface QItem {
  id: string; q: string; opts: string[]; a: number; subj: string; star: boolean;
}

export default function Quiz() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [starFilter, setStarFilter] = useState(false);
  const [activeSubj, setActiveSubj] = useState<string>('all');
  const [allQuestions, setAllQuestions] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 从数据库加载题目
  useEffect(() => {
    (async () => {
      const raw = await db.questions.toArray();
      const mapped: QItem[] = raw.map(q => ({
        id: q.id,
        q: q.q,
        opts: q.answer.split('—').map(s => s.trim()).filter(Boolean),
        a: 0, // db 里 answer 是文本，第一句就是正确答案
        subj: q.subj,
        star: q.star ?? false,
      }));
      setAllQuestions(mapped);
      setLoading(false);
    })();
  }, []);

  // 按科目和收藏筛选
  const filteredQuestions = useMemo(() => {
    let qs = allQuestions;
    if (activeSubj !== 'all') qs = qs.filter(q => q.subj === activeSubj);
    if (starFilter) qs = qs.filter(q => q.star);
    return qs;
  }, [allQuestions, activeSubj, starFilter]);

  if (loading) {
    return (
      <div className="page">
        <div style={{textAlign:'center', padding:40, color:'var(--text-tertiary)'}}>加载中...</div>
      </div>
    );
  }

  if (filteredQuestions.length === 0) {
    return (
      <div className="page">
        <StatusBar />
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
          <button onClick={() => nav('/')} style={{
            width:32, height:32, borderRadius:8, border:'none',
            background:'var(--surface)', color:'var(--text-secondary)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
          }}>‹</button>
          <h2 style={{fontSize:17, fontWeight:700}}>练习</h2>
        </div>
        <div style={{textAlign:'center', padding:40, color:'var(--text-tertiary)'}}>
          <div style={{fontSize:40, marginBottom:10}}>📭</div>
          <div style={{fontSize:14, fontWeight:600}}>当前筛选条件下没有题目</div>
          <div style={{fontSize:12, marginTop:4}}>换个科目或取消收藏筛选试试</div>
        </div>
      </div>
    );
  }

  const q = filteredQuestions[qIdx % filteredQuestions.length];

  const currentStarred = allQuestions.find(aq => aq.id === q.id)?.star ?? false;

  const select = (i: number) => { if (!answered) setSelected(i); };

  const check = () => {
    if (selected === null) return;
    setAnswered(true);
  };

  const next = () => {
    setSelected(null); setAnswered(false); setQIdx(i => i + 1);
  };

  return (
    <div className="page">
      <StatusBar />
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <button onClick={() => nav('/')} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
        }}>‹</button>
        <h2 style={{fontSize:17, fontWeight:700}}>练习</h2>
      </div>
      <div className="scroll">
        <div style={{display:'flex', gap:6, marginBottom:12, overflowX:'auto', padding:'2px 0'}}>
          {['all','sql','py','da','dma'].map(s => {
            const label = s === 'all' ? '全部' : subjNames[s] || s;
            const isActive = activeSubj === s;
            return (
              <span key={s} onClick={() => { setActiveSubj(s); setQIdx(0); setSelected(null); setAnswered(false); }} style={{
                padding:'6px 16px', borderRadius:20, border:'2px solid',
                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                background: isActive ? 'var(--primary)' : 'var(--surface)',
                fontSize:12, fontWeight:600,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font)'
              }}>{label}</span>
            );
          })}
          <span onClick={() => { setStarFilter(!starFilter); setQIdx(0); setSelected(null); setAnswered(false); }} style={{
            padding:'6px 16px', borderRadius:20, border:'2px solid var(--orange)',
            background: starFilter ? 'var(--orange)' : 'var(--surface)',
            fontSize:12, fontWeight:600,
            color: starFilter ? '#fff' : 'var(--orange)',
            cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font)'
          }}>收藏</span>
        </div>

        <div style={{
          background:'var(--surface)', borderRadius:'var(--radius)', padding:20,
          marginBottom:10, boxShadow:'var(--shadow-sm)', position:'relative'
        }}>
          <button onClick={async () => {
            const newStar = await db.toggleStar(q.id);
            setAllQuestions(prev => prev.map(aq => aq.id === q.id ? { ...aq, star: newStar } : aq));
          }} style={{
            position:'absolute', top:12, right:14, fontSize:22,
            cursor:'pointer', border:'none', background:'none', padding:4
          }}>{currentStarred ? '⭐' : '☆'}</button>
          <div style={{fontSize:11, color:'var(--text-tertiary)', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:.5}}>
            第 {qIdx + 1} / {filteredQuestions.length} 题 · {subjNames[q.subj] || q.subj}
          </div>
          <div style={{fontSize:15, fontWeight:700, lineHeight:1.6, marginBottom:16, color:'var(--text)', paddingRight:28}}>{q.q}</div>
          {q.opts.map((opt, i) => {
            let cls = '';
            if (answered) {
              if (i === q.a) cls = 'correct';
              else if (i === selected) cls = 'wrong';
            } else if (i === selected) cls = 'selected';
            return (
              <div key={i} onClick={() => select(i)}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                  border:`2px solid ${cls === 'correct' ? 'var(--green)' : cls === 'wrong' ? 'var(--rose)' : cls === 'selected' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius:'var(--radius-sm)', marginBottom:8, cursor:'pointer',
                  fontSize:14, fontWeight:500, color:'var(--text)',
                  background: cls === 'correct' ? 'var(--green-light)' : cls === 'wrong' ? 'var(--rose-light)' : cls === 'selected' ? 'var(--primary-light)' : 'transparent'
                }}>
                <span style={{
                  width:24, height:24, borderRadius:'50%',
                  border:`2px solid ${cls === 'correct' ? 'var(--green)' : cls === 'wrong' ? 'var(--rose)' : cls === 'selected' ? 'var(--primary)' : 'var(--border)'}`,
                  flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700,
                  background: cls === 'correct' ? 'var(--green)' : cls === 'wrong' ? 'var(--rose)' : cls === 'selected' ? 'var(--primary)' : 'transparent',
                  color: cls ? '#fff' : 'var(--text)'
                }}>{String.fromCharCode(65 + i)}</span>
                {opt}
              </div>
            );
          })}
        </div>

        {answered && (
          <div style={{
            textAlign:'center', padding:20, background:'var(--surface)',
            borderRadius:'var(--radius)', marginBottom:10, boxShadow:'var(--shadow-sm)'
          }}>
            <div style={{fontSize:40, marginBottom:6}}>{selected === q.a ? '🎉' : '😅'}</div>
            <h4 style={{fontSize:16, fontWeight:700}}>{selected === q.a ? '回答正确！' : '答错了'}</h4>
            <p style={{fontSize:13, color:'var(--text-secondary)', marginTop:4}}>
              {q.opts[q.a]} 是正确答案
            </p>
          </div>
        )}

        <button onClick={check} disabled={selected === null} style={{
          width:'100%', padding:'14px 0', border:'none', borderRadius:'var(--radius-sm)',
          fontSize:15, fontWeight:700, cursor: selected === null ? 'default' : 'pointer',
          fontFamily:'var(--font)', marginBottom:6,
          background:'var(--primary)', color:'#fff', opacity: selected === null ? .5 : 1,
          boxShadow: selected === null ? 'none' : '0 4px 12px rgba(124,58,237,.3)'
        }}>提交答案</button>
        <button onClick={next} style={{
          width:'100%', padding:'14px 0', border:'2px solid var(--border)',
          borderRadius:'var(--radius-sm)', fontSize:15, fontWeight:700,
          cursor:'pointer', fontFamily:'var(--font)', marginBottom:6,
          background:'var(--surface)', color:'var(--text)'
        }}>下一题 →</button>
      </div>
    </div>
  );
}
