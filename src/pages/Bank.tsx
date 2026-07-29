import { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
import db from '../store/db';
import { subjNames } from '../data/questions';
import type { Question } from '../data/questions';

export default function Bank() {
  // const nav = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    await db.initQuestions();
    let items = await db.questions.toArray();
    if (filter === 'star') items = items.filter(q => q.star);
    else if (filter !== 'all') items = items.filter(q => q.subj === filter);
    setQuestions(items);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string) => {
    await db.toggleStar(id);
    load();
  };

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'sql', label: 'SQL' },
    { key: 'py', label: 'Python' },
    { key: 'da', label: '数据分析' },
    { key: 'dma', label: 'DAMA' },
    { key: 'star', label: '⭐ 收藏', star: true },
  ];

  return (
    <div className="page">
      <div className="status-bar"><span>9:43</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <h2 style={{fontSize:17, fontWeight:700}}>📚 题库</h2>
        <span style={{marginLeft:'auto', fontSize:12, fontWeight:400, color:'var(--text-tertiary)'}}>
          共 {questions.length} 题
        </span>
      </div>
      <div className="scroll">
        <div style={{display:'flex', gap:6, marginBottom:12, overflowX:'auto', padding:'2px 0'}}>
          {filters.map(f => (
            <span key={f.key} onClick={() => setFilter(f.key)} style={{
              padding:'6px 16px', borderRadius:20,
              border: `2px solid ${f.key === filter ? (f.star ? 'var(--orange)' : 'var(--primary)') : 'var(--border)'}`,
              background: f.key === filter ? (f.star ? 'var(--orange)' : 'var(--primary)') : 'var(--surface)',
              fontSize:12, fontWeight:600,
              color: f.key === filter ? '#fff' : (f.star ? 'var(--orange)' : 'var(--text-secondary)'),
              cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font)'
            }}>{f.label}</span>
          ))}
        </div>

        {questions.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px 0', color:'var(--text-tertiary)', fontSize:14, fontWeight:500}}>
            暂无题目 ✨
          </div>
        ) : (
          questions.map(q => (
            <div key={q.id} style={{
              background:'var(--surface)', borderRadius:'var(--radius-sm)', padding:14,
              marginBottom:8, position:'relative', border:'2px solid var(--border)',
              transition:'border .2s'
            }}>
              <button onClick={() => toggle(q.id)} style={{
                position:'absolute', top:10, right:10, fontSize:18,
                cursor:'pointer', border:'none', background:'none', padding:4
              }}>{q.star ? '⭐' : '☆'}</button>
              <div style={{fontSize:13, fontWeight:600, paddingRight:28, marginBottom:4}}>{q.q}</div>
              <div style={{display:'flex', gap:4, marginTop:4, flexWrap:'wrap'}}>
                <span style={{
                  padding:'2px 10px', fontSize:10, borderRadius:20,
                  border:'1px solid var(--border)', background:'var(--surface)',
                  color:'var(--text-secondary)', fontWeight:500
                }}>{subjNames[q.subj] || q.subj}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6}}>
                <span onClick={(e) => {
                  const ans = (e.target as HTMLElement).parentElement?.nextElementSibling as HTMLElement;
                  if (ans) {
                    ans.classList.toggle('show');
                    (e.target as HTMLElement).textContent = ans.classList.contains('show') ? '收起答案 ▴' : '查看答案 ▾';
                  }
                }} style={{
                  fontSize:11, color:'var(--primary)', cursor:'pointer',
                  border:'none', background:'none', fontFamily:'var(--font)', fontWeight:700, padding:'4px 0'
                }}>查看答案 ▾</span>
              </div>
              <div style={{
                fontSize:12, color:'var(--text-secondary)', padding:'10px 12px',
                background:'#f7f7f7', borderRadius:8, marginTop:8, display:'none',
                lineHeight:1.6
              }}>
                <span style={{color:'var(--green)', fontWeight:700}}>✓ </span>{q.answer}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
