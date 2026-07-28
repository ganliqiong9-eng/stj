import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tips, type Tip } from '../data/tips';
import { subjectData, chaptersList } from '../data/chapters';
import db from '../store/db';

const subjectList = ['sql', 'py', 'da', 'dma'];

function ringStyle(subj: string, pct: number): React.CSSProperties {
  const deg = Math.round(pct * 3.6);
  const colors: Record<string, string> = {
    sql: '#1cb0f6', py: '#ff9600', da: '#ce82ff', dma: '#58cc02'
  };
  const c = colors[subj] || '#1cb0f6';
  return {
    background: `conic-gradient(${c} 0deg ${deg * 3.6}deg, #e5e5e5 ${deg * 3.6}deg 360deg)`
  };
}

export default function Home() {
  const nav = useNavigate();
  const [tip, setTip] = useState<Tip | null>(null);
  const [starred, setStarred] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const totalCount = chaptersList.length;

  const refreshStats = useCallback(async () => {
    const n = await db.getStarredCount();
    setStarred(n);
    const allProgress = await db.progress.toArray();
    const completed = allProgress.filter(p => p.completed).length;
    setCompletedCount(completed);
    setXp(completed * 20);
    const storedStreak = localStorage.getItem('study_streak');
    setStreak(storedStreak ? parseInt(storedStreak, 10) : 0);
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

  return (
    <div className="page">
      <div className="status-bar"><span>9:41</span><span>📶 ████ 🔋</span></div>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 16px 2px'}}>
        <span style={{fontSize:22, fontWeight:800, letterSpacing:-.5, color:'var(--text)'}}>学习伴侣</span>
        <span style={{display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:20, background:'var(--primary-light)', color:'var(--primary-dark)', fontSize:12, fontWeight:700, marginLeft:'auto'}}>⚡ {xp} XP</span>
        <button onClick={async () => {
          if (syncing) return;
          setSyncing(true);
          await db.pushSync();
          await db.pullSync();
          setSyncing(false);
          setSynced(true);
          setTimeout(() => setSynced(false), 2000);
        }}
          style={{
            border:'none', borderRadius:50, padding:'4px 10px',
            background: synced ? '#e5f5d0' : syncing ? '#fef3c7' : '#f0f0f0',
            color: synced ? '#58cc02' : syncing ? '#b36b00' : '#666',
            fontSize:12, fontWeight:700, cursor:'pointer',
            fontFamily:'var(--font)', display:'flex', alignItems:'center', gap:3,
          }}>
          {synced ? '✓ 已同步' : syncing ? '⟳ 同步中' : '🔄 同步'}
        </button>
        <span style={{display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:20, background:'var(--orange-light)', color:'#b36b00', fontSize:12, fontWeight:700}}>🔥 {streak}</span>
      </div>
      <div style={{padding:'2px 16px 0', fontSize:14, color:'var(--text-secondary)', marginBottom:10}}>
        <strong style={{color:'var(--text)'}}>下午好 👋</strong> 继续你的学习之旅
      </div>
      <div className="scroll">
        {/* 继续学习卡片 */}
        <div className="card" style={{padding:18, cursor:'pointer', position:'relative', overflow:'hidden', border:'2px solid transparent'}}
          onClick={() => nav('/subject/sql')}>
          <div style={{fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--primary)', marginBottom:4}}>
            继续学习
          </div>
          <h3 style={{fontSize:17, fontWeight:700, marginBottom:2}}>JOIN 多表连接</h3>
          <div style={{fontSize:13, color:'var(--text-secondary)', marginBottom:8}}>SQL · 5 小节 · 第 2 节</div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{flex:1, height:10, background:'var(--border)', borderRadius:5, overflow:'hidden'}}>
              <div style={{height:'100%', borderRadius:5, background:'linear-gradient(90deg,var(--primary),var(--green))', width: totalCount > 0 ? `${Math.round(completedCount / totalCount * 100)}%` : '0%'}} />
            </div>
            <span style={{fontSize:14, fontWeight:700, color:'var(--primary)'}}>{totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0}%</span>
          </div>
          <div style={{
            width:44, height:44, borderRadius:'50%', border:'none',
            background:'var(--primary)', color:'#fff', fontSize:20,
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
            boxShadow:'0 4px 12px rgba(28,176,246,.3)', cursor:'pointer'
          }}>▶</div>
        </div>

        {/* 科目网格 */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
          {subjectList.map(s => {
            const sd = subjectData[s];
            return (
              <div key={s} className="card" style={{padding:14, cursor:'pointer'}}
                onClick={() => nav(`/subject/${s}`)}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{
                    width:48, height:48, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:800, color:'#fff', flexShrink:0,
                    ...ringStyle(s, sd.pct)
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:'50%',
                      background:'#fff', display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:12, fontWeight:700
                    }}>{sd.icon}</div>
                  </div>
                  <div>
                    <h4 style={{fontSize:13, fontWeight:700}}>{sd.name}</h4>
                    <div style={{fontSize:11, color:'var(--text-secondary)', marginTop:1}}>{sd.pct}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 大白话 */}
        {tip && (
          <div className="tip-card" onClick={nextTip} style={{
            background:'linear-gradient(135deg,var(--primary-light),var(--green-light))',
            borderRadius:'var(--radius)', padding:16, marginBottom:12, cursor:'pointer',
            position:'relative', border:'none'
          }}>
            <button onClick={(e) => { e.stopPropagation(); nextTip(); }}
              style={{
                position:'absolute', top:12, right:12, border:'none',
                background:'rgba(255,255,255,.5)', borderRadius:'50%', width:28, height:28,
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13
              }}>🔄</button>
            <div style={{fontSize:32, marginBottom:4}}>{tip.emoji}</div>
            <div style={{fontSize:14, fontWeight:700, marginBottom:3}}>{tip.title}</div>
            <div style={{fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4}}>{tip.saying}</div>
            <div style={{fontSize:12, lineHeight:1.6, color:'var(--text-secondary)'}}>
              {tip.explain}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6}}>
              <span style={{fontSize:10, fontWeight:700, color:'#fff', background:'var(--primary)', padding:'2px 10px', borderRadius:4}}>{tip.tag}</span>
              <span style={{fontSize:11, color:'var(--text-secondary)'}}>点一下换一条</span>
            </div>
          </div>
        )}

        {/* 成就条 */}
        <div style={{
          background:'var(--surface)', borderRadius:'var(--radius-sm)', padding:'10px 14px',
          marginBottom:4, display:'flex', alignItems:'center', gap:10, boxShadow:'var(--shadow-sm)'
        }}>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color:'var(--green)'}}>{completedCount}</div>
            <div style={{fontSize:10, color:'var(--text-tertiary)', marginTop:1}}>已掌握</div>
          </div>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color:'var(--orange)'}}>{totalCount - completedCount}</div>
            <div style={{fontSize:10, color:'var(--text-tertiary)', marginTop:1}}>待学习</div>
          </div>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color:'var(--primary)'}}>{starred}</div>
            <div style={{fontSize:10, color:'var(--text-tertiary)', marginTop:1}}>收藏题目</div>
          </div>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:16, fontWeight:700, color:'var(--green)'}}>{xp}</div>
            <div style={{fontSize:10, color:'var(--text-tertiary)', marginTop:1}}>总经验</div>
          </div>
        </div>
      </div>
    </div>
  );
}
