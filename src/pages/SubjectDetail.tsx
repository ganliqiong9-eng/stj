import { useParams, useNavigate } from 'react-router-dom';
import { subjectData } from '../data/chapters';

function statusIcon(st: 'done' | 'active' | 'pending') {
  if (st === 'done') return { el: '✓', cls: 'step-done' };
  if (st === 'active') return { el: '◉', cls: 'step-active' };
  return { el: '○', cls: 'step-pending' };
}

const colors: Record<string, string> = {
  'SQL 数据库': '#1cb0f6', 'Python': '#ff9600',
  '数据分析': '#ce82ff', 'DAMA 认证': '#58cc02'
};

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const sd = id ? subjectData[id] : null;
  if (!sd) return <div className="page"><div style={{padding:40, textAlign:'center', color:'var(--text-tertiary)'}}>科目未找到</div></div>;

  return (
    <div className="page">
      <div className="status-bar"><span>9:41</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
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
          const st = statusIcon(ch.status);
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
                background: ch.status === 'done' ? 'var(--green)' :
                           ch.status === 'active' ? 'var(--primary)' : 'var(--border)',
                color: ch.status === 'pending' ? 'var(--text-tertiary)' : '#fff'
              }}>{st.el}</div>
              <div style={{flex:1}}>
                <h4 style={{fontSize:13, fontWeight:600}}>{ch.title}</h4>
                <div style={{fontSize:11, color:'var(--text-secondary)', marginTop:1}}>{ch.subs} 小节 · {ch.duration}</div>
              </div>
              <span style={{
                fontSize:11, fontWeight:600, flexShrink:0,
                color: ch.status === 'done' ? 'var(--green)' :
                       ch.status === 'active' ? 'var(--primary)' : 'var(--text-tertiary)'
              }}>
                {ch.status === 'done' ? '已学' : ch.status === 'active' ? '学习中' : '未开始'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
