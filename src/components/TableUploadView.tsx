import { useState, useEffect, useRef, useCallback } from 'react';
import { FileSpreadsheet, Table2, Database, Upload, Loader, FolderOpen, BookOpen } from 'lucide-react';
import { analyzeExcel, createTableFromExcel, getFolders, moveTableToFolder, MAX_UPLOAD_SIZE } from '../api';
import type { AnalyzedColumn, FolderInfo } from '../api';
import { SUBJECT_OPTIONS } from './KnowledgeUtils';

export default function TableUploadView({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analysis, setAnalysis] = useState<{
    ok: boolean; msg: string; tableName?: string; rowCount?: number;
    columns?: AnalyzedColumn[]; folderId?: string; createSql?: string;
  } | null>(null);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('general');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFolders().then(data => {
      if (data.folders.length > 0) {
        setFolders(data.folders);
        setSelectedFolder(data.folders[0]?.id || 'general');
      }
    }).catch(() => {});
  }, []);

  const handleAnalyzeRef = useRef<() => void>();

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    const r = await analyzeExcel(file);
    setAnalysis(r);
    if (r.ok && r.folderId) setSelectedFolder(r.folderId);
    setAnalyzing(false);
  };
  handleAnalyzeRef.current = handleAnalyze;

  const handleCreate = async () => {
    if (!file) return;
    setCreating(true);
    setResult(null);
    const r = await createTableFromExcel(file, selectedFolder);
    setResult(r);
    setCreating(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '2px solid var(--border)', borderRadius: 10,
    padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)',
    background: 'var(--surface)', color: 'var(--text)', outline: 'none',
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
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>表格导入 → 数据库</h2>
      </div>
      <div style={{ padding: '4px 12px 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        上传 Excel 文件，自动分析字段类型，生成数据库表，归入对应文件夹。
      </div>
      <div className="content-scroll">
        {/* File upload */}
        <div onClick={() => fileRef.current?.click()} style={{
          border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
          padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
          background: 'var(--surface)', marginBottom: 12,
        }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={e => {
              const f = e.target.files?.[0] || null;
              if (f && f.size > MAX_UPLOAD_SIZE) {
                alert("文件过大（${(f.size / 1024 / 1024).toFixed(1)} MB），请选择 50 MB 以内的文件");
                e.target.value = '';
                setAnalysis(null);
                setResult(null);
                return;
              }
              setFile(f); setAnalysis(null); setResult(null);
              // Auto-analyze immediately
              if (f) {
                setTimeout(() => {
                  handleAnalyzeRef.current ? handleAnalyzeRef.current() : handleAnalyze();
                }, 100);
              }
            }}
            style={{ display: 'none' }} />
          <FileSpreadsheet size={32} strokeWidth={1.5} style={{ marginBottom: 6, color: 'var(--primary)', opacity: 0.6 }} />
          {file ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{file.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{(file.size / 1024).toFixed(1)} KB · 点击更换</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>点击选择 Excel 文件</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>支持 .xlsx, .xls, .csv</div>
            </div>
          )}
        </div>

        {/* Auto-analyzing indicator */}
        {analyzing && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)', fontSize: 11 }}>
            <Loader size={16} className="spin" style={{ display: 'inline-block', marginRight: 6 }} />
            自动分析字段类型...
          </div>
        )}

        {/* Analysis preview */}
        {analysis && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 8,
              fontSize: 11, fontWeight: 600,
              background: analysis.ok ? 'var(--green-light)' : 'var(--rose-light)',
              color: analysis.ok ? 'var(--green)' : 'var(--rose)',
            }}>
              {analysis.ok ? `✓ ${analysis.msg}` : `✗ ${analysis.msg}`}
            </div>

            {analysis.ok && analysis.columns && (
              <>
                {/* Field preview table */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  字段预览 ({analysis.columns.length} 列)
                </div>
                <div style={{
                  overflowX: 'auto', borderRadius: 'var(--radius-sm)',
                  border: '2px solid var(--border)', marginBottom: 10,
                  background: 'var(--surface)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: 'var(--primary-light)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary-dark)', borderBottom: '2px solid var(--border)' }}>字段名</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary-dark)', borderBottom: '2px solid var(--border)' }}>类型</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary-dark)', borderBottom: '2px solid var(--border)' }}>描述</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--primary-dark)', borderBottom: '2px solid var(--border)' }}>样例</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.columns.map((col, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 700, borderBottom: '1px solid var(--border-light)' }}>{col.name}</td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                              background: col.type === 'INTEGER' ? '#e8f5e9' : col.type === 'REAL' ? '#e3f2fd' : col.type === 'DATE' ? '#fff3e0' : col.type === 'BOOLEAN' ? '#f3e5f5' : '#f5f5f5',
                              color: col.type === 'INTEGER' ? '#2e7d32' : col.type === 'REAL' ? '#1565c0' : col.type === 'DATE' ? '#e65100' : col.type === 'BOOLEAN' ? '#7b1fa2' : '#555',
                            }}>{col.type}</span>
                          </td>
                          <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {col.description}
                          </td>
                          <td style={{ padding: '5px 8px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-light)', fontFamily: 'var(--mono)', fontSize: 9 }}>
                            {col.sampleValues?.join(', ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Category display */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: 11,
                }}>
                  <BookOpen size={14} color="var(--primary)" />
                  <span style={{ color: 'var(--text-secondary)' }}>自动归类:</span>
                  <span style={{ fontWeight: 700 }}>{analysis.suggestedCategory || '通用'}</span>
                </div>

                {/* Folder selector */}
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                  选择文件夹
                </label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {folders.map(f => (
                    <button key={f.id} onClick={() => setSelectedFolder(f.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '5px 10px', borderRadius: 8, border: '2px solid',
                        borderColor: selectedFolder === f.id ? 'var(--primary)' : 'var(--border)',
                        background: selectedFolder === f.id ? 'var(--primary-light)' : 'var(--surface)',
                        color: selectedFolder === f.id ? 'var(--primary-dark)' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: 10, fontWeight: 600,
                        fontFamily: 'var(--font)',
                      }}>
                      <FolderOpen size={12} /> {f.icon} {f.name}
                    </button>
                  ))}
                </div>

                {/* Create table button */}
                <button onClick={handleCreate} disabled={creating} style={{
                  width: '100%', padding: '12px 0', border: 'none',
                  borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700,
                  cursor: creating ? 'default' : 'pointer', fontFamily: 'var(--font)',
                  background: creating ? 'var(--border)' : 'var(--primary)',
                  color: creating ? 'var(--text-tertiary)' : '#fff',
                  boxShadow: creating ? 'none' : '0 4px 12px rgba(28,176,246,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {creating ? <Loader size={16} className="spin" /> : <Database size={16} />}
                  {creating ? '创建中...' : '创建数据库表'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Create result */}
        {result && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: 11, lineHeight: 1.5,
            background: result.ok ? 'var(--green-light)' : 'var(--rose-light)',
            color: result.ok ? 'var(--green)' : 'var(--rose)',
            whiteSpace: 'pre-wrap',
          }}>
            {result.ok ? '✓ ' : '✗ '}{result.msg}
          </div>
        )}
      </div>
    </div>
  );
}
