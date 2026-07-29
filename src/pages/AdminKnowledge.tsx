import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import db, { type KnowledgeEntry } from '../store/db';
import { formatDate } from '../components/KnowledgeUtils';

export default function AdminKnowledge() {
  const nav = useNavigate();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let items = await db.getAllKnowledge();
      items = items.reverse();
      setEntries(items);
      setLoading(false);
    })();
  }, []);

  const filtered = search ? entries.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) || (e.tags && e.tags.toLowerCase().includes(search.toLowerCase()))) : entries;

  return (
    <AdminLayout title="知识管理">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索知识标题/标签..." style={{ flex: 1, border: '2px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }} />
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>加载中...</div> : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>暂无数据</div> : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>标题</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>科目</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>章节</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>来源</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>时间</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0' }}>操作</th>
            </tr></thead>
            <tbody>
              {filtered.map((k, i) => (
                <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{k.title}</td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{k.subj}</td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{k.sections?.length || 0} 节</td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{k.source?.substring(0, 20) || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{formatDate(k.createdAt)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => nav(`/admin/knowledge/${k.id}`)} style={{ border: 'none', background: '#f0f7ff', color: '#1cb0f6', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>编辑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
