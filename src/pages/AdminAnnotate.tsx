import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import db, { type KnowledgeEntry } from '../store/db';
import type { QACard } from '../data/content';
import KnowledgeCard from '../components/KnowledgeCard';
import CardEditModal from '../components/CardEditModal';

export default function AdminAnnotate() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [editCard, setEditCard] = useState<{ qa: QACard; idx: number; entryIdx: number } | null>(null);

  useEffect(() => {
    db.getAllKnowledge().then(items => setEntries(items.reverse()));
  }, []);

  const allCards = entries.flatMap((e, ei) => e.sections.filter(s => s.qa).map(s => ({ qa: s.qa!, entryIdx: ei, section: s, entry: e })));
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'pending'>('all');

  return (
    <AdminLayout title="数据标注">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[{ key: 'all', label: `全部 (${allCards.length})` }, { key: 'pending', label: '待审核' }, { key: 'reviewed', label: '已通过' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '2px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: filter === f.key ? '#1cb0f6' : '#fff', color: filter === f.key ? '#fff' : '#555', borderColor: filter === f.key ? '#1cb0f6' : '#e0e0e0' }}>
            {f.label}
          </button>
        ))}
      </div>

      {allCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>暂无知识点卡片</div>
      ) : (
        allCards.map((item, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid #e0e0e0' }}>
            <KnowledgeCard index={i} qa={item.qa}
              onRegenerate={() => {}}
              onEdit={() => setEditCard({ qa: item.qa, idx: i, entryIdx: item.entryIdx })} />
          </div>
        ))
      )}

      {editCard && (
        <CardEditModal qa={editCard.qa}
          onSave={(updated) => {
            const e = entries[editCard.entryIdx];
            const sec = e.sections.find(s => s.qa === editCard.qa);
            if (sec) sec.qa = updated;
            setEntries([...entries]);
            setEditCard(null);
          }}
          onClose={() => setEditCard(null)} />
      )}
    </AdminLayout>
  );
}
