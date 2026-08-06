import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Database, FileSpreadsheet, Clipboard, Trash2, RefreshCw, ChevronDown, ChevronRight, Search } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import Toast, { type ToastData } from '../components/Toast';
import db, { type KnowledgeEntry } from '../store/db';
import { formatDate } from '../components/KnowledgeUtils';
import { deleteKnowledge } from '../api';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  indexed: { label: '已入库', color: '#00b365', bg: 'var(--success-light)' },
  parsing: { label: '解析中', color: '#3370ff', bg: 'var(--primary-light)' },
  error: { label: '失败', color: '#f53f3f', bg: 'var(--danger-light)' },
};

const typeConfig: Record<string, { label: string; icon: any }> = {
  doc: { label: '文档', icon: FileText },
  paste: { label: '粘贴', icon: Clipboard },
  table: { label: '表格', icon: FileSpreadsheet },
};

export default function AdminKnowledge() {
  const nav = useNavigate();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSubj, setFilterSubj] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizResult, setQuizResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const items = await db.getAllKnowledge();
    setEntries(items.reverse());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (filterStatus !== 'all') {
      const st = e.status || 'indexed';
      if (st !== filterStatus) return false;
    }
    if (filterSubj !== 'all' && e.subj !== filterSubj) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !(e.tags && e.tags.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const handleGenerateQuiz = async () => {
    setQuizGenerating(true);
    setQuizResult(null);
    const r = await generateQuiz({ count: 10, types: ['choice', 'fill', 'short_answer'] });
    if (r.ok && r.quiz.length > 0) {
      try {
        await db.questions.bulkAdd(r.quiz.map(q => ({ ...q, subj: 'custom', star: false })));
        setQuizResult({ ok: true, msg: `生成 ${r.quiz.length} 题` });
      } catch (e) {
        // If some questions already exist, try adding one by one
        let count = 0;
        for (const q of r.quiz) {
          try { await db.questions.add({ ...q, subj: 'custom', star: false }); count++; } catch {}
        }
        setQuizResult({ ok: true, msg: `新增 ${count} 题` });
      }
    } else {
      setQuizResult({ ok: false, msg: r.error || '生成失败，请检查 API Key 配置' });
    }
    setQuizGenerating(false);
  };

  const handleDelete = async (id: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry || !window.confirm('确认删除「' + entry.title + '」？')) return;
    setDeleting(true);
    try {
      await db.deleteKnowledge(id);
      const serverOk = entry._id ? await deleteKnowledge(entry._id) : true;
      setToast(serverOk
        ? { msg: '删除成功', type: 'success' }
        : { msg: '本机已删除，服务器副本删除失败', type: 'error' });
    } catch {
      setToast({ msg: '删除失败，请重试', type: 'error' });
    } finally {
      setDeleting(false);
      load();
    }
  };

  const qaCount = (entry: KnowledgeEntry) => entry.sections.filter(s => s.qa).length;

  const totalChunks = entries.reduce((s, e) => s + e.sections.length, 0);
  const totalQaCards = entries.reduce((s, e) => s + qaCount(e), 0);

  return (
    <AdminLayout title="知识库">
      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatCard label="文档数" value={entries.length} color="#3370ff" />
        <StatCard label="知识点" value={totalChunks} color="#00b365" />
        <StatCard label="AI 卡片" value={totalQaCards} color="#ff7d00" />
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索知识..." style={{ width: '100%', border: '2px solid #e0e0e0', borderRadius: 8, padding: '7px 10px 7px 32px', fontSize: 12, fontFamily: 'var(--font)', outline: 'none', background: '#fff' }} />
        </div>
        {[
          { key: 'all', label: '全部' },
          { key: 'indexed', label: '已入库' },
          { key: 'parsing', label: '解析中' },
          { key: 'error', label: '失败' },
        ].map(f => (
          <span key={f.key} onClick={() => setFilterStatus(f.key)}
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: filterStatus === f.key ? '#3370ff' : '#f0f0f0', color: filterStatus === f.key ? '#fff' : '#555', whiteSpace: 'nowrap' }}>
            {f.label}
          </span>
        ))}
        <select value={filterSubj} onChange={e => setFilterSubj(e.target.value)} style={{ border: '2px solid #e0e0e0', borderRadius: 6, padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font)', background: '#fff', outline: 'none' }}>
          <option value="all">全科目</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">数据分析</option><option value="dma">DAMA</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <BookOpen size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无内容</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>上传文档后自动生成知识点</div>
          <button onClick={() => nav('/admin/upload')} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: '#3370ff', color: '#fff' }}>去上传</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(entry => {
            const st = entry.status || 'indexed';
            const sc = statusConfig[st] || statusConfig.indexed;
            const tc = typeConfig[entry.type || 'doc'];
            const Icon = tc?.icon || FileText;
            const qaCards = qaCount(entry);
            const isExpanded = expanded === entry.id;

            return (
              <div key={entry.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div onClick={() => setExpanded(isExpanded ? null : entry.id!)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon size={18} color="#3370ff" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2329' }}>{entry.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: '#999', flexWrap: 'wrap' }}>
                      <span>{entry.subj}</span>
                      <span>{entry.sections.length} 个知识点</span>
                      {qaCards > 0 && <span style={{ color: '#ff7d00', fontWeight: 600 }}>{qaCards} 张卡片</span>}
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); handleDelete(entry.id!); }}
                      style={{ border: 'none', background: 'none', color: '#f53f3f', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                      title="删除" disabled={deleting}><Trash2 size={14} /></button>
                  </div>
                  {isExpanded ? <ChevronDown size={16} color="#999" /> : <ChevronRight size={16} color="#999" />}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>知识点 ({entry.sections.length})</div>
                    {entry.sections.slice(0, 5).map((sec, i) => (
                      <div key={i} style={{ fontSize: 11, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, color: '#1f2329' }}>{sec.title || `节 ${i + 1}`}</span>
                          {sec.level && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: sec.level === 'beginner' ? 'var(--success-light)' : sec.level === 'intermediate' ? 'var(--warning-light)' : 'var(--danger-light)', color: sec.level === 'beginner' ? '#00b365' : sec.level === 'intermediate' ? '#ff7d00' : '#f53f3f' }}>
                              {sec.level === 'beginner' ? '入门' : sec.level === 'intermediate' ? '进阶' : '实战'}
                            </span>
                          )}
                          {sec.qa && <span style={{ fontSize: 9, color: '#ff7d00' }}>有卡片</span>}
                        </div>
                        <div style={{ color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{sec.body?.substring(0, 120) || '(空)'}</div>
                      </div>
                    ))}
                    {entry.sections.length > 5 && <div style={{ fontSize: 10, color: '#999', textAlign: 'center', padding: 4 }}>还有 {entry.sections.length - 5} 个知识点...</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AdminLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e0e0e0' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{label}</div>
    </div>
  );
}
