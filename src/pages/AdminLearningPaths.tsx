import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminListLearningPaths, adminDeleteLearningPath, adminDuplicateLearningPath, adminReorderLearningPaths, adminCreateLearningPath } from '../api';
import type { AdminLearningPath } from '../api';
import { Plus, Edit2, Copy, Trash2, ChevronUp, ChevronDown, BookOpen } from 'lucide-react';
import { useToast } from '../components/Toast';

const ICONS = ['📚', '🗄️', '🐍', '💻', '📊', '🇬🇧', '📈', '🔧', '🧠', '📝', '🎯', '🏗️'];
const COLORS = ['#3370ff', '#7C3AED', '#00b365', '#f53f3f', '#ff7d00', '#1cb0f6', '#58cc00', '#ff5577'];

export default function AdminLearningPaths() {
  const navigate = useNavigate();
  const { success, error, confirm } = useToast();
  const [paths, setPaths] = useState<AdminLearningPath[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await adminListLearningPaths();
    if (res.ok) setPaths(res.paths);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (p: AdminLearningPath) => {
    const ok = await confirm(`确定删除「${p.name}」？\n将同时清除 ${p.kpCount ?? 0} 个知识点的学习进度和 AI 生成内容，此操作不可撤销。`, {
      title: '删除学习路径',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    const res = await adminDeleteLearningPath(p.id);
    if (res.ok) {
      load();
      success('删除成功');
    } else {
      error('删除失败：' + res.error);
    }
  };

  const handleDuplicate = async (p: AdminLearningPath) => {
    const res = await adminDuplicateLearningPath(p.id);
    if (res.ok) {
      load();
      success('已复制：' + res.path?.name);
    } else {
      error('复制失败：' + res.error);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= paths.length) return;
    const newOrder = paths.map((p, i) => {
      if (i === index) return { id: p.id, position: target };
      if (i === target) return { id: p.id, position: index };
      return { id: p.id, position: i };
    });
    const res = await adminReorderLearningPaths(newOrder);
    if (res.ok) load();
    else error('排序失败：' + res.error);
  };

  const totalChapters = paths.reduce((s, p) => s + (p.chapterCount || 0), 0);
  const totalKps = paths.reduce((s, p) => s + (p.kpCount || 0), 0);

  return (
    <AdminLayout title="学习路径管理">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          共 {paths.length} 个路径 · {totalChapters} 章 · {totalKps} 知识点
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          <Plus size={16} /> 新建路径
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
      ) : paths.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <BookOpen size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>暂无学习路径</div>
          <div style={{ fontSize: 12 }}>点击右上角「新建路径」开始创建</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {paths.map((p, i) => (
            <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border-subtle)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 2 }}>
                <button onClick={() => handleMove(i, -1)} disabled={i === 0} title="上移"
                  style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, padding: 2, color: 'var(--text-secondary)' }}>
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => handleMove(i, 1)} disabled={i === paths.length - 1} title="下移"
                  style={{ border: 'none', background: 'none', cursor: i === paths.length - 1 ? 'default' : 'pointer', opacity: i === paths.length - 1 ? 0.3 : 1, padding: 2, color: 'var(--text-secondary)' }}>
                  <ChevronDown size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: p.lightBg || '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {p.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.id}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>{p.description}</div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span><BookOpen size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{p.chapterCount || 0} 章</span>
                <span>{p.kpCount || 0} 知识点</span>
                <span style={{ color: 'var(--success)' }}>{p.contentGeneratedCount || 0} 已生成</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => navigate(`/admin/learning-paths/${p.id}`)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>
                  <Edit2 size={14} /> 编辑
                </button>
                <button onClick={() => handleDuplicate(p)} title="复制路径"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
                  <Copy size={14} />
                </button>
                <button onClick={() => handleDelete(p)} title="删除路径"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--danger-light)', background: 'transparent', fontSize: 12, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreatePathDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </AdminLayout>
  );
}

function CreatePathDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { success } = useToast();
  const [form, setForm] = useState({ id: '', name: '', description: '', icon: '📚', color: '#3370ff', lightBg: '#f0f5ff' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.id || !form.name) { setError('ID 和名称必填'); return; }
    setSubmitting(true);
    const res = await adminCreateLearningPath(form);
    setSubmitting(false);
    if (res.ok) {
      onCreated();
      success('创建成功');
    } else {
      setError(res.error || '创建失败');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: 480, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>新建学习路径</h3>

        {error && <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>路径 ID（英文短横线格式，如 supply-chain）</label>
          <input value={form.id} onChange={e => setForm({ ...form, id: e.target.value.replace(/[^a-z0-9-]/g, '') })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)', fontFamily: 'var(--font)' }}
            placeholder="例：supply-chain" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>名称</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)', fontFamily: 'var(--font)' }}
            placeholder="例：供应链管理基础" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>描述</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, minHeight: 60, resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)', fontFamily: 'var(--font)' }}
            placeholder="简要描述这个学习路径的内容和目标" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>图标</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setForm({ ...form, icon: ic })}
                style={{ width: 36, height: 36, borderRadius: 8, border: form.icon === ic ? '2px solid var(--primary)' : '1px solid var(--border)', background: form.icon === ic ? 'var(--primary-light)' : 'var(--bg-subtle)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>主题色</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c, lightBg: c + '15' })}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }}
                title={c} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'var(--font)' }}>
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
