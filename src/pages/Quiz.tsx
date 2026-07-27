import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import db from '../store/db';
import { subjNames } from '../data/questions';

interface QItem {
  id: string; q: string; opts: string[]; a: number; subj: string;
}

const quizPool: QItem[] = [
  {id:'q1', q:'以下哪个 JOIN 会返回左表中的所有行？', opts:['INNER JOIN','LEFT JOIN','RIGHT JOIN','CROSS JOIN'], a:1, subj:'sql'},
  {id:'q6', q:'Python 中获取列表长度的函数是？', opts:['len()','length()','size()','count()'], a:0, subj:'py'},
  {id:'q10', q:'维度建模的核心表类型是？', opts:['事实表 & 维度表','主表 & 子表','宽表 & 窄表','分区表 & 桶表'], a:0, subj:'da'},
];

export default function Quiz() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [starred, setStarred] = useState(false);
  const [starFilter, setStarFilter] = useState(false);

  const q = quizPool[qIdx % quizPool.length];

  useEffect(() => {
    (async () => {
      const item = await db.questions.get(q.id);
      setStarred(item?.star ?? false);
    })();
  }, [qIdx]);

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
      <div className="status-bar"><span>9:43</span><span>📶 ████ 🔋</span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <button onClick={() => nav('/')} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
        }}>‹</button>
        <h2 style={{fontSize:17, fontWeight:700}}>✍️ 练习</h2>
        <button onClick={() => nav('/bank')} style={{
          marginLeft:'auto', width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:14
        }}>📚</button>
      </div>
      <div className="scroll">
        <div style={{display:'flex', gap:6, marginBottom:12, overflowX:'auto', padding:'2px 0'}}>
          {['全部','SQL','Python','数据分析','DAMA'].map(t => (
            <span key={t} style={{
              padding:'6px 16px', borderRadius:20, border:'2px solid var(--border)',
              background:'var(--surface)', fontSize:12, fontWeight:600,
              color:'var(--text-secondary)', cursor:'pointer', whiteSpace:'nowrap',
              fontFamily:'var(--font)'
            }}>{t}</span>
          ))}
          <span onClick={() => setStarFilter(!starFilter)} style={{
            padding:'6px 16px', borderRadius:20, border:'2px solid var(--orange)',
            background: starFilter ? 'var(--orange)' : 'var(--surface)',
            fontSize:12, fontWeight:600,
            color: starFilter ? '#fff' : 'var(--orange)',
            cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font)'
          }}>⭐ 收藏</span>
        </div>

        <div style={{
          background:'var(--surface)', borderRadius:'var(--radius)', padding:20,
          marginBottom:10, boxShadow:'var(--shadow-sm)', position:'relative'
        }}>
          <button onClick={async () => {
            const s = await db.toggleStar(q.id);
            setStarred(s);
          }} style={{
            position:'absolute', top:12, right:14, fontSize:22,
            cursor:'pointer', border:'none', background:'none', padding:4
          }}>{starred ? '⭐' : '☆'}</button>
          <div style={{fontSize:11, color:'var(--text-tertiary)', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:.5}}>
            第 {qIdx + 1} 题 · {subjNames[q.subj] || q.subj}
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
          boxShadow: selected === null ? 'none' : '0 4px 12px rgba(28,176,246,.3)'
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
