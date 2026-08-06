import { ChevronDown, ChevronRight } from 'lucide-react';
import CompilerResultTable from './CompilerResultTable';
import type { ResultEntry } from '../pages/Compiler';

function HistoryEntry({ entry, expanded, onToggle, onReuse }: {
  entry: ResultEntry;
  expanded: boolean;
  onToggle: () => void;
  onReuse?: (code: string) => void;
}) {
  return (
    <div style={{
      border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)',
      marginBottom: 6, overflow: 'hidden',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px', border: 'none', background: 'var(--surface)',
        cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 11,
        color: 'var(--text)', textAlign: 'left',
      }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{
          padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
          background: entry.language === 'sql' ? 'var(--success-light)' : 'var(--warning-light)',
          color: entry.language === 'sql' ? '#2e7d32' : '#e65100',
        }}>{entry.language.toUpperCase()}</span>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: entry.ok ? 'var(--green)' : 'var(--rose)',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
          {entry.msg?.substring(0, 60)}
        </span>
        {entry.ok && entry.rows.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {entry.rows.length}行 · {entry.elapsedMs ?? '-'}ms
          </span>
        )}
        {onReuse && (
          <span onClick={e => { e.stopPropagation(); onReuse(entry.code); }}
            style={{ fontSize: 10, color: 'var(--primary)', cursor: 'pointer', flexShrink: 0, padding: '2px 4px', borderRadius: 4, background: 'var(--primary-light)' }}>
            重用
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {entry.timestamp}
        </span>
      </button>
      {expanded && entry.columns.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <CompilerResultTable columns={entry.columns} rows={entry.rows} elapsedMs={entry.elapsedMs} />
        </div>
      )}
      {expanded && entry.columns.length === 0 && entry.msg && (
        <div style={{
          padding: '10px 12px', fontSize: 11, lineHeight: 1.6,
          fontFamily: 'var(--mono)', color: entry.ok ? 'var(--green)' : 'var(--rose)',
          whiteSpace: 'pre-wrap', borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          {entry.ok ? `✓ ${entry.msg}` : `✗ ${entry.msg}`}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Compiler Component
// ============================================================

export default HistoryEntry;
