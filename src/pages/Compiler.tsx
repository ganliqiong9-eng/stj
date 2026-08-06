import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, CheckCircle, RotateCcw, Upload, Database,
  Code, FileSpreadsheet, Terminal,
  ChevronRight, ChevronDown, AlertCircle, Loader,
  FileType, Trash2,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap, EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import {
  runCompilerCode, listCompilerTables, getCompilerTableData,
  importCompilerExcel, resetCompilerDB, getCompilerSampleQueries,
  type CompilerTable, type Row,
} from '../api';
import { MAX_UPLOAD_SIZE } from '../api';
import StatusBar from '../components/StatusBar';
import CompilerResultTable from '../components/CompilerResultTable';
import CompilerHistoryEntry from '../components/CompilerHistoryEntry';
import { useToast } from '../components/Toast';

// ============================================================
// Types
// ============================================================
type Tab = 'editor' | 'import';
export type ResultEntry = {
  id: number;
  language: 'sql' | 'python';
  code: string;
  ok: boolean;
  msg: string;
  columns: string[];
  rows: Row[];
  timestamp: string;
  elapsedMs?: number;
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
// Main Compiler Component
// ============================================================
export default function Compiler() {
  const nav = useNavigate();
  const { success, error, info, confirm } = useToast();
  const [lang, setLang] = useState<'sql' | 'python'>('sql');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ResultEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<ResultEntry | null>(null);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tables state
  const [tables, setTables] = useState<CompilerTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: Row[] }>({ columns: [], rows: [] });
  const [tableDataLoading, setTableDataLoading] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTableName, setImportTableName] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor refs / schema
  const editorRef = useRef<EditorView | null>(null);
  const handleRunRef = useRef<() => void>(() => {});
  const [sqlSchema, setSqlSchema] = useState<Record<string, string[]>>({});

  // Sample queries
  const [sampleQueries, setSampleQueries] = useState<{ sql: { title: string; code: string }[]; python: { title: string; code: string }[] }>({
    sql: [], python: [],
  });

  const getDark = useCallback(() =>
    document.documentElement.dataset.theme === 'dark' ||
    window.matchMedia('(prefers-color-scheme: dark)').matches, []);

  const [isDark, setIsDark] = useState(getDark);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onMq = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onMq);
    const observer = new MutationObserver(() => setIsDark(getDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', onMq);
      observer.disconnect();
    };
  }, [getDark]);

  // Load sample queries and tables on mount
  useEffect(() => {
    getCompilerSampleQueries().then(setSampleQueries).catch(() => {});
    loadTables();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Actions ======
  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    const data = await listCompilerTables();
    setTables(data);
    const schema: Record<string, string[]> = {};
    for (const t of data) schema[t.name] = t.columns;
    setSqlSchema(schema);
    setTablesLoading(false);
  }, []);

  const loadTableData = useCallback(async (name: string) => {
    setTableDataLoading(true);
    setSelectedTable(name);
    const data = await getCompilerTableData(name);
    setTableData(data);
    setTableDataLoading(false);
  }, []);

  const handleRun = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setCheckResult(null);
    const start = performance.now();
    const result = await runCompilerCode(lang, code);
    const elapsedMs = Math.round(performance.now() - start);
    const entry: ResultEntry = {
      id: Date.now(),
      language: lang,
      code,
      ok: result.ok,
      msg: result.msg,
      columns: result.columns || [],
      rows: result.rows || [],
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      elapsedMs,
    };
    setHistory(prev => [entry, ...prev]);
    setExpandedId(entry.id);
    setLastResult(entry);
    setLoading(false);
  }, [code, lang]);

  useEffect(() => {
    handleRunRef.current = () => { void handleRun(); };
  });

  const extensions = useMemo<Extension[]>(() => {
    const runKeymap = keymap.of([
      { key: 'Mod-Enter', run: () => { handleRunRef.current(); return true; } },
      { key: 'Mod-Shift-c', run: () => { setCode(''); return true; } },
    ]);
    const base: Extension[] = [runKeymap, EditorView.lineWrapping];
    return lang === 'sql'
      ? [...base, sql({ schema: sqlSchema })]
      : [...base, python()];
  }, [lang, sqlSchema]);

  const handleCheck = () => {
    if (lang === 'sql') setCheckResult(localCheckSQL(code));
    else setCheckResult(localCheckPython(code));
  };

  const handleInsertSample = (item: { title: string; code: string }) => {
    setCode(item.code);
    setActiveTab('editor');
    info(`已填入示例：${item.title}`);
  };

  const insertAtCursor = (text: string) => {
    const view = editorRef.current;
    if (view) {
      view.dispatch({ changes: { from: view.state.selection.main.head, insert: text } });
      view.focus();
    } else {
      setCode(prev => prev + text);
    }
  };

  const handleReset = async () => {
    const ok = await confirm('确认重置数据库？所有导入的数据将丢失。', {
      title: '重置数据库',
      danger: true,
      confirmText: '重置',
    });
    if (!ok) return;
    const result = await resetCompilerDB();
    setCheckResult(result);
    await loadTables();
    setSelectedTable(null);
    setTableData({ columns: [], rows: [] });
    if (result.ok) success('数据库已重置');
    else error(result.msg);
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
      success('导入成功');
    } else {
      error('导入失败：' + result.msg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_UPLOAD_SIZE) {
        error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），请选择 50 MB 以内的文件`);
        e.target.value = '';
        return;
      }
      setImportFile(file);
      if (!importTableName) {
        setImportTableName(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
      }
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setExpandedId(null);
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
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0,
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>代码编译器</h2>
        <select value={lang} onChange={e => { setLang(e.target.value as 'sql' | 'python'); setCode(''); setCheckResult(null); setLastResult(null); }}
          style={{
            padding: '4px 10px', borderRadius: 8, border: '2px solid var(--border)',
            background: 'var(--surface)', fontSize: 12, fontFamily: 'var(--font)',
            fontWeight: 600, color: 'var(--text)',
          }}>
          <option value="sql">SQL</option>
          <option value="python">Python</option>
        </select>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 2, margin: '4px 12px 0', padding: 3, background: 'var(--border)', borderRadius: 10 }}>
        {([
          { key: 'editor' as Tab, label: '编辑器', icon: Code },
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 12px 6px' }}>
          {/* Example chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>📋 示例</span>
            {sampleQueries[lang]?.map((s, i) => (
              <button key={i} onClick={() => handleInsertSample(s)}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, whiteSpace: 'nowrap',
                  border: '1px solid var(--border)', background: 'var(--bg-subtle)',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font)',
                }}>
                {s.title}
              </button>
            ))}
          </div>

          {/* Split view */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isDesktop ? 'row' : 'column', gap: 8, marginTop: 4 }}>
            {/* Editor */}
            <div style={{
              flex: isDesktop ? '5' : '1 1 46%', minHeight: isDesktop ? 0 : 260,
              display: 'flex', flexDirection: 'column',
              borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)',
              overflow: 'hidden', background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <Code size={13} color="var(--primary)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{lang.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>表名自动补全已开启</span>
                <button onClick={handleCheck} title="语法检查"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'transparent', fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font)',
                  }}>
                  <CheckCircle size={11} /> 检查
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 240, position: 'relative', overflow: 'hidden' }}>
                <CodeMirror
                  value={code}
                  height="100%"
                  theme={isDark ? oneDark : 'light'}
                  extensions={extensions}
                  onChange={val => setCode(val)}
                  onCreateEditor={view => { editorRef.current = view; }}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    autocompletion: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    indentOnInput: true,
                  }}
                  style={{ height: '100%', fontSize: 13 }}
                />
                <button onClick={handleRun} disabled={loading || !code.trim()} title="运行 (⌘/Ctrl+Enter)"
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: loading ? 'var(--text-tertiary)' : 'var(--primary)',
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,.15)', fontFamily: 'var(--font)',
                  }}>
                  {loading ? <Loader size={14} className="spin" /> : <Play size={14} />}
                  {loading ? '运行中' : '运行'}
                </button>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 8px', borderTop: '1px solid var(--border)' }}>
                ⌘/Ctrl+Enter 运行 · ⌘/Ctrl+Shift+C 清空
              </div>

              {checkResult && (
                <div style={{
                  padding: '6px 10px', fontSize: 11, fontFamily: 'var(--mono)', lineHeight: 1.5,
                  background: checkResult.ok ? 'var(--green-light)' : 'var(--rose-light)',
                  color: checkResult.ok ? 'var(--green)' : 'var(--rose)',
                  whiteSpace: 'pre-wrap', borderTop: '1px solid var(--border)',
                }}>
                  {checkResult.ok ? '✓ ' : '✗ '}{checkResult.msg}
                </div>
              )}
            </div>

            {/* Result */}
            <div style={{
              flex: isDesktop ? '4.5' : '1 1 auto', minHeight: isDesktop ? 0 : 220,
              display: 'flex', flexDirection: 'column',
              borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)',
              overflow: 'hidden', background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <Terminal size={13} color="var(--primary)" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>结果</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {lastResult ? (
                  lastResult.ok ? (
                    lastResult.columns.length > 0 ? (
                      <CompilerResultTable columns={lastResult.columns} rows={lastResult.rows} elapsedMs={lastResult.elapsedMs} />
                    ) : (
                      <div style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)', whiteSpace: 'pre-wrap' }}>
                        ✓ {lastResult.msg}
                      </div>
                    )
                  ) : (
                    <div style={{
                      margin: 10, padding: 16, borderRadius: 10,
                      background: 'var(--rose-light)', border: '1px solid var(--rose)',
                      fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8,
                      color: 'var(--rose)', whiteSpace: 'pre-wrap',
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={16} /> 执行错误
                      </div>
                      {lastResult.msg}
                    </div>
                  )
                ) : (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: 'var(--text-tertiary)', fontSize: 11, padding: 20, textAlign: 'center',
                  }}>
                    <Terminal size={26} strokeWidth={1.5} style={{ marginBottom: 6, opacity: 0.5 }} />
                    运行代码后结果将显示在这里
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tables panel */}
          <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', cursor: 'pointer', background: 'var(--bg-card)' }}
              onClick={() => setTablesOpen(!tablesOpen)}>
              <Database size={13} color="var(--primary)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>数据表 ({tables.length})</span>
              <button onClick={e => { e.stopPropagation(); loadTables(); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontFamily: 'var(--font)', fontSize: 10, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
                <RotateCcw size={10} /> 刷新
              </button>
              <button onClick={e => { e.stopPropagation(); handleReset(); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--rose)', fontFamily: 'var(--font)', fontSize: 10, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
                <RotateCcw size={10} /> 重置
              </button>
              {tablesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>

            {tablesOpen && (
              <div style={{ padding: '8px 10px' }}>
                {tablesLoading ? (
                  <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-tertiary)' }}>
                    <Loader size={16} className="spin" style={{ display: 'inline-block', marginRight: 6 }} />加载中...
                  </div>
                ) : tables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
                    <Database size={24} strokeWidth={1.5} style={{ marginBottom: 6, opacity: 0.5 }} />
                    <div>暂无数据表</div>
                    <div style={{ fontSize: 10, marginTop: 4 }}>导入 Excel 文件可创建新表</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {tables.map(t => (
                      <div key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                          border: '1px solid var(--border)', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--bg-subtle)',
                        }}
                          title={`${t.columns.join(', ')}\n${t.rowCount} 行`}>
                          <span onClick={() => insertAtCursor(t.name)} style={{ cursor: 'pointer', color: 'var(--text)' }}>{t.name}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>({t.rowCount})</span>
                          <button onClick={() => setExpandedTable(expandedTable === t.name ? null : t.name)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}>
                            {expandedTable === t.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        </div>

                        {expandedTable === t.name && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8 }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {t.columns.map(col => (
                                <span key={col} onClick={() => insertAtCursor(`${t.name}.${col}`)}
                                  style={{
                                    padding: '2px 8px', borderRadius: 4, border: '1px dashed var(--border)',
                                    fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer', color: 'var(--text-secondary)',
                                  }}>
                                  {col}
                                </span>
                              ))}
                            </div>
                            <button onClick={() => loadTableData(selectedTable === t.name ? '' : t.name)}
                              style={{ alignSelf: 'flex-start', fontSize: 10, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                              {selectedTable === t.name ? '收起数据预览' : '查看数据'}
                            </button>
                            {selectedTable === t.name && (
                              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                                {tableDataLoading ? (
                                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
                                    <Loader size={14} className="spin" style={{ display: 'inline-block', marginRight: 6 }} />加载数据...
                                  </div>
                                ) : tableData.rows.length === 0 ? (
                                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>暂无数据</div>
                                ) : (
                                  <CompilerResultTable columns={tableData.columns} rows={tableData.rows} />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History / Results */}
          <div style={{
            flex: 1, minHeight: 120, marginTop: 8, overflowY: 'auto',
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
                <div>输入代码后点击「运行」</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>或从上方「示例」中选取一段代码</div>
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
                  <CompilerHistoryEntry
                    key={entry.id}
                    entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    onReuse={c => { setCode(c); setActiveTab('editor'); success('已填入历史代码'); }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ====== Import Tab ====== */}
      {activeTab === 'import' && (
        <div style={{ flex: 1, margin: '4px 12px 6px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 2px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            从 Excel 导入数据为数据库表
          </div>

          <div style={{
            border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
            padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
            background: 'var(--surface)', marginBottom: 12, transition: 'border-color .2s',
          }}
            onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={handleFileChange} style={{ display: 'none' }} />
            <FileType size={32} strokeWidth={1.5} style={{ marginBottom: 6, color: 'var(--primary)', opacity: 0.6 }} />
            {importFile ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{importFile.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {(importFile.size / 1024).toFixed(1)} KB · 点击更换文件
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>点击选择 Excel 文件</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>支持 .xlsx, .xls, .csv 格式</div>
              </div>
            )}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>数据表名（可选）</label>
          <input value={importTableName} onChange={e => setImportTableName(e.target.value)}
            placeholder="留空则使用文件名"
            style={{
              width: '100%', border: '2px solid var(--border)', borderRadius: 10,
              padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)',
              background: 'var(--surface)', color: 'var(--text)', outline: 'none', marginBottom: 6,
            }} />

          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12 }}>
            第一行将作为列名，后续行作为数据。支持中文列名。
          </div>

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

          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0 4px' }}>
            {tables.length > 0
              ? `当前数据库: ${tables.length} 张表，共 ${tables.reduce((s, t) => s + t.rowCount, 0)} 条记录`
              : '当前数据库为空'}
          </div>
        </div>
      )}
    </div>
  );
}
