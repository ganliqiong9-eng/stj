import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { KnowledgeEntry } from '../store/db';
import { SUBJECT_OPTIONS, formatDate } from './KnowledgeUtils';
import { getRelatedKnowledge } from '../api';

export default function KnowledgeDetail({ entry, onBack }: { entry: KnowledgeEntry; onBack: () => void }) {
  const nav = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const copyCode = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const [related, setRelated] = useState<any[]>([]);
  const [showRelated, setShowRelated] = useState(false);

  useEffect(() => {
    if (entry._id) {
      getRelatedKnowledge(entry._id).then(r => { if (r.ok) setRelated(r.related || []); }).catch(() => {});
    }
  }, [entry._id]);

  const subjLabel = (s: string) => SUBJECT_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </h2>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 10px', fontSize: 10, borderRadius: 20,
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', fontWeight: 500
        }}>{subjLabel(entry.subj)}</span>
        {entry.tags?.split(',').map((t, i) => (
          <span key={i} style={{
            padding: '2px 8px', fontSize: 10, borderRadius: 20,
            background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 500
          }}>{t.trim()}</span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{formatDate(entry.createdAt)}</span>
        <button onClick={() => nav(`/quiz?knowledgeId=${entry._id || ''}`)} style={{
          marginLeft: 'auto', padding: '6px 12px', border: 'none', borderRadius: 8,
          background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap'
        }}>用这个知识点出题</button>
      </div>
      <div className="content-scroll">
        {entry.sections.map((sec, i) => (
          <div key={i} style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16,
            marginBottom: 10, boxShadow: 'var(--shadow-sm)'
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{sec.title}</h4>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{sec.body}</p>
            {sec.code && (
              <div style={{ position: 'relative', marginTop: 10 }}>
                <button onClick={() => copyCode(sec.code!, `c${i}`)} style={{
                  position: 'absolute', top: 6, right: 6, zIndex: 2,
                  padding: '3px 10px', border: '1px solid #ddd', borderRadius: 5,
                  background: copied === `c${i}` ? 'var(--green-light)' : 'var(--surface)',
                  color: copied === `c${i}` ? 'var(--green)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
                }}>{copied === `c${i}` ? '已复制' : '复制'}</button>
                <pre style={{
                  background: '#f4f4f4', borderRadius: 8, padding: 12,
                  fontSize: 12, fontFamily: 'var(--mono)', overflowX: 'auto',
                  lineHeight: 1.6, color: 'var(--text)', border: '1px solid var(--border)'
                }}>{sec.code}</pre>
              </div>
            )}
            {sec.tip && (<p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>💡 {sec.tip}</p>)}
          </div>
        ))}
        {entry.source && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0 4px' }}>
            来源：{entry.source}
          </div>
        )}
      {related.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setShowRelated(!showRelated)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', color: 'var(--primary)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', width: '100%', textAlign: 'left' }}>
            相关知识 ({related.length}) {showRelated ? '▲' : '▼'}
          </button>
          {showRelated && related.slice(0, 5).map((r, i) => (
            <div key={i} style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 4, fontSize: 11, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
              <div style={{ fontSize: 9, color: 'var(--primary-dark)', marginTop: 2, fontWeight: 700 }}>相似度 {Math.round(r.similarity * 100)}%</div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
