import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import db, { type KnowledgeEntry } from '../store/db';
import type { QACard } from '../data/content';
import KnowledgeCard from '../components/KnowledgeCard';
import CardEditModal from '../components/CardEditModal';

export default function AdminEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [editIdx, setEditIdx] = useState(-1);

  useEffect(() => {
    if (!id) return;
    db.getKnowledge(Number(id)).then(setEntry);
  }, [id]);

  if (!entry) return <AdminLayout title="知识编辑"><div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>加载中...</div></AdminLayout>;

  const cards = entry.sections.filter(s => s.qa).map(s => s.qa!);

  return (
    <AdminLayout title={`编辑: ${entry.title}`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>原文信息</h3>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#555' }}>
            <div><strong>科目:</strong> {entry.subj}</div>
            <div><strong>标签:</strong> {entry.tags}</div>
            <div><strong>来源:</strong> {entry.source}</div>
            <div><strong>章节:</strong> {entry.sections.length} 节</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>知识点卡片 ({cards.length})</h3>
          {cards.length === 0 ? <div style={{ fontSize: 12, color: '#999' }}>暂无知识点卡片</div> : cards.map((qa, i) => (
            <KnowledgeCard key={i} index={i} qa={qa} onRegenerate={() => {}} onEdit={() => setEditIdx(i)} />
          ))}
        </div>
      </div>
      {editIdx >= 0 && cards[editIdx] && (
        <CardEditModal qa={cards[editIdx]} onSave={(updated) => {
          const sec = entry.sections.find(s => s.qa === cards[editIdx]);
          if (sec) sec.qa = updated;
          setEntry({ ...entry });
          setEditIdx(-1);
        }} onClose={() => setEditIdx(-1)} />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => nav('/admin/knowledge')} style={{ padding: '8px 20px', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: '#555' }}>← 返回列表</button>
      </div>
    </AdminLayout>
  );
}
