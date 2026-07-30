import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, BookOpen, Sparkles } from 'lucide-react';
import db from '../store/db';
import StatusBar from '../components/StatusBar';

export default function TutorView() {
  const nav = useNavigate();
  const [subj, setSubj] = useState('all');
  const [sections, setSections] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [showQA, setShowQA] = useState(false);
  const [studiedSet, setStudiedSet] = useState<Set<string>>(new Set());
  const [key, setKey] = useState(0);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('studied_chunks') || '[]');
      setStudiedSet(new Set(s));
    } catch {}
  }, []);

  const load = async () => {
    const all = await db.getAllKnowledge();
    let items: any[] = [];
    for (const entry of all) {
      if (subj !== 'all' && entry.subj !== subj) continue;
      for (const sec of entry.sections) {
        items.push({ ...sec, entryTitle: entry.title, subj: entry.subj });
      }
    }
    setSections(items);
    setCurrent(0);
    setShowQA(false);
    setKey(k => k + 1);
  };

  useEffect(() => { load(); }, [subj]);

  const markStudied = (id: string) => {
    const next = new Set(studiedSet);
    next.add(id);
    setStudiedSet(next);
    localStorage.setItem('studied_chunks', JSON.stringify([...next]));
  };

  const isStudied = (id: string) => studiedSet.has(id);
  const getKey = (sec: any, i: number) => sec.id || `${sec.entryTitle}-${sec.title}-${i}`;
  const sec = sections[current];
  const studiedCount = sections.filter(s => isStudied(getKey(s, sections.indexOf(s)))).length;

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>学习模式</h2>
        <select value={subj} onChange={e => { setSubj(e.target.value); }} style={{ border: '2px solid var(--border)', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
          <option value="all">全部</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">数据分析</option><option value="dma">DAMA</option>
        </select>
      </div>

      <div className="scroll">
        {sections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <BookOpen size={40} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无效知识点</div>
            <div style={{ fontSize: 12 }}>上传文档后，知识点会自动出现在这里</div>
          </div>
        ) : sec ? (
          <div key={key} style={{ animation: 'slideUp .25s ease-out' }}>
            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'var(--primary)', width: `${((current + 1) / sections.length) * 100}%`, transition: 'width .3s' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{current + 1}/{sections.length}</span>
              <span style={{ fontSize: 10, color: 'var(--green)', whiteSpace: 'nowrap' }}>{studiedCount} \u5df2\u5b66</span>
            </div>

            {/* Content card */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 10, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }}>
              {sec.entryTitle && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>{sec.entryTitle}</div>}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{sec.title || '\u672a\u547d\u540d\u8282\u70b9'}</h3>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 8 }}>{sec.body}</div>
              {sec.code && (
                <pre style={{ background: '#1a1a2e', color: '#cdd6f4', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 11, fontFamily: 'var(--mono)', overflowX: 'auto', lineHeight: 1.5, marginBottom: 8 }}>{sec.code}</pre>
              )}

              {/* QA card toggle */}
              {sec.qa && (
                <button onClick={() => setShowQA(!showQA)}
                  style={{ width: '100%', padding: '8px 10px', border: '2px solid var(--primary)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: showQA ? 'var(--primary)' : 'var(--surface)', color: showQA ? '#fff' : 'var(--primary)', textAlign: 'center', marginBottom: showQA ? 0 : 0 }}>
                  <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} /> {showQA ? '\u6536\u8d77\u7b54\u6848' : '\u67e5\u770b\u7b54\u6848'}
                </button>
              )}
              {showQA && sec.qa && (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 4 }}>{sec.qa.question}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)', marginBottom: 4 }}>{sec.qa.answer}</div>
                  {sec.qa.plain && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, padding: '6px 8px', borderRadius: 6, background: 'var(--warning-light)' }}>{sec.qa.plain}</div>}
                  {sec.qa.analogy && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, padding: '6px 8px', borderRadius: 6, background: 'var(--success-light)' }}>{sec.qa.analogy}</div>}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button onClick={() => { if (current > 0) { setCurrent(c => c - 1); setKey(k => k + 1); setShowQA(false); } }}
                disabled={current === 0}
                style={{ flex: 1, padding: '10px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: current === 0 ? 'default' : 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: current === 0 ? 'var(--text-tertiary)' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: current === 0 ? 0.5 : 1 }}>
                <ArrowLeft size={14} /> 上一节
              </button>
              <button onClick={() => markStudied(getKey(sec, current))}
                style={{ padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: isStudied(getKey(sec, current)) ? 'var(--green)' : 'var(--surface)', color: isStudied(getKey(sec, current)) ? '#fff' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 80 }}>
                {isStudied(getKey(sec, current)) ? <><Check size={14} /> \u5df2\u5b66</> : '\u2705 \u5b66\u4e86'}
              </button>
              <button onClick={() => { if (current < sections.length - 1) { setCurrent(c => c + 1); setKey(k => k + 1); setShowQA(false); } }}
                disabled={current === sections.length - 1}
                style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: current === sections.length - 1 ? 'default' : 'pointer', fontFamily: 'var(--font)', background: current === sections.length - 1 ? 'var(--border)' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: current === sections.length - 1 ? 0.5 : 1 }}>
                \u4e0b\u4e00\u8282 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
