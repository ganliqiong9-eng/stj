import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminListLearningPaths, adminUpdateLearningPath } from '../api';
import type { AdminLearningPath } from '../api';
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Save, Layers, Search, X, GripVertical } from 'lucide-react';
import { useToast } from '../components/Toast';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type KP = { id: string; order: number; title: string };
type Chapter = { id: string; order: number; title: string; description: string; knowledgePoints: KP[] };

const ICONS = ['📚', '🗄️', '🐍', '💻', '📊', '🇬🇧', '📈', '🔧', '🧠', '📝', '🎯', '🏗️'];
const COLORS = ['#3370ff', '#7C3AED', '#00b365', '#f53f3f', '#ff7d00', '#1cb0f6', '#58cc00', '#ff5577'];

export default function AdminLearningPathEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error, info, confirm } = useToast();
  const [path, setPath] = useState<AdminLearningPath | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editMeta, setEditMeta] = useState({ name: '', description: '', icon: '', color: '', lightBg: '' });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchModal, setBatchModal] = useState<{ mode: 'chapter' } | { mode: 'kp'; chapterId: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminListLearningPaths();
      if (!res.ok) return;
      const p = res.paths.find(x => x.id === id);
      if (!p) return;
      setPath(p);
      setChapters((p.chapters || []).map(ch => ({ ...ch, knowledgePoints: ch.knowledgePoints || [] })));
      setExpanded(new Set((p.chapters || []).map(ch => ch.id)));
      setEditMeta({ name: p.name, description: p.description, icon: p.icon, color: p.color, lightBg: p.lightBg });
    })();
  }, [id]);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 200);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const isChapterMatch = (ch: Chapter, q: string) => {
    if (!q) return true;
    if (ch.title.toLowerCase().includes(q)) return true;
    if (ch.description.toLowerCase().includes(q)) return true;
    return ch.knowledgePoints.some(kp => kp.title.toLowerCase().includes(q));
  };

  const isKpMatch = (kp: KP, q: string) => !q || kp.title.toLowerCase().includes(q);

  // Expand matching chapters while searching, restore full expansion when cleared
  useEffect(() => {
    if (searchQuery) {
      const matchIds = chapters.filter(ch => isChapterMatch(ch, searchQuery)).map(ch => ch.id);
      setExpanded(new Set(matchIds));
    } else {
      setExpanded(new Set(chapters.map(ch => ch.id)));
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredChapters = useMemo(() => {
    if (!searchQuery) return chapters;
    return chapters.filter(ch => isChapterMatch(ch, searchQuery));
  }, [chapters, searchQuery]);

  const kpMatchCount = useMemo(() => {
    if (!searchQuery) return 0;
    return chapters.reduce((sum, ch) => sum + ch.knowledgePoints.filter(kp => isKpMatch(kp, searchQuery)).length, 0);
  }, [chapters, searchQuery]);

  const toggleExpand = (chId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId);
      else next.add(chId);
      return next;
    });
  };

  const nextChapterIds = (count: number): string[] => {
    const base = id || 'path';
    let max = 0;
    for (const ch of chapters) {
      const m = ch.id.match(new RegExp(`^${base}-ch(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return Array.from({ length: count }, (_, i) => `${base}-ch${max + i + 1}`);
  };

  const nextKpIds = (ch: Chapter, count: number): string[] => {
    let max = 0;
    for (const kp of ch.knowledgePoints) {
      const m = kp.id.match(/-kp(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return Array.from({ length: count }, (_, i) => `${id}-${ch.id}-kp${max + i + 1}`);
  };

  const parseLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

  const addChapter = () => {
    const [newId] = nextChapterIds(1);
    const newCh: Chapter = {
      id: newId,
      order: chapters.length + 1,
      title: '新章节',
      description: '',
      knowledgePoints: [],
    };
    setChapters([...chapters, newCh]);
    setExpanded(prev => new Set([...prev, newCh.id]));
    setDirty(true);
  };

  const updateChapter = (chId: string, updates: Partial<Chapter>) => {
    setChapters(chapters.map(ch => ch.id === chId ? { ...ch, ...updates } : ch));
    setDirty(true);
  };

  const deleteChapter = async (chId: string) => {
    const ch = chapters.find(c => c.id === chId);
    const ok = await confirm(`删除章节「${ch?.title}」？该章节下 ${ch?.knowledgePoints.length || 0} 个知识点也将被删除。`, {
      title: '删除章节',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    setChapters(chapters.filter(c => c.id !== chId).map((c, i) => ({ ...c, order: i + 1 })));
    setDirty(true);
  };

  const moveChapter = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= chapters.length) return;
    const arr = [...chapters];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setChapters(arr.map((ch, i) => ({ ...ch, order: i + 1 })));
    setDirty(true);
  };

  const addKP = (chId: string) => {
    setChapters(chapters.map(ch => {
      if (ch.id !== chId) return ch;
      const [kpId] = nextKpIds(ch, 1);
      return {
        ...ch,
        knowledgePoints: [...ch.knowledgePoints, { id: kpId, order: ch.knowledgePoints.length + 1, title: '新知识点' }],
      };
    }));
    setDirty(true);
  };

  const updateKP = (chId: string, kpId: string, title: string) => {
    setChapters(chapters.map(ch => {
      if (ch.id !== chId) return ch;
      return { ...ch, knowledgePoints: ch.knowledgePoints.map(kp => kp.id === kpId ? { ...kp, title } : kp) };
    }));
    setDirty(true);
  };

  const deleteKP = (chId: string, kpId: string) => {
    setChapters(chapters.map(ch => {
      if (ch.id !== chId) return ch;
      return { ...ch, knowledgePoints: ch.knowledgePoints.filter(kp => kp.id !== kpId).map((kp, i) => ({ ...kp, order: i + 1 })) };
    }));
    setDirty(true);
  };

  const moveKP = (chId: string, index: number, dir: -1 | 1) => {
    setChapters(chapters.map(ch => {
      if (ch.id !== chId) return ch;
      const target = index + dir;
      if (target < 0 || target >= ch.knowledgePoints.length) return ch;
      const arr = [...ch.knowledgePoints];
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...ch, knowledgePoints: arr.map((kp, i) => ({ ...kp, order: i + 1 })) };
    }));
    setDirty(true);
  };

  const confirmBatchChapters = (text: string) => {
    const titles = parseLines(text);
    if (!titles.length) {
      info('没有可添加的章节标题');
      return;
    }
    const ids = nextChapterIds(titles.length);
    const startOrder = chapters.length + 1;
    const newChapters: Chapter[] = titles.map((title, i) => ({
      id: ids[i],
      order: startOrder + i,
      title,
      description: '',
      knowledgePoints: [],
    }));
    setChapters([...chapters, ...newChapters]);
    setExpanded(prev => new Set([...prev, ...ids]));
    setDirty(true);
    setBatchModal(null);
    success(`已添加 ${titles.length} 个章节`);
  };

  const confirmBatchKps = (chapterId: string, text: string) => {
    const titles = parseLines(text);
    if (!titles.length) {
      info('没有可添加的知识点标题');
      return;
    }
    setChapters(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      const ids = nextKpIds(ch, titles.length);
      const startOrder = ch.knowledgePoints.length + 1;
      const newKps: KP[] = titles.map((title, i) => ({ id: ids[i], order: startOrder + i, title }));
      return { ...ch, knowledgePoints: [...ch.knowledgePoints, ...newKps] };
    }));
    setDirty(true);
    setBatchModal(null);
    success(`已添加 ${titles.length} 个知识点`);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const res = await adminUpdateLearningPath(id, {
      name: editMeta.name,
      description: editMeta.description,
      icon: editMeta.icon,
      color: editMeta.color,
      lightBg: editMeta.lightBg,
      chapters,
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      success('保存成功');
    } else {
      error('保存失败：' + res.error);
    }
  };

  const goBack = async () => {
    if (dirty) {
      const ok = await confirm('有未保存的修改，确定离开？', { title: '未保存修改', confirmText: '离开' });
      if (!ok) return;
    }
    navigate('/admin/learning-paths');
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const chapterIdx = chapters.findIndex(ch => ch.id === activeId);
    if (chapterIdx !== -1) {
      const overIdx = chapters.findIndex(ch => ch.id === overId);
      if (overIdx === -1) return;
      const next = arrayMove(chapters, chapterIdx, overIdx).map((ch, i) => ({ ...ch, order: i + 1 }));
      setChapters(next);
      setDirty(true);
      return;
    }

    setChapters(chapters.map(ch => {
      const kpIdx = ch.knowledgePoints.findIndex(kp => kp.id === activeId);
      if (kpIdx === -1) return ch;
      const overKpIdx = ch.knowledgePoints.findIndex(kp => kp.id === overId);
      if (overKpIdx === -1) return ch;
      const next = arrayMove(ch.knowledgePoints, kpIdx, overKpIdx).map((kp, i) => ({ ...kp, order: i + 1 }));
      return { ...ch, knowledgePoints: next };
    }));
    setDirty(true);
  };

  if (!path) {
    return (
      <AdminLayout title="编辑学习路径">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>正在加载路径数据...</div>
          <button onClick={goBack} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>返回列表</button>
        </div>
      </AdminLayout>
    );
  }

  const kpTotal = chapters.reduce((s, ch) => s + ch.knowledgePoints.length, 0);

  return (
    <AdminLayout title={`编辑：${editMeta.name || '学习路径'}`}>
      <button onClick={goBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'var(--font)' }}>
        <ArrowLeft size={16} /> 返回列表
      </button>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="搜索章节或知识点..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 36px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'var(--font)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} title="清除搜索"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
            <X size={14} />
          </button>
        )}
        {searchQuery && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
            找到 {filteredChapters.length} 章 · {kpMatchCount} 个知识点
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>名称</label>
            <input value={editMeta.name} onChange={e => { setEditMeta({ ...editMeta, name: e.target.value }); setDirty(true); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)', fontFamily: 'var(--font)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>描述</label>
            <textarea value={editMeta.description} onChange={e => { setEditMeta({ ...editMeta, description: e.target.value }); setDirty(true); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, minHeight: 38, resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-subtle)', color: 'var(--text)', fontFamily: 'var(--font)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>图标</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 320 }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => { setEditMeta({ ...editMeta, icon: ic }); setDirty(true); }}
                  style={{ width: 32, height: 32, borderRadius: 6, border: editMeta.icon === ic ? '2px solid var(--primary)' : '1px solid var(--border)', background: editMeta.icon === ic ? 'var(--primary-light)' : 'var(--bg-subtle)', fontSize: 16, cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>主题色</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 260 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => { setEditMeta({ ...editMeta, color: c, lightBg: c + '15' }); setDirty(true); }}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: editMeta.color === c ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }}
                  title={c} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block', color: 'var(--text-secondary)' }}>ID: {path.id}</label>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {chapters.length} 章 · {kpTotal} 知识点
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>章节管理</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={addChapter}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Plus size={14} /> 添加章节
            </button>
            <button onClick={() => setBatchModal({ mode: 'chapter' })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Layers size={14} /> 批量添加
            </button>
          </div>
        </div>

        {!searchQuery && chapters.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            暂无章节，点击「添加章节」创建
          </div>
        )}

        {searchQuery && filteredChapters.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            🔍 未找到匹配「{searchInput.trim()}」的章节或知识点
          </div>
        )}

        {filteredChapters.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredChapters.map(ch => ch.id)} strategy={verticalListSortingStrategy}>
              {filteredChapters.map(ch => {
                const index = chapters.findIndex(c => c.id === ch.id);
                const visibleKps = searchQuery ? ch.knowledgePoints.filter(kp => isKpMatch(kp, searchQuery)) : ch.knowledgePoints;
                return (
                  <SortableChapter
                    key={ch.id}
                    ch={ch}
                    index={index}
                    total={chapters.length}
                    expanded={expanded.has(ch.id)}
                    query={searchQuery}
                    visibleKps={visibleKps}
                    onToggle={toggleExpand}
                    onUpdateTitle={(chId, title) => updateChapter(chId, { title })}
                    onUpdateDescription={(chId, desc) => updateChapter(chId, { description: desc })}
                    onDelete={deleteChapter}
                    onMove={moveChapter}
                    onUpdateKP={updateKP}
                    onDeleteKP={deleteKP}
                    onMoveKP={moveKP}
                    onAddKP={addKP}
                    onBatchKP={chapterId => setBatchModal({ mode: 'kp', chapterId })}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 0' }}>
        <button onClick={goBack}
          style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>取消</button>
        <button onClick={handleSave} disabled={saving || !dirty}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8, border: 'none', background: dirty ? 'var(--primary)' : '#ccc', color: '#fff', fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>
          <Save size={16} /> {saving ? '保存中...' : '保存更改'}
        </button>
      </div>

      {batchModal?.mode === 'chapter' && (
        <BatchModal
          title="批量添加章节"
          placeholder={'每行输入一个章节标题，例如：\n第18章 数据集成\n第19章 数据互操作性'}
          onClose={() => setBatchModal(null)}
          onConfirm={confirmBatchChapters}
        />
      )}
      {batchModal?.mode === 'kp' && (
        <BatchModal
          title="批量添加知识点"
          placeholder={'每行输入一个知识点标题，例如：\n数据治理定义\nDAMA车轮图\n环境因素六边形'}
          onClose={() => setBatchModal(null)}
          onConfirm={text => confirmBatchKps(batchModal.chapterId, text)}
        />
      )}
    </AdminLayout>
  );
}

function SortableChapter({
  ch, index, total, expanded, query, visibleKps,
  onToggle, onUpdateTitle, onUpdateDescription, onDelete, onMove,
  onUpdateKP, onDeleteKP, onMoveKP, onAddKP, onBatchKP,
}: {
  ch: Chapter;
  index: number;
  total: number;
  expanded: boolean;
  query: string;
  visibleKps: KP[];
  onToggle: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateDescription: (id: string, desc: string) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdateKP: (chId: string, kpId: string, title: string) => void;
  onDeleteKP: (chId: string, kpId: string) => void;
  onMoveKP: (chId: string, index: number, dir: -1 | 1) => void;
  onAddKP: (chId: string) => void;
  onBatchKP: (chId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });

  return (
    <div ref={setNodeRef} {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: isDragging ? '1px dashed var(--primary)' : '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 10,
        overflow: 'hidden',
        background: 'var(--surface)',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.14)' : 'none',
        position: 'relative',
        zIndex: isDragging ? 2 : 'auto',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 10px 8px', background: 'var(--bg-card)', cursor: 'pointer' }}
        onClick={() => onToggle(ch.id)}>
        <button {...listeners} onClick={e => e.stopPropagation()} title="拖拽排序"
          style={{ cursor: 'grab', background: 'none', border: 'none', padding: 4, color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', touchAction: 'none' }}>
          <GripVertical size={16} />
        </button>
        {expanded ? <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
        <HighlightInput value={ch.title} query={query} onChange={v => onUpdateTitle(ch.id, v)} fontSize={13} padding="2px 4px" fontWeight={600} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{ch.knowledgePoints.length} 知识点</span>
        <button onClick={e => { e.stopPropagation(); onMove(index, -1); }} disabled={index === 0} title="章节上移"
          style={{ border: 'none', background: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: 2, color: 'var(--text-secondary)', fontSize: 12 }}>↑</button>
        <button onClick={e => { e.stopPropagation(); onMove(index, 1); }} disabled={index === total - 1} title="章节下移"
          style={{ border: 'none', background: 'none', cursor: index === total - 1 ? 'default' : 'pointer', opacity: index === total - 1 ? 0.3 : 1, padding: 2, color: 'var(--text-secondary)', fontSize: 12 }}>↓</button>
        <button onClick={e => { e.stopPropagation(); onDelete(ch.id); }} title="删除章节"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, flexShrink: 0 }}>
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '8px 14px 14px 36px' }}>
          <input value={ch.description} onChange={e => onUpdateDescription(ch.id, e.target.value)}
            placeholder="章节描述（可选）"
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 10, boxSizing: 'border-box', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', fontFamily: 'var(--font)' }} />

          <SortableContext items={visibleKps.map(kp => kp.id)} strategy={verticalListSortingStrategy}>
            {visibleKps.map(kp => {
              const kpIndex = ch.knowledgePoints.findIndex(k => k.id === kp.id);
              return (
                <SortableKP
                  key={kp.id}
                  kp={kp}
                  index={kpIndex}
                  total={ch.knowledgePoints.length}
                  query={query}
                  onUpdate={title => onUpdateKP(ch.id, kp.id, title)}
                  onDelete={() => onDeleteKP(ch.id, kp.id)}
                  onMove={(i, dir) => onMoveKP(ch.id, i, dir)}
                />
              );
            })}
          </SortableContext>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => onAddKP(ch.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Plus size={12} /> 添加知识点
            </button>
            <button onClick={() => onBatchKP(ch.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--primary)', background: 'transparent', fontSize: 11, color: 'var(--primary)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              <Layers size={12} /> 批量添加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableKP({ kp, index, total, query, onUpdate, onDelete, onMove }: {
  kp: KP;
  index: number;
  total: number;
  query: string;
  onUpdate: (title: string) => void;
  onDelete: () => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kp.id });

  return (
    <div ref={setNodeRef} {...attributes}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0',
        borderBottom: index < total - 1 ? '1px solid var(--border-light)' : 'none',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 2 : 'auto',
        background: isDragging ? 'var(--bg-card)' : 'transparent',
        borderRadius: isDragging ? 6 : 0,
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,.12)' : 'none',
      }}>
      <button {...listeners} title="拖拽排序"
        style={{ cursor: 'grab', background: 'none', border: 'none', padding: 2, color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', touchAction: 'none' }}>
        <GripVertical size={12} />
      </button>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 20, textAlign: 'center', flexShrink: 0 }}>{kp.order}</span>
      <HighlightInput value={kp.title} query={query} onChange={onUpdate} fontSize={12} padding="2px 6px" />
      <button onClick={() => onMove(index, -1)} disabled={index === 0} title="知识点上移"
        style={{ border: 'none', background: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, fontSize: 12, color: 'var(--text-secondary)', padding: 2, flexShrink: 0 }}>↑</button>
      <button onClick={() => onMove(index, 1)} disabled={index === total - 1} title="知识点下移"
        style={{ border: 'none', background: 'none', cursor: index === total - 1 ? 'default' : 'pointer', opacity: index === total - 1 ? 0.3 : 1, fontSize: 12, color: 'var(--text-secondary)', padding: 2, flexShrink: 0 }}>↓</button>
      <button onClick={onDelete} title="删除知识点"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, flexShrink: 0 }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function HighlightInput({ value, query, onChange, fontSize = 12, padding = '4px 8px', fontWeight = 400, placeholder }: {
  value: string;
  query: string;
  onChange: (v: string) => void;
  fontSize?: number;
  padding?: string;
  fontWeight?: number;
  placeholder?: string;
}) {
  const active = !!query && value.toLowerCase().includes(query);
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {active && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, padding, fontSize, fontWeight, lineHeight: 1.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', pointerEvents: 'none', color: 'var(--text)' }}>
          <Highlight text={value} query={query} />
        </div>
      )}
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 1, width: '100%', border: 'none', outline: 'none', background: 'transparent', padding, fontSize, fontWeight, lineHeight: 1.5, color: active ? 'transparent' : 'var(--text)', caretColor: 'var(--text)', fontFamily: 'var(--font)' }} />
    </div>
  );
}

function BatchModal({ title, placeholder, onClose, onConfirm }: {
  title: string;
  placeholder: string;
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const count = text.split('\n').map(s => s.trim()).filter(Boolean).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, width: 520, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>{title}</h3>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', minHeight: 200, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>将添加 {count} 条</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>取消</button>
            <button onClick={() => onConfirm(text)} disabled={count === 0}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: count === 0 ? 'default' : 'pointer', opacity: count === 0 ? 0.6 : 1, fontFamily: 'var(--font)' }}>
              确认添加（{count}）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
