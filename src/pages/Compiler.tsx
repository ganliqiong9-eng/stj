import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, CheckCircle, RotateCcw, Upload, Database, 
  Code, Table2, FileSpreadsheet, Terminal,
  ChevronRight, ChevronDown, AlertCircle, Loader,
  FileType, BookOpen, Copy, Trash2
} from 'lucide-react';
import { 
  runCompilerCode, listCompilerTables, getCompilerTableData,
  importCompilerExcel, resetCompilerDB, getCompilerSampleQueries,
  type CompilerTable, type Row
} from '../api';
import { MAX_UPLOAD_SIZE } from '../api';
import StatusBar from '../components/StatusBar';
import CompilerResultTable from '../components/CompilerResultTable';
import CompilerHistoryEntry from '../components/CompilerHistoryEntry';

// ============================================================
// Types
// ============================================================
type Tab = 'editor' | 'tables' | 'import';
export type ResultEntry = {
  id: number;
  language: 'sql' | 'python';
  code: string;
  ok: boolean;
  msg: string;
  columns: string[];
  rows: Row[];
  timestamp: string;
};

// ============================================================
// SQL Syntax Check (local)
// ============================================================
function localCheckSQL(code: string): { ok: boolean; msg: string } {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, msg: '请输入 SQL 代码' };
  const upper = trimmed.toUpperCase();
  if (!/^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXPLAIN|PRAGMA)/.test(upper)) {
    return { ok: false, msg: 'SQL 应以 SELECT/INSERT/UPDATE/DELETE/CREATE 等开头' };
  }
  let bal = 0;
  for (const ch of trimmed) { if (ch === '(') bal++; if (ch === ')') bal--; }
  if (bal !== 0) return { ok: false, msg: '括号不匹配' };
  return { ok: true, msg: 'SQL 语法校验通过 ✓' };
}

function localCheckPython(code: string): { ok: boolean; msg: string } {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, msg: '请输入 Python 代码' };
  const lines = trimmed.split('\n');
  const errors: string[] = [];
  let pBal = 0, bBal = 0, cBal = 0;
  const kwNeedsColon = /^(def |class |if |elif |else|for |while |with |try|except |finally|match )/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/#.*$/, '').trimEnd();
    if (!stripped || stripped.startsWith('#')) continue;
    for (const ch of stripped.replace(/(['"]).*?\1/g, '')) {
      if (ch === '(') pBal++; if (ch === ')') pBal--;
      if (ch === '[') bBal++; if (ch === ']') bBal--;
      if (ch === '{') cBal++; if (ch === '}') cBal--;
    }
    if (kwNeedsColon.test(stripped.trimStart()) && !stripped.trimEnd().endsWith(':') && !stripped.trimEnd().endsWith('\\')) {
      errors.push(`第 ${i + 1} 行: '${stripped.trimStart().split(/[ (:]/)[0]}' 语句末尾缺少 ':'`);
    }
  }
  if (pBal !== 0) errors.push(`圆括号不匹配（差 ${Math.abs(pBal)} 个 ${pBal > 0 ? '(' : ')'}）`);
  if (bBal !== 0) errors.push(`方括号不匹配（差 ${Math.abs(bBal)} 个 ${bBal > 0 ? '[' : ']'}）`);
  if (cBal !== 0) errors.push(`花括号不匹配（差 ${Math.abs(cBal)} 个 ${cBal > 0 ? '{' : '}'}）`);
  if (errors.length > 0) {
    return { ok: false, msg: '发现以下问题:\n' + errors.slice(0, 5).join('\n') };
  }
  return { ok: true, msg: 'Python 语法校验通过 ✓' };
}

// ============================================================
// Result Table Component
// ============================================================
export default function Compiler() {
  const nav = useNavigate();
  const [lang, setLang] = useState<'sql' | 'python'>('sql');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ResultEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tables tab state
  const [tables, setTables] = useState<CompilerTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: Row[] }>({ columns: [], rows: [] });
  const [tableDataLoading, setTableDataLoading] = useState(false);

  // Import tab state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTableName, setImportTableName] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample queries
  const [sampleQueries, setSampleQueries] = useState<{ sql: { title: string; code: string }[]; python: { title: string; code: string }[] }>({
    sql: [], python: []
  });
  const [showSamples, setShowSamples] = useState(false);

  // Load sample queries and tables on mount
  useEffect(() => {
    getCompilerSampleQueries().then(setSampleQueries).catch(() => {});
    loadTables();
  }, []);

  // ====== Actions ======
  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    const data = await listCompilerTables();
    setTables(data);
    setTablesLoading(false);
  }, []);

  const loadTableData = useCallback(async (name: string) => {
    setTableDataLoading(true);
    setSelectedTable(name);
    const data = await getCompilerTableData(name);
    setTableData(data);
    setTableDataLoading(false);
  }, []);

  const handleRun = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setCheckResult(null);
    setShowSamples(false);

    const result = await runCompilerCode(lang, code);

    const entry: ResultEntry = {
      id: Date.now(),
      language: lang,
      code,
      ok: result.ok,
      msg: result.msg,
      columns: result.columns || [],
      rows: result.rows || [],
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory(prev => [entry, ...prev]);
    setExpandedId(entry.id);
    setLoading(false);
  };

  const handleCheck = () => {
    if (lang === 'sql') setCheckResult(localCheckSQL(code));
    else setCheckResult(localCheckPython(code));
  };

  const handleInsertSample = (item: { title: string; code: string }) => {
    setCode(item.code);
    setActiveTab('editor');
    setShowSamples(false);
  };

  const handleReset = async () => {
    const confirmed = window.confirm('确认重置数据库？所有导入的数据将丢失。');
    if (!confirmed) return;
    const result = await resetCompilerDB();
    setCheckResult(result);
    await loadTables();
    setSelectedTable(null);
    setTableData({ columns: [], rows: [] });
  };

  const handleImportFile = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const result = await importCompilerExcel(importFile, importTableName || undefined);
    setImportResult(result);
    setImporting(false);
    if (result.ok) {
      await loadTables();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_UPLOAD_SIZE) {
        alert(`文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），请选择 50 MB 以内的文件`);
        e.target.value = '';
        return;
      }
      setImportFile(file);
      // Auto-fill table name from filename (without extension)
      if (!importTableName) {
        setImportTableName(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
      }
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setExpandedId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  // ====== Render ======
  return (
    <div className="page">
      <StatusBar />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>代码编译器</h2>
        <select value={lang} onChange={e => { setLang(e.target.value as 'sql' | 'python'); setCode(''); setCheckResult(null); }}
          style={{
            padding: '4px 10px', borderRadius: 8, border: '2px solid var(--border)',
            background: 'var(--surface)', fontSize: 12, fontFamily: 'var(--font)',
            fontWeight: 600, color: 'var(--text)'
          }}>
          <option value="sql">SQL</option>
          <option value="python">Python</option>
        </select>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 2, margin: '4px 12px 0', padding: 3,
        background: 'var(--border)', borderRadius: 10,
      }}>
        {([
          { key: 'editor' as Tab, label: '编辑器', icon: Code },
          { key: 'tables' as Tab, label: '数据表', icon: Database },
          { key: 'import' as Tab, label: '导入', icon: FileSpreadsheet },
        ]).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '7px 0', border: 'none', borderRadius: 8,
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-tertiary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font)', transition: 'all .2s',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}>
              <Icon size={14} strokeWidth={2.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ====== Editor Tab ====== */}
      {activeTab === 'editor' && (
        <>
          {/* Code Editor */}
          <div style={{
            flex: 1, margin: '4px 12px 0', borderRadius: 'var(--radius-sm)',
            overflow: 'hidden', border: '2px solid var(--border)',
            display: 'flex', flexDirection: 'column',
          }}>
            <textarea value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'sql' 
                ? '-- 输入 SQL 代码\nSELECT * FROM employees;\n\n提示: Shift+Enter 快速执行' 
                : '# 输入 Python 代码\nprint("Hello World!")\n\n提示: Shift+Enter 快速执行'}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                padding: '12px 14px', minHeight: 150,
                fontFamily: 'var(--mono)', fontSize: 14, lineHeight: 1.6,
                background: '#1e1e2e', color: '#cdd6f4', tabSize: 2,
              }} />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 6, padding: '4px 12px 0' }}>
            <button onClick={handleRun} disabled={loading || !code.trim()}
              style={{
                flex: 2, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font)',
                background: loading ? 'var(--border)' : 'var(--primary)', color: loading ? 'var(--text-tertiary)' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(28,176,246,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {loading ? <Loader size={16} className="spin" /> : <Play size={16} />}
              {loading ? '运行中...' : '运行代码'}
            </button>
            <button onClick={handleCheck}
              style={{
                flex: 1, padding: '10px 0', border: '2px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
                background: 'var(--surface)', color: 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              <CheckCircle size={14} /> 语法检查
            </button>
            <button onClick={() => setShowSamples(!showSamples)}
              style={{
                padding: '10px 12px', border: '2px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
                background: 'var(--surface)', color: 'var(--text)',
              }}>
              <BookOpen size={14} />
            </button>
          </div>

          {/* Keyboard shortcut */}
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '2px 14px 0' }}>
            Shift+Enter 运行 · Shift+Enter 运行代码
          </div>

          {/* Local syntax check */}
          {checkResult && (
            <div style={{
              margin: '4px 12px 0', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.5,
              background: checkResult.ok ? 'var(--green-light)' : 'var(--rose-light)',
              color: checkResult.ok ? 'var(--green)' : 'var(--rose)',
              whiteSpace: 'pre-wrap',
            }}>
              {checkResult.ok ? '✓ ' : '✗ '}{checkResult.msg}
            </div>
          )}

          {/* Sample queries panel */}
          {showSamples && (
            <div style={{
              margin: '4px 12px 0', borderRadius: 'var(--radius-sm)',
              border: '2px solid var(--border)', overflow: 'hidden',
              background: 'var(--surface)',
            }}>
              <div style={{
                padding: '8px 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <BookOpen size={12} /> 示例代码（点击插入）
              </div>
              {sampleQueries[lang]?.map((item, i) => (
                <button key={i} onClick={() => handleInsertSample(item)}
                  style={{
                    width: '100%', display: 'block', textAlign: 'left',
                    padding: '8px 12px', border: 'none', borderBottom: i < sampleQueries[lang].length - 1 ? '1px solid var(--border-light)' : 'none',
                    background: 'transparent', cursor: 'pointer',
                    fontFamily: 'var(--font)', fontSize: 11, color: 'var(--text)',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
                  <div style={{
                    fontSize: 10, color: 'var(--text-tertiary)',
                    fontFamily: 'var(--mono)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.code.substring(0, 80)}...
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* History / Results */}
          <div style={{
            flex: 1, margin: '4px 12px 6px', overflowY: 'auto',
            display: history.length === 0 ? 'flex' : 'block',
          }}>
            {history.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-tertiary)', fontSize: 12,
              }}>
                <Terminal size={32} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div style={{ fontWeight: 600, marginBottom: 2 }}>等待运行</div>
                <div>输入代码后点击「运行代码」</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  或从「示例」中选取一段代码
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 2px 4px', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  <span>执行历史 ({history.length})</span>
                  <button onClick={handleClearHistory}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--rose)', fontFamily: 'var(--font)',
                      fontSize: 10, fontWeight: 600, padding: '2px 4px',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                    <Trash2 size={10} /> 清除
                  </button>
                </div>
                {history.map(entry => (
                  <HistoryEntry
                    key={entry.id}
                    entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ====== Tables Tab ====== */}
      {activeTab === 'tables' && (
        <div style={{ flex: 1, margin: '4px 12px 6px', overflowY: 'auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 2px 6px', fontSize: 11, fontWeight: 600,
            color: 'var(--text-secondary)',
          }}>
            <span>数据库表 ({tables.length})</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => loadTables()}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', fontFamily: 'var(--font)',
                  fontSize: 10, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                <RotateCcw size={10} /> 刷新
              </button>
              <button onClick={handleReset}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--rose)', fontFamily: 'var(--font)',
                  fontSize: 10, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                <RotateCcw size={10} /> 重置
              </button>
            </div>
          </div>

          {tablesLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>
              <Loader size={20} className="spin" style={{ display: 'inline-block' }} />
              <div style={{ fontSize: 11, marginTop: 6 }}>加载中...</div>
            </div>
          ) : tables.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 30, color: 'var(--text-tertiary)',
              fontSize: 12,
            }}>
              <Database size={28} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontWeight: 600 }}>暂无数据表</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>导入 Excel 文件可创建新表</div>
            </div>
          ) : (
            tables.map(table => (
              <div key={table.name} style={{ marginBottom: 6 }}>
                <button onClick={() => loadTableData(selectedTable === table.name ? '' : table.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
                    cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12,
                    color: 'var(--text)', textAlign: 'left',
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                  <Table2 size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 700, flex: 1 }}>{table.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {table.columns.length} 列 · {table.rowCount} 行
                  </span>
                  {selectedTable === table.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {selectedTable === table.name && (
                  <div style={{
                    marginTop: 4, borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border)', overflow: 'hidden',
                    background: 'var(--surface)',
                  }}>
                    {tableDataLoading ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
                        <Loader size={14} className="spin" style={{ display: 'inline-block', marginRight: 6 }} />
                        加载数据...
                      </div>
                    ) : tableData.rows.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
                        暂无数据
                      </div>
                    ) : (
                      <CompilerResultTable columns={tableData.columns} rows={tableData.rows} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ====== Import Tab ====== */}
      {activeTab === 'import' && (
        <div style={{
          flex: 1, margin: '4px 12px 6px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '4px 2px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            从 Excel 导入数据为数据库表
          </div>

          {/* Upload area */}
          <div style={{
            border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
            padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
            background: 'var(--surface)', marginBottom: 12,
            transition: 'border-color .2s',
          }}
            onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={handleFileChange} style={{ display: 'none' }} />
            <FileType size={32} strokeWidth={1.5} style={{ marginBottom: 6, color: 'var(--primary)', opacity: 0.6 }} />
            {importFile ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {importFile.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {(importFile.size / 1024).toFixed(1)} KB · 点击更换文件
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  点击选择 Excel 文件
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  支持 .xlsx, .xls, .csv 格式
                </div>
              </div>
            )}
          </div>

          {/* Table name input */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            数据表名（可选）
          </label>
          <input value={importTableName} onChange={e => setImportTableName(e.target.value)}
            placeholder="留空则使用文件名"
            style={{
              width: '100%', border: '2px solid var(--border)', borderRadius: 10,
              padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)',
              background: 'var(--surface)', color: 'var(--text)', outline: 'none',
              marginBottom: 6,
            }} />

          {/* Info note */}
          <div style={{
            fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5,
            marginBottom: 12,
          }}>
            第一行将作为列名，后续行作为数据。支持中文列名。
          </div>

          {/* Import button */}
          <button onClick={handleImportFile} disabled={!importFile || importing}
            style={{
              width: '100%', padding: '12px 0', border: 'none',
              borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700,
              cursor: (!importFile || importing) ? 'default' : 'pointer',
              fontFamily: 'var(--font)',
              background: (!importFile || importing) ? 'var(--border)' : 'var(--primary)',
              color: (!importFile || importing) ? 'var(--text-tertiary)' : '#fff',
              boxShadow: (!importFile || importing) ? 'none' : '0 4px 12px rgba(28,176,246,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {importing ? <Loader size={16} className="spin" /> : <Upload size={16} />}
            {importing ? '导入中...' : '导入到数据库'}
          </button>

          {/* Import result */}
          {importResult && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 11, lineHeight: 1.5,
              fontFamily: importResult.ok ? 'var(--font)' : 'var(--mono)',
              background: importResult.ok ? 'var(--green-light)' : 'var(--rose-light)',
              color: importResult.ok ? 'var(--green)' : 'var(--rose)',
              whiteSpace: 'pre-wrap',
            }}>
              {importResult.ok ? '✓ ' : '✗ '}{importResult.msg}
            </div>
          )}

          {/* Database info */}
          <div style={{
            marginTop: 'auto', fontSize: 10, color: 'var(--text-tertiary)',
            textAlign: 'center', padding: '12px 0 4px',
          }}>
            {tables.length > 0 
              ? `当前数据库: ${tables.length} 张表，共 ${tables.reduce((s, t) => s + t.rowCount, 0)} 条记录`
              : '当前数据库为空'}
          </div>
        </div>
      )}
    </div>
  );
}
