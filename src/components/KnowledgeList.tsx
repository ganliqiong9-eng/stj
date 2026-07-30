import { useState, useEffect, useCallback } from 'react';
import db, { type KnowledgeEntry } from '../store/db';
import { deleteKnowledge } from '../api';
import { SUBJECT_OPTIONS, formatDate } from './KnowledgeUtils';
import { ragQuery } from '../api';

export default function KnowledgeList({ onView, onAdd, search, filterSubj, searchMode }: { onView: (id: number) => void; onAdd: () => void; search?: string; filterSubj?: string; searchMode?: string }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let items = await db.getAllKnowledge();
    // Apply search filter
    if (search && searchMode === 'semantic') {
      try {
        const r = await ragQuery(search, 20);
        if (r.results && r.results.length > 0) {
          const ids = new Set(r.results.map((c: any) => c.article_id));
          const scores = new Map(r.results.map((c: any) => [c.article_id, c.score]));
          items = items.filter((k: any) => k._id && ids.has(k._id));
          items.sort((a: any, b: any) => (scores.get(b._id!) || 0) - (scores.get(a._id!) || 0));
        } else {
          items = [];
        }
      } catch { items = []; }
    } else if (search) {
      const q = search.toLowerCase();
      items = items.filter(k => k.title.toLowerCase().includes(q) || (k.tags && k.tags.toLowerCase().includes(q)));
    }
    // Apply subject filter
    if (filterSubj && filterSubj !== 'all') {
      items = items.filter(k => k.subj === filterSubj || (filterSubj === 'doc-upload' && k.source.includes('文件')) || (filterSubj === 'table-upload' && k.source.includes('Excel')) || (filterSubj === 'form' && !k.source.includes('文件') && !k.source.includes('Excel')));
    }
    setEntries(items.reverse());
    setLoading(false);
  }, [search, filterSubj, searchMode]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const entry = entries.find(e => e.id === id);
    await db.deleteKnowledge(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (entry?._id) deleteKnowledge(entry._id).catch(() => {});
  };

  const subjLabel = (s: string) => SUBJECT_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 16px 8px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        上传文档自动拆分解析为 RAG 知识，或上传 Excel 自动创建练习表。
      </div>
      <div className="scroll" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>还没有内容</div>
            <div style={{ fontSize: 12 }}>在上方标签页上传文档或表格</div>
          </div>
        ) : (
          entries.map(k => (
            <div key={k.id} onClick={() => k.id !== undefined && onView(k.id)}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                padding: 14, marginBottom: 8, cursor: 'pointer',
                border: '2px solid var(--border)', position: 'relative',
                boxShadow: 'var(--shadow-sm)',
              }}>
              <button onClick={(e) => k.id !== undefined && handleDelete(e, k.id)}
                style={{
                  position: 'absolute', top: 8, right: 8, width: 26, height: 26,
                  borderRadius: '50%', border: 'none', background: 'var(--rose-light)',
                  color: 'var(--rose)', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font)', lineHeight: 1,
                }}>×</button>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, paddingRight: 26 }}>{k.title}</h4>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  padding: '2px 10px', fontSize: 10, borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-secondary)', fontWeight: 500
                }}>{subjLabel(k.subj)}</span>
                {k.tags && k.tags.split(',').map((t, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', fontSize: 10, borderRadius: 20,
                    background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 500
                  }}>{t.trim()}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 12 }}>
                <span>{k.sections.length} 节</span>
                <span>{formatDate(k.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={onAdd}
          style={{
            width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            background: 'var(--primary)', color: '#fff',
            boxShadow: '0 4px 12px rgba(28,176,246,.3)',
            fontFamily: 'var(--font)',
          }}>
          + 手动上传知识
        </button>
      </div>
    </div>
  );
}
