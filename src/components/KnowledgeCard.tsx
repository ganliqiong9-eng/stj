import { useState } from 'react';
import { HelpCircle, Lightbulb, MessageCircle, Target } from 'lucide-react';
import type { QACard, KnowledgeLevel } from '../data/content';

interface KnowledgeCardProps {
  index: number;
  qa: QACard;
  onRegenerate: () => void;
  onEdit: () => void;
  level?: KnowledgeLevel;
  tags?: string[];
  relatedCount?: number;
}

const levelConfig: Record<string, { label: string; color: string; bg: string }> = {
  beginner: { label: '入门', color: '#58cc02', bg: '#e5f5d0' },
  intermediate: { label: '进阶', color: '#ff9600', bg: '#fff3e0' },
  advanced: { label: '实战', color: '#e63946', bg: '#fce4ec' },
};

export default function KnowledgeCard({ index, qa, onRegenerate, onEdit, level, tags, relatedCount }: KnowledgeCardProps) {
  return (
    <div style={{
      background: 'var(--surface)', border: '2px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700 }}>卡片 {index + 1}</span>
        {level && levelConfig[level] && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: levelConfig[level].bg, color: levelConfig[level].color }}>
            {levelConfig[level].label}
          </span>
        )}
        {tags?.map(t => (
          <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>{t}</span>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 2 }}>❓</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>{qa.question}</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>💡</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{qa.answer}</span>
      </div>

      <div style={{ marginBottom: 6, padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-dark)', display: 'block', marginBottom: 2 }}>🗣️</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{qa.plain}</span>
      </div>

      <div style={{ marginBottom: 8, padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--green-light)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', display: 'block', marginBottom: 2 }}>🎯</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{qa.analogy}</span>
      </div>

      {relatedCount !== undefined && relatedCount > 0 && (
        <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>
          🔗 {relatedCount} 个相关知识
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onRegenerate}
          style={{ padding: '4px 12px', border: '2px solid var(--border)', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
          🔄
        </button>
        <button onClick={onEdit}
          style={{ padding: '4px 12px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
          ✏️
        </button>
      </div>
    </div>
  );
}
