import { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import db from '../store/db';

export default function AdminDashboard() {
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [bySubj, setBySubj] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<any[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [qTotal, setQTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const all = await db.getAllKnowledge();
      setKnowledgeCount(all.length);
      const subj: Record<string, number> = {};
      for (const k of all) { subj[k.subj] = (subj[k.subj] || 0) + 1; }
      setBySubj(subj);
      setRecent(all.reverse().slice(0, 5));
      try { setWrongCount(await db.wrongAnswers.count()); } catch {}
      try { setReviewCount(await db.getReviewCount()); } catch {}
      try { setQTotal(await db.questions.count()); } catch {}
    })();
  }, []);

  return (
    <AdminLayout title="仪表盘">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="知识点总量" value={knowledgeCount} color="#1cb0f6" />
        {Object.entries(bySubj).map(([k, v]) => <StatCard key={k} label={k} value={v} color="#58cc02" />)}
        <StatCard label="已索引" value={knowledgeCount} color="#7c3aed" />
        <StatCard label="练习量" value={qTotal} color="#3370ff" />
        <StatCard label="错题" value={wrongCount} color="#f53f3f" />
        <StatCard label="待复习" value={reviewCount} color="#ff7d00" />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>最近上传</h3>
        {recent.length === 0 ? <div style={{ fontSize: 12, color: '#999' }}>暂无数据</div> : recent.map((k, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < recent.length - 1 ? '1px solid #eee' : 'none', fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{k.title}</span>
            <span style={{ color: '#999' }}>{k.subj} · {k.sections?.length || 0}节</span>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{label}</div>
    </div>
  );
}
