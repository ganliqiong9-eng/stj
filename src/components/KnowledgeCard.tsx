import type { QA } from '../data/content';

interface KnowledgeCardProps {
  index: number;
  qa: QA;
  onRegenerate: () => void;
  onEdit: () => void;
}

export default function KnowledgeCard({ index, qa, onRegenerate, onEdit }: KnowledgeCardProps) {
  return (
    <div style={{
      background: 'var(--surface)', border: '2px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 6 }}>
        卡片 {index + 1}
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 2 }}>❓ 问题</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>{qa.question}</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>💡 答案</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{qa.answer}</span>
      </div>

      <div style={{ marginBottom: 6, padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-dark)', display: 'block', marginBottom: 2 }}>🗣️ 大白话</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{qa.plain}</span>
      </div>

      <div style={{ marginBottom: 8, padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--green-light)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', display: 'block', marginBottom: 2 }}>🎯 生动比喻</span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text)' }}>{qa.analogy}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onRegenerate}
          style={{ padding: '4px 12px', border: '2px solid var(--border)', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
          🔄 重新生成
        </button>
        <button onClick={onEdit}
          style={{ padding: '4px 12px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
          ✏️ 编辑
        </button>
      </div>
    </div>
  );
}
