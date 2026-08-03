import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subjectData } from '../data/chapters';
import db from '../store/db';
import StatusBar from '../components/StatusBar';

function statusIcon(st: 'done' | 'active' | 'pending') {
  if (st === 'done') return { el: '✓', cls: 'step-done' };
  if (st === 'active') return { el: '◉', cls: 'step-active' };
  return { el: '○', cls: 'step-pending' };
}

const colors: Record<string, string> = {
  'SQL 数据库': '#7C3AED', 'Python': '#ff9600',
  '数据分析': '#ce82ff', 'DAMA 认证': '#58cc02'
};

export default function SubjectDetail() {
  const [chapterStatus, setChapterStatus] = useState<Record<string, 'done' | 'active' | 'pending'>>({});
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const sd = id ? subjectData[id] : null;
  useEffect(() => {
    if (!sd) return;
    (async () => {
      const status: Record<string, 'done' | 'active' | 'pending'> = {};
      let foundActive = false;
      for (const ch of sd.chapters) {
        const done = await db.isChapterDone(ch.id);
        if (done) {
          status[ch.id] = 'done';
        } else if (!foundActive) {
          status[ch.id] = 'active';
          foundActive = true;
        } else {
          status[ch.id] = 'pending';
        }
      }
      setChapterStatus(status);
    })();
  }, [sd]);

  if (!sd) return <div className="page"><div style={{padding:40, textAlign:'center', color:'var(--text-tertiary)'}}>科目未找到</div></div>;

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
        <h2 style={{fontSize:17, fontWeight:700}}>{sd.name}</h2>
        <span style={{marginLeft:'auto', fontSize:12, fontWeight:600, color: colors[sd.name] || 'var(--primary)'}}>
          {sd.pct}%
        </span>
      </div>
      <div className="scroll" style={{paddingTop:4}}>
        {sd.chapters.map((ch) => {
          const st = statusIcon(chapterStatus[ch.id] || ch.status);
          return (
            <div key={ch.id} onClick={() => ch.status !== 'pending' && nav(`/learn/${ch.id}`)}
              style={{
                display:'flex', alignItems:'center', gap:14, padding:'12px 14px',
                background:'var(--surface)', borderRadius:'var(--radius-sm)',
                marginBottom:8, cursor: ch.status !== 'pending' ? 'pointer' : 'default',
                boxShadow:'var(--shadow-sm)', opacity: ch.status === 'pending' ? .6 : 1
              }}>
              <div style={{
                width:32, height:32, borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, flexShrink:0,
                background: (chapterStatus[ch.id] || ch.status) === 'done' ? 'var(--green)' :
                           (chapterStatus[ch.id] || ch.status) === 'active' ? 'var(--primary)' : 'var(--border)',
                color: ch.status === 'pending' ? 'var(--text-tertiary)' : '#fff'
              }}>{st.el}</div>
              <div style={{flex:1}}>
                <h4 style={{fontSize:13, fontWeight:600}}>{ch.title}</h4>
                <div style={{fontSize:11, color:'var(--text-secondary)', marginTop:1}}>{ch.subs} 小节 · {ch.duration}</div>
              </div>
              <span style={{
                fontSize:11, fontWeight:600, flexShrink:0,
                color: (chapterStatus[ch.id] || ch.status) === 'done' ? 'var(--green)' :
                       (chapterStatus[ch.id] || ch.status) === 'active' ? 'var(--primary)' : 'var(--text-tertiary)'
              }}>
                {(chapterStatus[ch.id] || ch.status) === 'done' ? '已学' : (chapterStatus[ch.id] || ch.status) === 'active' ? '学习中' : '未开始'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
