import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2, Database, Edit3, Info, FolderOpen, Upload, RotateCcw, ChevronDown, ChevronRight, Save, X } from 'lucide-react';
import { listCompilerTables, getCompilerTableData, getFolders, moveTableToFolder, getTableMeta, updateTableMeta, type CompilerTable, type Row } from '../api';
import AdminLayout from '../components/AdminLayout';

interface TableMeta {
  description?: string;
  columns?: Record<string, { description?: string }>;
}

// Table metadata now stored server-side

type ViewMode = 'list' | 'detail';

export default function AdminDatabase() {
  const [tables, setTables] = useState<CompilerTable[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: Row[] }>({ columns: [], rows: [] });
  const [tableMeta, setTableMeta] = useState<Record<string, TableMeta>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [editDesc, setEditDesc] = useState<{ table?: string; column?: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadingMeta(true);
    const [t, f] = await Promise.all([listCompilerTables(), getFolders()]);
    setTables(t);
    setFolders(f.folders || []);
    // Load metadata from server
    const meta: Record<string, TableMeta> = {};
    for (const table of t) {
      const r = await getTableMeta(table.name);
      if (r.ok) meta[table.name] = r.meta;
    }
    setTableMeta(meta);
    setLoadingMeta(false);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTable = async (name: string) => {
    if (selectedTable === name) { setSelectedTable(null); return; }
    setSelectedTable(name);
    const data = await getCompilerTableData(name);
    setTableData(data);
  };

  const saveMeta = async () => {
    const tableName = editDesc?.table;
    if (!tableName) return;
    const current = tableMeta[tableName] || {};
    if (!editDesc.column) {
      current.description = editValue;
    } else {
      const cols = { ...current.columns, [editDesc.column]: { description: editValue } };
      current.columns = cols;
    }
    await updateTableMeta(tableName, current);
    setTableMeta(prev => ({ ...prev, [tableName]: current }));
    setEditDesc(null);
  };

  const moveToFolder = async (tableName: string, folderId: string) => {
    await moveTableToFolder(tableName, folderId);
    load();
  };

  const meta = (t: string) => tableMeta[t] || {};
  const colMeta = (t: string, c: string) => meta(t).columns?.[c] || {};

  const typeColor = (t: string) => {
    if (t === 'INTEGER' || t === 'INT') return { bg: '#e6f7ef', c: '#00b365' };
    if (t === 'REAL' || t === 'FLOAT' || t === 'DOUBLE') return { bg: '#e8f0ff', c: '#3370ff' };
    if (t === 'TEXT' || t === 'VARCHAR') return { bg: '#fff3e0', c: '#ff7d00' };
    if (t === 'DATE' || t === 'DATETIME') return { bg: '#ffece8', c: '#f53f3f' };
    return { bg: '#f0f0f0', c: '#666' };
  };

  return (
    <AdminLayout title="数据库管理">
      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#999', flex: 1 }}>
          共 {tables.length} 张表，总计 {tables.reduce((s, t) => s + t.rowCount, 0)} 条记录
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: '#555' }}>
          <RotateCcw size={14} /> 刷新
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>加载中...</div>
      ) : tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Database size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无数据表</div>
          <div style={{ fontSize: 12 }}>在编译器页面中导入 Excel 可创建新表</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tables.map(table => (
            <div key={table.name} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              {/* Table header */}
              <div onClick={() => openTable(table.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Table2 size={18} color="#3370ff" />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{table.name}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{table.columns.length} 列 · {table.rowCount} 行</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {folders.map(f => (
                    <button key={f.id} onClick={e => { e.stopPropagation(); moveToFolder(table.name, f.id); }}
                      style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: '#555' }}>
                      {f.icon || '📁'} {f.name}
                    </button>
                  ))}
                </div>
                {selectedTable === table.name ? <ChevronDown size={16} color="#999" /> : <ChevronRight size={16} color="#999" />}
              </div>

              {/* Expanded schema */}
              {selectedTable === table.name && (
                <div style={{ borderTop: '1px solid #eee' }}>
                  {/* Table description */}
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f5f5f5' }}>
                    <Info size={14} color="#999" />
                    {editDesc?.table === table.name && !editDesc.column ? (
                      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                        <input value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="表描述..." style={{ flex: 1, border: '1px solid #3370ff', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontFamily: 'var(--font)', outline: 'none' }} />
                        <button onClick={saveMeta} style={{ border: 'none', background: '#3370ff', color: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}><Save size={12} /></button>
                        <button onClick={() => setEditDesc(null)} style={{ border: 'none', background: '#f0f0f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: '#666', flex: 1 }}>{meta(table.name).description || '暂无描述'}</span>
                        <button onClick={() => { setEditDesc({ table: table.name }); setEditValue(meta(table.name).description || ''); }} style={{ border: 'none', background: 'none', color: '#3370ff', cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font)', padding: '2px 4px' }}>
                          <Edit3 size={12} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Column list */}
                  {tableData.rows.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: '#999' }}>暂无数据</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '1px solid #e0e0e0' }}>字段名</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '1px solid #e0e0e0' }}>类型</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '1px solid #e0e0e0' }}>描述</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '1px solid #e0e0e0' }}>样例</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.columns.map((col, i) => {
                            const tc = typeColor(col);
                            const sample = tableData.rows[0]?.[i]?.toString() || '-';
                            return (
                              <tr key={col} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1f2329' }}>{col}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.c }}>
                                    {col === 'string' ? 'TEXT' : col === 'number' ? 'INTEGER' : col}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#666' }}>
                                  {editDesc?.table === table.name && editDesc?.column === col ? (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, border: '1px solid #3370ff', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font)', outline: 'none' }} />
                                      <button onClick={saveMeta} style={{ border: 'none', background: '#3370ff', color: '#fff', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><Save size={10} /></button>
                                      <button onClick={() => setEditDesc(null)} style={{ border: 'none', background: '#f0f0f0', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><X size={10} /></button>
                                    </div>
                                  ) : (
                                    <span>{colMeta(table.name, col).description || '-'}</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#999', fontFamily: 'var(--mono)', fontSize: 10 }}>{sample}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <button onClick={() => { setEditDesc({ table: table.name, column: col }); setEditValue(colMeta(table.name, col).description || ''); }}
                                    style={{ border: 'none', background: 'none', color: '#3370ff', cursor: 'pointer', padding: '2px' }}>
                                    <Edit3 size={11} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
