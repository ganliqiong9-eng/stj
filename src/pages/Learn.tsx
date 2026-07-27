import { useParams, useNavigate } from 'react-router-dom';
import { courseContent, fallbackContent } from '../data/content';

export default function Learn() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const nav = useNavigate();
  const content = chapterId ? (courseContent[chapterId] || fallbackContent) : fallbackContent;

  return (
    <div className="page">
      <div className="status-bar"><span>9:42</span><span>📶 ████ 🔋</span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <button onClick={() => nav(-1)} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background:'var(--surface)', color:'var(--text-secondary)',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'var(--shadow-sm)', fontSize:18, flexShrink:0
        }}>‹</button>
        <h2 style={{fontSize:17, fontWeight:700}}>{content.title}</h2>
      </div>
      <div style={{
        display:'flex', gap:4, margin:'4px 16px 12px', background:'var(--border)',
        padding:3, borderRadius:10
      }}>
        <button style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', background:'var(--surface)', color:'var(--text)', boxShadow:'var(--shadow-sm)', fontFamily:'var(--font)'}}>📖 学习</button>
        <button onClick={() => nav('/notes')} style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font)'}}>📝 笔记</button>
        <button onClick={() => nav('/quiz')} style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font)'}}>✍️ 练习</button>
      </div>
      <div className="content-scroll">
        {content.sections.map((sec, i) => (
          <div key={i} style={{
            background:'var(--surface)', borderRadius:'var(--radius)', padding:16,
            marginBottom:10, boxShadow:'var(--shadow-sm)'
          }}>
            <h4 style={{fontSize:14, fontWeight:700, marginBottom:6}}>{sec.title}</h4>
            <p style={{fontSize:13, lineHeight:1.7, color:'var(--text-secondary)'}}>{sec.body}</p>
            {sec.code && (
              <pre style={{
                background:'#f4f4f4', borderRadius:8, padding:12, margin:'10px 0',
                fontSize:12, fontFamily:'var(--mono)', overflowX:'auto', lineHeight:1.6,
                color:'var(--text)', border:'1px solid var(--border)'
              }}>{sec.code}</pre>
            )}
            {sec.tip && (
              <p style={{fontSize:12, color:'var(--text-tertiary)'}}>💡 {sec.tip}</p>
            )}
          </div>
        ))}
        <div style={{display:'flex', gap:8, padding:'2px 0 10px'}}>
          <button style={{flex:1, padding:'12px 8px', border:'2px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:700, cursor:'pointer', background:'var(--surface)', color:'var(--text)', fontFamily:'var(--font)'}}>← 上一节</button>
          <button style={{flex:1, padding:'12px 8px', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:700, cursor:'pointer', background:'var(--primary)', color:'#fff', boxShadow:'0 4px 12px rgba(28,176,246,.3)', fontFamily:'var(--font)'}}>✓ 标记完成</button>
        </div>
      </div>
    </div>
  );
}
