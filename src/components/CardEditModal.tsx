import { useState } from 'react';
import type { QA } from '../data/content';

interface CardEditModalProps {
  qa: QA;
  onSave: (updated: QA) => void;
  onClose: () => void;
}

export default function CardEditModal({ qa, onSave, onClose }: CardEditModalProps) {
  const [form, setForm] = useState<QA>({ ...qa });
  const set = (field: keyof QA) => (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const input = (label: string, icon: string, field: keyof QA) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>{icon} {label}</label>
      <textarea value={form[field]} onChange={set(field)}
        rows={field === 'question' ? 2 : 3}
        style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, maxHeight: '80vh', background: 'var(--surface)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: 14, fontWeight: 700 }}>编辑知识点卡片</div>
        <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          {input('问题', '❓', 'question')}
          {input('答案', '💡', 'answer')}
          {input('大白话', '🗣️', 'plain')}
          {input('比喻', '🎯', 'analogy')}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '2px solid var(--border)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)' }}>
            取消
          </button>
          <button onClick={() => onSave(form)}
            style={{ flex: 2, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
