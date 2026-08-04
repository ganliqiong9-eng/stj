import { useState } from 'react';
import db, { type KnowledgeEntry } from '../store/db';
import { addKnowledge } from '../api';
import type { Section } from '../data/content';
import { SUBJECT_OPTIONS, emptySection } from './KnowledgeUtils';
import { safeUUID } from '../utils/id';

export default function KnowledgeForm({ onBack, editEntry }: { onBack: () => void; editEntry?: KnowledgeEntry }) {
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
    const sharedId = safeUUID();

    if (editEntry && editEntry.id !== undefined) {
      await db.updateKnowledge(editEntry.id, {
        title: title.trim(), subj, tags: tags.trim(), source: source.trim(),
        sections: nonEmptySections.length ? nonEmptySections : [emptySection()],
        updatedAt: now,
      });
    } else {
      const entry = {
        title: title.trim(), subj, tags: tags.trim(), source: source.trim(),
        sections: nonEmptySections.length ? nonEmptySections : [emptySection()],
        _id: sharedId, createdAt: now, updatedAt: now,
      };
      await db.addKnowledge(entry);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 2px' }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>{editEntry ? '编辑知识' : '手动上传知识'}</h2>
      </div>
      <div className="content-scroll">
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标题 *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入知识标题..."
          style={{ ...inputStyle, marginBottom: 12, fontWeight: 600 }} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>科目</label>
            <select value={subj} onChange={e => setSubj(e.target.value)} style={{
              ...inputStyle, padding: '9px 10px', cursor: 'pointer', appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27%3E%3Cpath d=%27M2 4l4 4 4-4%27 fill=%27none%27 stroke=%27%23777%27 stroke-width=%272%27/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            }}>
              {SUBJECT_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标签（逗号分隔）</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. JOIN, SQL基础" style={inputStyle} />
          </div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>来源</label>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. 个人笔记、书籍摘要"
          style={{ ...inputStyle, marginBottom: 14 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>内容章节</label>
          <button onClick={addSection} style={{
            border: 'none', borderRadius: 8, padding: '4px 12px',
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
          }}>+ 添加章节</button>
        </div>
        {sections.map((sec, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '2px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10, position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>第 {i + 1} 节</span>
              {sections.length > 1 && (
                <button onClick={() => removeSection(i)} style={{
                  marginLeft: 'auto', border: 'none', background: 'none',
                  color: 'var(--rose)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font)', padding: '2px 4px',
                }}>删除</button>
              )}
            </div>
            <input value={sec.title} onChange={e => updateSection(i, 'title', e.target.value)}
              placeholder="章节标题" style={{ ...inputStyle, marginBottom: 6, fontWeight: 600 }} />
            <textarea value={sec.body} onChange={e => updateSection(i, 'body', e.target.value)}
              placeholder="章节正文..." rows={4}
              style={{ ...inputStyle, marginBottom: 6, resize: 'vertical', lineHeight: 1.6 }} />
            <textarea value={sec.code || ''} onChange={e => updateSection(i, 'code', e.target.value)}
              placeholder="代码示例（可选）" rows={3}
              style={{ ...inputStyle, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical' }} />
            <input value={sec.tip || ''} onChange={e => updateSection(i, 'tip', e.target.value)}
              placeholder="小提示（可选）" style={inputStyle} />
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={save} disabled={saving || !title.trim()} style={{
          width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          background: saving ? 'var(--border)' : 'var(--primary)',
          color: saving ? 'var(--text-tertiary)' : '#fff',
          boxShadow: saving ? 'none' : '0 4px 12px rgba(28,176,246,.3)',
          fontFamily: 'var(--font)',
        }}>{saving ? '保存中...' : (editEntry ? '保存修改' : '上传')}</button>
      </div>
    </div>
  );
}
