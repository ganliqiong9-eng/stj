import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import db, { type KnowledgeEntry } from '../store/db';
import { formatDate } from '../components/KnowledgeUtils';

export default function AdminKnowledge() {
  const nav = useNavigate();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterSubj, setFilterSubj] = useState('all');
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

  const filtered = entries.filter(e => {
    if (filterSubj !== 'all' && e.subj !== filterSubj) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !(e.tags && e.tags.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <AdminLayout title="知识管理">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索知识标题/标签..." style={{ flex: 1, minWidth: 200, border: '2px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'all', label: '全部' },
            { key: 'sql', label: 'SQL' },
            { key: 'py', label: 'Python' },
            { key: 'da', label: 'DA' },
            { key: 'dma', label: 'DAMA' },
          ].map(f => (
            <span key={f.key} onClick={() => setFilterSubj(f.key)}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: filterSubj === f.key ? '#3370ff' : '#f0f0f0', color: filterSubj === f.key ? '#fff' : '#555' }}>
              {f.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>共 {filtered.length} 个知识点</div>
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
                  <td style={{ padding: '10px 12px' }}>
                    {(() => {
                      const levels = [...new Set((k.sections || []).filter(s => s.level).map(s => s.level))];
                      const cfg: Record<string, {label:string;color:string;bg:string}> = {beginner:{label:'入门',color:'#00b365',bg:'#e6f7ef'},intermediate:{label:'进阶',color:'#ff7d00',bg:'#fff3e0'},advanced:{label:'实战',color:'#f53f3f',bg:'#ffece8'}};
                      return levels.map(l => l && cfg[l] ? <span key={l} style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:cfg[l].bg,color:cfg[l].color,marginRight:4}}>{cfg[l].label}</span> : null);
                    })()}
                  </td>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px', borderTop: '1px solid #eee', fontSize: 11, color: '#999' }}>
            <span>当前第 1/{Math.max(1, Math.ceil(filtered.length / 20))} 页</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{padding:'4px 10px',border:'1px solid #e0e0e0',borderRadius:4,cursor:'pointer',fontSize:11}}>← 上一页</span>
              <span style={{padding:'4px 10px',border:'1px solid #3370ff',borderRadius:4,background:'#3370ff',color:'#fff',fontSize:11}}>1</span>
              <span style={{padding:'4px 10px',border:'1px solid #e0e0e0',borderRadius:4,cursor:'pointer',fontSize:11}}>下一页 →</span>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
