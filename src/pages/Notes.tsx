import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import db, { type StoredNote } from '../store/db';

const dummyNotes: StoredNote[] = [
  { courseId: 's3', title: 'INNER JOIN 要点', content: '两个表中都有匹配行时才返回，等于两个集合的交集。', createdAt: '2026-07-27' },
  { courseId: 's3', title: 'LEFT JOIN 常见坑', content: 'WHERE 中过滤右表可能导致退化为 INNER JOIN，应在 ON 中过滤。', createdAt: '2026-07-26' },
];

export default function Notes() {
  const nav = useNavigate();
  const [notes, setNotes] = useState<StoredNote[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await db.getNotes('s3');
      if (stored.length === 0) {
        await db.notes.bulkAdd(dummyNotes);
        setNotes(dummyNotes);
      } else {
        setNotes(stored);
      }
    })();
  }, []);

  const addNote = async () => {
    const titles = ['内连接 vs 外连接对比','ON 与 WHERE 执行顺序','CROSS JOIN 注意事项'];
    const t = titles[Math.floor(Math.random() * titles.length)];
    const note: StoredNote = {
      courseId: 's3', title: '📝 ' + t,
      content: '点击编辑此笔记...',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    await db.addNote(note);
    setNotes(prev => [note, ...prev]);
  };

  return (
    <div className="page">
      <div className="status-bar"><span>9:42</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <button onClick={() => nav(-1)} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
        }}>‹</button>
        <h2 style={{fontSize:17, fontWeight:700}}>JOIN 笔记</h2>
        <button onClick={addNote} style={{
          marginLeft:'auto', width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:16, fontWeight:700
        }}>+</button>
      </div>
      <div className="content-scroll">
        {notes.map((n, i) => (
          <div key={i} style={{
            background:'var(--surface)', border:'2px solid var(--border)',
            borderRadius:'var(--radius-sm)', padding:14, marginBottom:8
          }}>
            <h4 style={{fontSize:13, fontWeight:700, marginBottom:3}}>{n.title}</h4>
            <p style={{fontSize:12, lineHeight:1.6, color:'var(--text-secondary)'}}>{n.content}</p>
            <div style={{fontSize:10, color:'var(--text-tertiary)', marginTop:4}}>{n.createdAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
