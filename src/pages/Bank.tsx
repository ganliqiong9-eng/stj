import { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
import db from '../store/db';
import { subjNames } from '../data/questions';
import type { Question } from '../data/questions';
import StatusBar from '../components/StatusBar';

export default function Bank() {
  // const nav = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    await db.initQuestions();
    let items = await db.questions.toArray();
    if (filter === 'star') items = items.filter(q => q.star);
    else if (filter !== 'all') items = items.filter(q => q.subj === filter);
    setQuestions(items);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleBatchImport = async () => {
    try {
      setImporting(true);
      const questions = JSON.parse(importData);
      if (!Array.isArray(questions)) throw new Error('请提供数组格式');
      for (const q of questions) {
        if (!q.id || !q.subj || !q.q || !q.answer) throw new Error(`题目缺少必填字段: ${q.q || q.id}`);
        await db.questions.put({
          id: q.id,
          subj: q.subj,
          q: q.q,
          answer: q.answer,
          star: q.star || false
        });
      }
      setShowImport(false);
      setImportData('');
      load();
    } catch (e) {
      alert(`导入失败: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

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
      <StatusBar />
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 12px 2px'}}>
        <h2 style={{fontSize:17, fontWeight:700}}>题库</h2>
        <span style={{marginLeft:'auto', fontSize:12, fontWeight:400, color:'var(--text-tertiary)', display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={() => setShowImport(true)} style={{padding:'3px 10px',border:'2px solid var(--border)',borderRadius:8,background:'var(--surface)',color:'var(--text)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)'}}>+批量导入</button>
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

      {/* Batch Import Modal */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            width: '100%', maxWidth: 360, maxHeight: '70vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 12px 48px rgba(0,0,0,.2)',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: 14, fontWeight: 700 }}>
              批量导入题目
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, lineHeight: 1.5 }}>
                粘贴 JSON 数组，格式如下：{'{'}&ldquo;id&rdquo;: ..., &ldquo;subj&rdquo;: &ldquo;sql|py|da|dma&rdquo;, &ldquo;q&rdquo;: &ldquo;...&rdquo;, &ldquo;answer&rdquo;: &ldquo;...&rdquo;, &ldquo;star&rdquo;: false{'}'}
              </div>
              <textarea value={importData} onChange={e => setImportData(e.target.value)}
                placeholder={'e.g. [{"id":"q13","subj":"sql","q":"...","answer":"..."}]'}
                rows={8}
                style={{
                  width: '100%', border: '2px solid var(--border)', borderRadius: 10,
                  padding: '10px 12px', fontSize: 12, fontFamily: 'var(--mono)',
                  background: 'var(--bg)', color: 'var(--text)', outline: 'none',
                  resize: 'vertical', lineHeight: 1.5,
                }} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '2px solid var(--border)' }}>
              <button onClick={() => setShowImport(false)}
                style={{
                  flex: 1, padding: '10px 0', border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                  background: 'var(--surface)', color: 'var(--text)',
                }}>取消</button>
              <button onClick={handleBatchImport} disabled={importing || !importData.trim()}
                style={{
                  flex: 2, padding: '10px 0', border: 'none',
                  borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700,
                  cursor: importing ? 'default' : 'pointer', fontFamily: 'var(--font)',
                  background: 'var(--primary)', color: '#fff',
                  opacity: importing ? 0.6 : 1,
                }}>
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
