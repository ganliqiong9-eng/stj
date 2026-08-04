import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import db from '../store/db';
import type { Section } from '../data/content';
import { safeUUID } from '../utils/id';

interface PasteTextViewProps {
  onBack: () => void;
  onSave: () => void;
}

export default function PasteTextView({ onBack, onSave: onSaveDone }: PasteTextViewProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subj, setSubj] = useState('custom');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    const sections: Section[] = body.split(/\n\n+/).filter(p => p.trim()).map(p => {
      const lines = p.trim().split('\n');
      return {
        title: lines[0].startsWith('#') ? lines[0].replace(/^#+\s*/, '') : '',
        body: p.trim(),
        code: '',
        tip: '',
      };
    });
    if (sections.length === 0) return;
    const now = new Date().toISOString();
    await db.addKnowledge({
      title: title.trim(), subj, tags: tags.trim(), source: '粘贴文本',
      sections, _id: safeUUID(), createdAt: now, updatedAt: now,
    });
    await db.pushSync();
    setSaving(false);
    onSaveDone();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>粘贴文本</h2>
      </div>
      <div style={{ flex: 1, padding: '6px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>标题 *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="知识标题..."
          style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', marginBottom: 10, fontWeight: 600 }} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>科目</label>
            <select value={subj} onChange={e => setSubj(e.target.value)} style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27%3E%3Cpath d=%27M2 4l4 4 4-4%27 fill=%27none%27 stroke=%27%23777%27 stroke-width=%272%27/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
              <option value="custom">自定义</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">数据分析</option><option value="dma">DAMA</option>
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标签</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="逗号分隔" style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
          </div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>内容 *</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="粘贴或输入知识点内容...&#10;&#10;支持按空行自动拆分为多个章节"
          rows={10} style={{ flex: 1, width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>按空行拆分章节，每段第一行以 # 开头将作为标题</div>
        <button onClick={handleSave} disabled={saving || !title.trim() || !body.trim()}
          style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: (saving || !title.trim() || !body.trim()) ? 'default' : 'pointer', fontFamily: 'var(--font)', background: (saving || !title.trim() || !body.trim()) ? 'var(--border)' : 'var(--primary)', color: (saving || !title.trim() || !body.trim()) ? 'var(--text-tertiary)' : '#fff', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={16} /> {saving ? '保存中...' : '保存到知识库'}
        </button>
      </div>
    </div>
  );
}
