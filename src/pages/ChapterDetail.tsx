import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import { getLearningPath, type LearningChapter } from '../api';

function StatusDot({ status }: { status: string }) {
  if (status === 'completed') {
    return <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />;
  }
  if (status === 'learning') {
    return <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />;
  }
  return <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--text-tertiary)', flexShrink: 0 }} />;
}

const STATUS_TEXT: Record<string, { label: string; color: string }> = {
  not_started: { label: '未开始', color: 'var(--text-tertiary)' },
  learning: { label: '学习中', color: 'var(--primary)' },
  completed: { label: '已学', color: 'var(--green)' },
};

export default function ChapterDetail() {
  const { pathId = '', chapterId = '' } = useParams<{ pathId: string; chapterId: string }>();
  const nav = useNavigate();
  const [chapter, setChapter] = useState<LearningChapter | null>(null);
  const [pathName, setPathName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await getLearningPath(pathId);
      if (r.ok && r.path) {
        setPathName(r.path.name);
        const ch = r.path.chapters.find(c => c.id === chapterId);
        if (ch) setChapter(ch);
      }
      setLoading(false);
    })();
  }, [pathId, chapterId]);

  return (
    <div className="page">
      <StatusBar />
      <PageHeader title={loading ? '加载中...' : (chapter?.title || '章节')} onBack={() => nav(`/learn/${pathId}`)} />
      <div className="scroll">
        {loading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>}
        {chapter && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{pathName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: 'var(--primary)', width: `${chapter.progress.percent}%`, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {chapter.progress.completed}/{chapter.progress.total} · {chapter.progress.percent}%
              </span>
            </div>

            <div className="section-title">知识点 ({chapter.knowledgePoints.length})</div>
            {chapter.knowledgePoints.map(kp => {
              const meta = STATUS_TEXT[kp.progress.status] || STATUS_TEXT.not_started;
              return (
                <div key={kp.id} onClick={() => nav(`/learn/${pathId}/chapter/${chapterId}/kp/${kp.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '12px 14px',
                  background: 'var(--surface)', border: '1.5px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
                }}>
                  <StatusDot status={kp.progress.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{kp.title}</div>
                    {kp.progress.quizScore !== null && (
                      <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>
                        正确率 {Math.round(kp.progress.quizScore)}% · 已刷 {kp.progress.quizCount} 次
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
