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
      const quizHistory = await db.getQuizHistory();
      const wrongList = await db.getWrongAnswers();
      const bySubj: Record<string, number> = {};
      for (const k of allK) {
        bySubj[k.subj] = (bySubj[k.subj] || 0) + 1;
      }
      setData({ allK, wrongC, qTotal, reviewC, streak, xp, completed, bySubj, quizHistory, wrongList, docCount: allK.length, chunkCount: allK.reduce((s: number, e: any) => s + e.sections.length, 0) });
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
    md += `## 本周数据\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 本周新增知识点 | ${d.weekChunks} |\n`;
    md += `| 本周刷题数 | ${d.weekQuestions} |\n`;
    md += `| 本周正确率 | ${d.weekRate}% |\n\n`;
    md += `## 知识库分布\n\n`;
    md += `| 科目 | 文档数 |\n|------|--------|\n`;
    for (const [subj, count] of Object.entries(d.bySubj || {})) {
      md += `| ${subj} | ${count} |\n`;
    }
    md += `\n## 薄弱知识点 TOP5\n\n`;
    if ((d.weakPoints || []).length > 0) {
      d.weakPoints.forEach((w: any, i: number) => {
        md += `${i + 1}. ${w.title}（错 ${w.count} 次）\n`;
      });
    } else {
      md += `暂无错题数据，继续保持！\n`;
    }
    md += `\n## 最近 7 天正确率\n\n`;
    (d.trend || []).forEach((t: any) => {
      md += `- ${t.label}: ${t.rate === null ? '无数据' : t.rate + '%'}\n`;
    });
    md += `\n---\n\n*由 STJ 学习助手自动生成*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `STJ_${now}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page"><StatusBar /><div style={{textAlign:'center', padding:40, color:'var(--text-tertiary)'}}>加载中...</div></div>;

  const { chunkCount, wrongC, qTotal, reviewC, streak, completed, bySubj, quizHistory, wrongList } = data;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const ws = weekStart.toISOString().slice(0, 10);
  const weekChunks = (data.allK || []).filter((k: any) => (k.createdAt || '').slice(0, 10) >= ws)
    .reduce((s: number, e: any) => s + (e.sections || []).length, 0);
  const weekHistory = (quizHistory || []).filter((h: any) => h.date >= ws);
  const weekQuestions = weekHistory.reduce((s: number, h: any) => s + (h.total || 0), 0);
  const weekCorrect = weekHistory.reduce((s: number, h: any) => s + (h.correct || 0), 0);
  const weekRate = weekQuestions > 0 ? Math.round((weekCorrect / weekQuestions) * 100) : 0;

  const trend: { label: string; rate: number | null }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const day = weekHistory.filter((h: any) => h.date === ds);
    const total = day.reduce((s: number, h: any) => s + (h.total || 0), 0);
    const correct = day.reduce((s: number, h: any) => s + (h.correct || 0), 0);
    trend.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, rate: total > 0 ? Math.round((correct / total) * 100) : null });
  }

  const weakMap = new Map<string, number>();
  (wrongList || []).forEach((w: any) => {
    const title = w.knowledge?.title || (w.question || '').slice(0, 30) || '未分类';
    weakMap.set(title, (weakMap.get(title) || 0) + 1);
  });
  const weakPoints = [...weakMap.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  data.weekChunks = weekChunks;
  data.weekQuestions = weekQuestions;
  data.weekRate = weekRate;
  data.weakPoints = weakPoints;
  data.trend = trend;

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
          <StatCard icon={<BookOpen size={16} />} label="本周新增知识点" value={`${weekChunks} 个`} color="#00b365" />
          <StatCard icon={<BarChart3 size={16} />} label="本周刷题数" value={`${weekQuestions} 题`} color="#7c3aed" />
          <StatCard icon={<Award size={16} />} label="本周正确率" value={weekQuestions > 0 ? `${weekRate}%` : '-'} color={weekQuestions > 0 && weekRate >= 80 ? '#00b365' : weekQuestions > 0 && weekRate >= 60 ? '#ff7d00' : '#f53f3f'} />
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

        {/* Study calendar */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 8, border: '1px solid var(--border-light)' }}>
          <StudyCalendar />
        </div>

        {/* 最近 7 天正确率趋势 */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>最近 7 天正确率趋势</div>
          {trend.some(t => t.rate !== null) ? (
            <TrendChart data={trend} />
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>暂无刷题数据，完成一次刷题后这里会显示趋势</div>
          )}
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

        {/* 薄弱知识点 TOP5 */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>薄弱知识点 TOP5</div>
          {weakPoints.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>暂无错题数据，继续保持！</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {weakPoints.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < weakPoints.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: i === 0 ? '#f53f3f' : i === 1 ? '#ff7d00' : '#e8e8e8', color: i < 2 ? '#fff' : 'var(--text-secondary)' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{w.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)' }}>{w.count} 次</span>
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

function TrendChart({ data }: { data: { label: string; rate: number | null }[] }) {
  const W = 300;
  const H = 96;
  const P = 12;
  const pts = data.map((d, i) => {
    const x = P + (i * (W - P * 2)) / Math.max(1, data.length - 1);
    const y = d.rate === null ? null : H - P - (d.rate / 100) * (H - P * 2);
    return { x, y, ...d };
  });
  const valid = pts.filter(p => p.y !== null) as { x: number; y: number; label: string; rate: number }[];
  const line = valid.length > 1 ? valid.map(p => `${p.x},${p.y}`).join(' ') : '';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 120, display: 'block' }}>
      {[0, 50, 100].map(r => {
        const y = H - P - (r / 100) * (H - P * 2);
        return <line key={r} x1={P} y1={y} x2={W - P} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />;
      })}
      {line && <polyline points={line} fill="none" stroke="#3370ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y ?? (H - P)} r={3} fill={p.rate === null ? 'transparent' : '#3370ff'} stroke="#3370ff" strokeWidth={1.5} />
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">{p.label}</text>
          {p.rate !== null && <text x={p.x} y={(p.y ?? 0) - 6} textAnchor="middle" fontSize={8} fill="var(--text-secondary)">{p.rate}%</text>}
        </g>
      ))}
    </svg>
  );
}
