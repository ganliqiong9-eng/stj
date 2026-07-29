import { useState, useEffect, useCallback } from 'react';
import type { Section } from '../data/content';
import db, { type KnowledgeEntry } from '../store/db';
import { addKnowledge, listKnowledge, deleteKnowledge } from '../api';

const SUBJECT_OPTIONS = [
  { value: 'sql', label: 'SQL' },
  { value: 'py', label: 'Python' },
  { value: 'da', label: '数据分析' },
  { value: 'dma', label: 'DAMA' },
  { value: 'custom', label: '自定义' },
];

function formatDate(s: string) {
  try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
}

function emptySection(): Section {
  return { title: '', body: '', code: '', tip: '' };
}

// ====== Knowledge List View ======
function KnowledgeList({ onView, onAdd }: { onView: (id: number) => void; onAdd: () => void }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const items = await db.getAllKnowledge();
    setEntries(items.reverse());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const [serverEntries, setServerEntries] = useState<any[]>([]);
  useEffect(() => {
    listKnowledge().then(items => {
      if (items && items.length > 0) setServerEntries(items);
    }).catch(() => {});
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    // 先查出要删除的条目（在 setEntries 之前，避免闭包陷阱）
    const entry = entries.find(e => e.id === id);
    await db.deleteKnowledge(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    // Also try server-side delete
    if (entry?._id) deleteKnowledge(entry._id).catch(() => {});
  };

  const subjLabel = (s: string) => SUBJECT_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div className="page">
      <div className="status-bar"><span>9:42</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>📖 我的知识</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {serverEntries.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--green)', background: '#e5f5d0', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              📚 RAG {serverEntries.length}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            共 {entries.length} 条
          </span>
        </div>
      </div>

      <div style={{ padding: '4px 16px 8px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        上传你自己的学习笔记、文章摘要或代码示例，与内置课程一起复习。
      </div>

      <div className="scroll">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>还没有上传知识</div>
            <div style={{ fontSize: 12 }}>点击下方按钮添加你的第一篇知识笔记</div>
          </div>
        ) : (
          entries.map(k => (
            <div key={k.id} onClick={() => k.id !== undefined && onView(k.id)}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                padding: 14, marginBottom: 8, cursor: 'pointer',
                border: '2px solid var(--border)', position: 'relative',
                transition: 'border .2s', boxShadow: 'var(--shadow-sm)',
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
          + 上传知识
        </button>
      </div>
    </div>
  );
}

// ====== Knowledge Form View ======
function KnowledgeForm({ onBack, editEntry }: { onBack: () => void; editEntry?: KnowledgeEntry }) {
  const [title, setTitle] = useState(editEntry?.title || '');
  const [subj, setSubj] = useState(editEntry?.subj || 'custom');
  const [tags, setTags] = useState(editEntry?.tags || '');
  const [source, setSource] = useState(editEntry?.source || '');
  const [sections, setSections] = useState<Section[]>(editEntry?.sections?.length ? editEntry.sections : [emptySection()]);
  const [saving, setSaving] = useState(false);

  const addSection = () => setSections(prev => [...prev, emptySection()]);
  const removeSection = (i: number) => setSections(prev => prev.filter((_, idx) => idx !== i));
  const updateSection = (i: number, field: keyof Section, value: string) => {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const nonEmptySections = sections.filter(s => s.title.trim() || s.body.trim());
    const now = new Date().toISOString();
    const sharedId = crypto.randomUUID();

    if (editEntry && editEntry.id !== undefined) {
      await db.updateKnowledge(editEntry.id, {
        title: title.trim(),
        subj,
        tags: tags.trim(),
        source: source.trim(),
        sections: nonEmptySections.length ? nonEmptySections : [emptySection()],
        updatedAt: now,
      });
    } else {
      const entry = {
        title: title.trim(),
        subj,
        tags: tags.trim(),
        source: source.trim(),
        sections: nonEmptySections.length ? nonEmptySections : [emptySection()],
        _id: sharedId,
        createdAt: now,
        updatedAt: now,
      };
      await db.addKnowledge(entry);
      // Also push to server for RAG indexing (use same _id)
      addKnowledge(entry).catch(() => {});
    }
    await db.pushSync();
    setSaving(false);
    onBack();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '2px solid var(--border)', borderRadius: 10,
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)',
    background: 'var(--surface)', color: 'var(--text)',
    outline: 'none', transition: 'border .2s',
  };

  return (
    <div className="page">
      <div className="status-bar"><span>9:42</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'var(--surface)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
          }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>
          {editEntry ? '编辑知识' : '上传知识'}
        </h2>
      </div>
      <div className="content-scroll">
        {/* 标题 */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标题 *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入知识标题..."
          style={{ ...inputStyle, marginBottom: 12, fontWeight: 600 }} />

        {/* 科目 + 标签 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>科目</label>
            <select value={subj} onChange={e => setSubj(e.target.value)}
              style={{
                ...inputStyle, padding: '9px 10px', cursor: 'pointer',
                appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27%3E%3Cpath d=%27M2 4l4 4 4-4%27 fill=%27none%27 stroke=%27%23777%27 stroke-width=%272%27/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}>
              {SUBJECT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标签（逗号分隔）</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. JOIN, SQL基础"
              style={inputStyle} />
          </div>
        </div>

        {/* 来源 */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>来源</label>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. 个人笔记、书籍摘要、AI 生成"
          style={{ ...inputStyle, marginBottom: 14 }} />

        {/* 章节列表 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>内容章节</label>
          <button onClick={addSection}
            style={{
              border: 'none', borderRadius: 8, padding: '4px 12px',
              background: 'var(--primary-light)', color: 'var(--primary-dark)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
            }}>+ 添加章节</button>
        </div>

        {sections.map((sec, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '2px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>第 {i + 1} 节</span>
              {sections.length > 1 && (
                <button onClick={() => removeSection(i)}
                  style={{
                    marginLeft: 'auto', border: 'none', background: 'none',
                    color: 'var(--rose)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font)', padding: '2px 4px',
                  }}>删除</button>
              )}
            </div>
            <input value={sec.title} onChange={e => updateSection(i, 'title', e.target.value)}
              placeholder="章节标题" style={{ ...inputStyle, marginBottom: 6, fontWeight: 600 }} />
            <textarea value={sec.body} onChange={e => updateSection(i, 'body', e.target.value)}
              placeholder="章节正文内容..."
              rows={4}
              style={{ ...inputStyle, marginBottom: 6, resize: 'vertical', lineHeight: 1.6 }} />
            <textarea value={sec.code || ''} onChange={e => updateSection(i, 'code', e.target.value)}
              placeholder="代码示例（可选）"
              rows={3}
              style={{ ...inputStyle, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical' }} />
            <input value={sec.tip || ''} onChange={e => updateSection(i, 'tip', e.target.value)}
              placeholder="💡 小提示（可选）" style={inputStyle} />
          </div>
        ))}
      </div>

      {/* 底部操作栏 */}
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={save} disabled={saving || !title.trim()}
          style={{
            width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            background: saving ? 'var(--border)' : 'var(--primary)',
            color: saving ? 'var(--text-tertiary)' : '#fff',
            boxShadow: saving ? 'none' : '0 4px 12px rgba(28,176,246,.3)',
            fontFamily: 'var(--font)',
          }}>
          {saving ? '保存中...' : (editEntry ? '✓ 保存修改' : '📤 上传')}
        </button>
      </div>
    </div>
  );
}

// ====== Knowledge Detail View ======
function KnowledgeDetail({ entry, onBack }: { entry: KnowledgeEntry; onBack: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const subjLabel = (s: string) => SUBJECT_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div className="page">
      <div className="status-bar"><span>9:42</span><span style={{display:'inline-flex',alignItems:'center',gap:5}}><svg width="14" height="10" viewBox="0 0 14 10" style={{display:'block'}}><rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/></svg><svg width="18" height="10" viewBox="0 0 18 10" style={{display:'block'}}><rect x="0.5" y="1" width="14" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="2.5" width="9" height="5" rx="0.8" fill="currentColor"/><rect x="15" y="3.5" width="2" height="3" rx="0.8" fill="currentColor"/></svg></span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'var(--surface)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
          }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </h2>
      </div>

      {/* meta bar */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 10px', fontSize: 10, borderRadius: 20,
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text-secondary)', fontWeight: 500
        }}>{subjLabel(entry.subj)}</span>
        {entry.tags && entry.tags.split(',').map((t, i) => (
          <span key={i} style={{
            padding: '2px 8px', fontSize: 10, borderRadius: 20,
            background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 500
          }}>{t.trim()}</span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
          {formatDate(entry.createdAt)}
        </span>
      </div>

      <div className="content-scroll">
        {entry.sections.map((sec, i) => (
          <div key={i} style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            padding: 16, marginBottom: 10, boxShadow: 'var(--shadow-sm)'
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{sec.title}</h4>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{sec.body}</p>
            {sec.code && (
              <div style={{ position: 'relative', marginTop: 10 }}>
                <button onClick={() => copyCode(sec.code!, `c${i}`)}
                  style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    padding: '3px 10px', border: '1px solid #ddd',
                    borderRadius: 5, background: copied === `c${i}` ? '#e5f5d0' : '#fff',
                    color: copied === `c${i}` ? '#58cc02' : '#666',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font)',
                  }}>
                  {copied === `c${i}` ? '✓ 已复制' : '复制'}
                </button>
                <pre style={{
                  background: '#f4f4f4', borderRadius: 8, padding: 12,
                  fontSize: 12, fontFamily: 'var(--mono)', overflowX: 'auto',
                  lineHeight: 1.6, color: 'var(--text)', border: '1px solid var(--border)'
                }}>{sec.code}</pre>
              </div>
            )}
            {sec.tip && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>💡 {sec.tip}</p>
            )}
          </div>
        ))}
        {entry.source && (
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center',
            padding: '8px 0 4px'
          }}>
            来源：{entry.source}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== Main Export ======
export default function Knowledge() {
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [detailEntry, setDetailEntry] = useState<KnowledgeEntry | null>(null);

  const openDetail = async (id: number) => {
    const entry = await db.getKnowledge(id);
    if (entry) {
      setDetailEntry(entry);
      setView('detail');
    }
  };

  if (view === 'form') {
    return <KnowledgeForm onBack={() => setView('list')} />;
  }

  if (view === 'detail' && detailEntry) {
    return <KnowledgeDetail entry={detailEntry} onBack={() => setView('list')} />;
  }

  return <KnowledgeList onView={openDetail} onAdd={() => setView('form')} />;
}
