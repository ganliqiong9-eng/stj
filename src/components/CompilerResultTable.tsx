import { useState, useEffect, useMemo } from 'react';
import { Copy, Download, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Row } from '../api';
import { useToast } from './Toast';

const PAGE_SIZE = 20;

function ResultTable({ columns, rows, elapsedMs }: { columns: string[]; rows: Row[]; elapsedMs?: number }) {
  const { success } = useToast();
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setSortCol(null);
    setSortDir('asc');
    setPage(0);
  }, [columns, rows]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null) return 1;
      if (vb === null) return -1;
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'zh')
        : String(vb).localeCompare(String(va), 'zh');
    });
  }, [rows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (col: number) => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  };

  const buildCSV = () => {
    const header = columns.join(',');
    const body = rows.map(r => r.map(c =>
      c === null ? '' : `"${String(c).replace(/"/g, '""')}"`
    ).join(','));
    return '\uFEFF' + [header, ...body].join('\n');
  };

  const copyCSV = async () => {
    try {
      await navigator.clipboard.writeText(buildCSV());
      success(`已复制 ${rows.length} 行 CSV`);
    } catch {
      success('复制失败，请手动选择');
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([buildCSV()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCell = async (value: string | number | null) => {
    try {
      await navigator.clipboard.writeText(value === null ? '' : String(value));
      success('已复制单元格');
    } catch {
      success('复制失败');
    }
  };

  if (columns.length === 0) return null;

  return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '8px 10px', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 11 }}>
          ✓ 返回 {rows.length} 行{elapsedMs !== undefined ? ` · 耗时 ${elapsedMs}ms` : ''}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={copyCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
            <Copy size={11} /> 复制 CSV
          </button>
          <button onClick={downloadCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
            <Download size={11} /> 下载 CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 11, tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{
                textAlign: 'left', padding: '6px 8px', minWidth: 36, width: 36,
                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                borderBottom: '2px solid var(--border)', fontWeight: 700,
                position: 'sticky', top: 0, zIndex: 2,
              }}>#</th>
              {columns.map((col, i) => (
                <th key={i} onClick={() => toggleSort(i)}
                  title="点击排序"
                  style={{
                    textAlign: 'left', padding: '6px 8px', minWidth: 60, maxWidth: 240,
                    background: 'var(--primary-light)', color: 'var(--primary-dark)',
                    borderBottom: '2px solid var(--border)', fontWeight: 700,
                    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2,
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {col}
                    {sortCol === i && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
                <td style={{ padding: '4px 8px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-light)' }}>
                  {safePage * PAGE_SIZE + ri + 1}
                </td>
                {row.map((cell, ci) => (
                  <td key={ci}
                    onDoubleClick={() => copyCell(cell)}
                    title={cell === null ? 'NULL' : String(cell)}
                    style={{
                      padding: '4px 8px', minWidth: 60, maxWidth: 240, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-light)',
                      color: cell === null ? 'var(--text-tertiary)' : 'var(--text)',
                      cursor: 'copy',
                    }}>
                    {cell === null ? <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>NULL</span> : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedRows.length > PAGE_SIZE && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '8px 10px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 10, color: 'var(--text-tertiary)',
        }}>
          <span>
            显示 {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, sortedRows.length)} / 共 {sortedRows.length} 行
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0}
              style={{ border: '1px solid var(--border)', background: 'transparent', borderRadius: 6, padding: '3px 6px', cursor: safePage === 0 ? 'default' : 'pointer', opacity: safePage === 0 ? 0.4 : 1, color: 'var(--text-secondary)', display: 'flex' }}>
              <ChevronLeft size={12} />
            </button>
            <span>{safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages - 1}
              style={{ border: '1px solid var(--border)', background: 'transparent', borderRadius: 6, padding: '3px 6px', cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', opacity: safePage >= totalPages - 1 ? 0.4 : 1, color: 'var(--text-secondary)', display: 'flex' }}>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// History Entry Component
// ============================================================

export default ResultTable;
