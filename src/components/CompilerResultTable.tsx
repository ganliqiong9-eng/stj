import type { Row } from '../api';

function ResultTable({ columns, rows }: { columns: string[]; rows: Row[] }) {
  if (columns.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', fontSize: 11, lineHeight: 1.5 }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontFamily: 'var(--mono)', fontSize: 11,
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left', padding: '6px 8px',
              background: 'var(--primary-light)', color: 'var(--primary-dark)',
              borderBottom: '2px solid var(--border)', fontWeight: 700,
              position: 'sticky', top: 0,
            }}>#</th>
            {columns.map((col, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '6px 8px',
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderBottom: '2px solid var(--border)', fontWeight: 700,
                whiteSpace: 'nowrap', position: 'sticky', top: 0,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{
              background: ri % 2 === 0 ? 'var(--surface)' : 'transparent',
            }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-light)' }}>
                {ri + 1}
              </td>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '4px 8px', maxWidth: 180, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--border-light)',
                  color: cell === null ? 'var(--text-tertiary)' : 'var(--text)',
                }}>
                  {cell === null ? <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>NULL</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// History Entry Component
// ============================================================

export default ResultTable;
