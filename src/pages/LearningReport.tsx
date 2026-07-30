import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, BookOpen, TrendingUp, Award, BarChart3 } from 'lucide-react';
import db from '../store/db';
import StatusBar from '../components/StatusBar';
import StudyCalendar from '../components/StudyCalendar';

export default function LearningReport() {
  const nav = useNavigate();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const allK = await db.getAllKnowledge();
      const wrongC = await db.wrongAnswers.count();
      const qTotal = await db.questions.count();
      const reviewC = await db.getReviewCount();
      const streak = await db.getStreak();
      const xp = await db.getXp();
      const completed = await db.getCompletedCount();
      const bySubj: Record<string, number> = {};
      for (const k of allK) {
        bySubj[k.subj] = (bySubj[k.subj] || 0) + 1;
      }
      setData({ allK, wrongC, qTotal, reviewC, streak, xp, completed, bySubj, docCount: allK.length, chunkCount: allK.reduce((s: number, e: any) => s + e.sections.length, 0) });
      setLoading(false);
    })();
  }, []);

  const exportMd = () => {
    const d = data;
    const now = new Date().toISOString().slice(0, 10);
    const rate = d.qTotal > 0 ? Math.round((1 - d.wrongC / d.qTotal) * 100) : 0;
    let md = `# STJ 学习报告\n\n`;
    md += `> 生成时间: ${now}\n\n`;
    md += `## 学习概况\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 连续学习 | ${d.streak} 天 |\n`;
    md += `| 总经验值 | ${d.xp} XP |\n`;
    md += `| 已掌握章节 | ${d.completed} |\n`;
    md += `| 知识库文档 | ${d.docCount} 篇 |\n`;
    md += `| 知识点数 | ${d.chunkCount} |\n`;
    md += `| 练习总量 | ${d.qTotal} |\n`;
    md += `| 错题累计 | ${d.wrongC} |\n`;
    md += `| 综合正确率 | ${rate}% |\n`;
    md += `| 待复习 | ${d.reviewC} |\n\n`;
    md += `## 知识库分布\n\n`;
    md += `| 科目 | 文档数 |\n|------|--------|\n`;
    for (const [subj, count] of Object.entries(d.bySubj || {})) {
      md += `| ${subj} | ${count} |\n`;
    }
    md += `\n---\n\n*由 STJ 学习助手自动生成*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `STJ_${now}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page"><StatusBar /><div style={{textAlign:'center', padding:40, color:'var(--text-tertiary)'}}>加载中...</div></div>;

  const { docCount, chunkCount, wrongC, qTotal, reviewC, streak, xp, completed, bySubj } = data;
  const rate = qTotal > 0 ? Math.round((1 - wrongC / qTotal) * 100) : '-';

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>学习报告</h2>
        <button onClick={exportMd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '2px solid var(--primary)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
          <Download size={14} /> 导出
        </button>
      </div>
      <div className="scroll">
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
          <StatCard icon={<TrendingUp size={16} />} label="连续学习" value={`${streak} 天`} color="#3370ff" />
          <StatCard icon={<Award size={16} />} label="总经验" value={`${xp} XP`} color="#00b365" />
          <StatCard icon={<BookOpen size={16} />} label="知识库" value={`${docCount} 篇`} color="#7c3aed" />
          <StatCard icon={<BarChart3 size={16} />} label="正确率" value={rate !== '-' ? `${rate}%` : '-'} color={rate !== '-' && rate >= 80 ? '#00b365' : rate !== '-' && rate >= 60 ? '#ff7d00' : '#f53f3f'} />
        </div>

        {/* Detail cards */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>学习进度</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
            <div style={{ color: 'var(--text-secondary)' }}>已掌握章节</div><div style={{ fontWeight: 700, textAlign: 'right' }}>{completed}</div>
            <div style={{ color: 'var(--text-secondary)' }}>知识点总数</div><div style={{ fontWeight: 700, textAlign: 'right' }}>{chunkCount}</div>
            <div style={{ color: 'var(--text-secondary)' }}>练习总量</div><div style={{ fontWeight: 700, textAlign: 'right' }}>{qTotal}</div>
            <div style={{ color: 'var(--text-secondary)' }}>错题累计</div><div style={{ fontWeight: 700, textAlign: 'right', color: wrongC > 0 ? 'var(--rose)' : 'var(--text)' }}>{wrongC}</div>
            <div style={{ color: 'var(--text-secondary)' }}>待复习</div><div style={{ fontWeight: 700, textAlign: 'right', color: reviewC > 0 ? 'var(--warning)' : 'var(--text)' }}>{reviewC}</div>
          </div>
        </div>

        {/* Subject distribution */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>知识库分布</div>
          {Object.entries(bySubj || {}).length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(bySubj).map(([s, c]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 60, fontSize: 11, color: 'var(--text-secondary)' }}>{s}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: '#3370ff', width: `${Math.min(100, (Number(c) / Math.max(...Object.values(bySubj))) * 100)}%`, transition: 'width .5s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', minWidth: 30, textAlign: 'right' }}>{c as number}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export hint */}
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 10, color: 'var(--text-tertiary)' }}>
          点击右上角「导出」下载 Markdown 报告
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
