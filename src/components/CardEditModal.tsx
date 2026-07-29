import { useState } from 'react';
import type { QA, KnowledgeLevel } from '../data/content';

interface CardEditModalProps {
  qa: QA;
  onSave: (updated: QA) => void;
  onClose: () => void;
  level?: KnowledgeLevel;
  tags?: string[];
  onLevelChange?: (level: KnowledgeLevel) => void;
  onTagsChange?: (tags: string[]) => void;
}

const LEVELS: { key: KnowledgeLevel; label: string; color: string }[] = [
  { key: 'beginner', label: '入门', color: '#58cc02' },
  { key: 'intermediate', label: '进阶', color: '#ff9600' },
  { key: 'advanced', label: '实战', color: '#e63946' },
];

export default function CardEditModal({ qa, onSave, onClose, level, tags, onLevelChange, onTagsChange }: CardEditModalProps) {
  const [form, setForm] = useState<QA>({ ...qa });
  const [tagInput, setTagInput] = useState('');
  const set = (field: keyof QA) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const input = (label: string, icon: string, field: keyof QA) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{icon}</label>
      <textarea value={form[field]} onChange={set(field)}
        rows={field === 'question' ? 2 : 3}
        style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
    </div>
  );

  const addTag = () => {
    const t = tagInput.trim();
    if (t && tags && !tags.includes(t)) {
      onTagsChange?.([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (idx: number) => {
    if (tags) onTagsChange?.(tags.filter((_, i) => i !== idx));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '80vh', background: 'var(--surface)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: 14, fontWeight: 700 }}>编辑知识点卡片</div>
        <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          {input('问题', '❓', 'question')}
          {input('答案', '💡', 'answer')}
          {input('大白话', '🗣\uFE0F', 'plain')}
          {input('比喻', '\uD83C\uDFAF', 'analogy')}

          {/* Level selector */}
          {onLevelChange && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>难度</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {LEVELS.map(l => (
                  <button key={l.key} onClick={() => onLevelChange(l.key)}
                    style={{
                      flex: 1, padding: '6px 0', border: '2px solid', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                      borderColor: level === l.key ? l.color : 'var(--border)',
                      background: level === l.key ? `${l.color}15` : 'var(--surface)',
                      color: level === l.key ? l.color : 'var(--text-secondary)',
                    }}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {onTagsChange && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>标签</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {(tags || []).map((t, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
                    {t}
                    <button onClick={() => removeTag(i)} style={{ border: 'none', background: 'none', color: 'var(--primary-dark)', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="添加标签..." style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
                <button onClick={addTag} style={{ padding: '5px 10px', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>+</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '2px solid var(--border)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)' }}>
            取消
          </button>
          <button onClick={() => { onSave(form); onClose(); }}
            style={{ flex: 2, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
