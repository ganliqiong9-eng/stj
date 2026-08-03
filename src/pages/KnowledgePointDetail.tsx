import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StatusBar from '../components/StatusBar';
import PageHeader from '../components/PageHeader';
import QuizView from '../components/QuizView';
import {
  generateLearningContent,
  generateQuizByKnowledge,
  getLearningPath,
  updateLearningProgress,
  type LearningKnowledgePoint,
} from '../api';

interface Content {
  definition?: string;
  explanation?: string;
  example?: string;
  analogy?: string;
}

export default function KnowledgePointDetail() {
  const { pathId = '', chapterId = '', kpId = '' } = useParams<{ pathId: string; chapterId: string; kpId: string }>();
  const nav = useNavigate();
  const [kp, setKp] = useState<LearningKnowledgePoint | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [quizMode, setQuizMode] = useState(false);
  const [quizItems, setQuizItems] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizResult, setQuizResult] = useState<{ correct: number; total: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (silent = false) => {
    const r = await getLearningPath(pathId);
    if (r.ok && r.path) {
      const ch = r.path.chapters.find(c => c.id === chapterId);
      const k = ch?.knowledgePoints.find(x => x.id === kpId) || null;
      setKp(k || null);
      if (k) {
        if (k.content?.definition) {
          setContent(k.content);
          setContentError('');
        } else if (!silent) {
          await generate();
        }
      }
    }
    setLoaded(true);
  }, [pathId, chapterId, kpId]);

  const generate = useCallback(async () => {
    setContentLoading(true);
    setContentError('');
    const r = await generateLearningContent(kpId);
    if (r.ok) {
      setContent({ definition: r.definition, explanation: r.explanation, example: r.example, analogy: r.analogy });
    } else {
      setContentError(r.error || '内容生成失败');
    }
    setContentLoading(false);
  }, [kpId]);

  useEffect(() => {
    setLoaded(false);
    setQuizMode(false);
    setQuizResult(null);
    load();
  }, [load]);

  useEffect(() => {
    if (loaded && kp && kp.progress.status === 'not_started') {
      updateLearningProgress({ pathId, chapterId, knowledgePointId: kpId, status: 'learning' }).then(() => load(true));
    }
  }, [loaded, kp, pathId, chapterId, kpId, load]);

  const handleStartQuiz = async () => {
    setQuizLoading(true);
    setQuizError('');
    const r = await generateQuizByKnowledge(kpId, 5, ['choice', 'fill', 'short_answer']);
    if (r.ok && r.quiz.length > 0) {
      setQuizItems(r.quiz);
      setQuizResult(null);
      setQuizMode(true);
    } else {
      setQuizError(r.error || '出题失败');
    }
    setQuizLoading(false);
  };

  const handleQuizComplete = async (stats: { correct: number; total: number }) => {
    setQuizResult(stats);
    setQuizMode(false);
    const score = (total: number) => total > 0 ? Math.round((stats.correct / total) * 100) : 0;
    await updateLearningProgress({
      pathId,
      chapterId,
      knowledgePointId: kpId,
      status: 'completed',
      quizScore: score(stats.total),
    });
    await load(true);
  };

  const handleMarkDone = async () => {
    await updateLearningProgress({ pathId, chapterId, knowledgePointId: kpId, status: 'completed' });
    await load(true);
  };

  if (quizMode) {
    return (
      <div className="page">
        <StatusBar />
        <PageHeader title="知识点刷题" onBack={() => { setQuizMode(false); setQuizItems([]); }} />
        <QuizView initialQuiz={quizItems} onComplete={handleQuizComplete} />
      </div>
    );
  }

  const status = kp?.progress.status || 'not_started';
  const statusMeta = {
    not_started: { icon: '⚪', label: '未开始', color: 'var(--text-tertiary)' },
    learning: { icon: '🔄', label: '学习中', color: 'var(--primary)' },
    completed: { icon: '✅', label: '已完成', color: 'var(--green)' },
  }[status] || { icon: '⚪', label: '未开始', color: 'var(--text-tertiary)' };

  return (
    <div className="page">
      <StatusBar />
      <PageHeader
        title={kp?.title || '知识点'}
        onBack={() => nav(`/learn/${pathId}/chapter/${chapterId}`)}
        right={<span style={{ fontSize: 11, fontWeight: 700, color: statusMeta.color, whiteSpace: 'nowrap' }}>{statusMeta.icon} {statusMeta.label}</span>}
      />
      <div className="scroll">
        {!loaded && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>}

        {quizError && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--rose-light)', color: 'var(--rose)', fontSize: 12, marginBottom: 10 }}>
            {quizError}
          </div>
        )}

        {contentLoading && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            正在生成学习内容...
          </div>
        )}

        {contentError && !contentLoading && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--rose-light)', color: 'var(--rose)', fontSize: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>内容生成失败</div>
            <div style={{ marginBottom: 8 }}>{contentError}</div>
            <button onClick={generate} style={{
              padding: '8px 18px', border: '2px solid var(--rose)', borderRadius: 8,
              background: 'var(--surface)', color: 'var(--rose)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>重试</button>
          </div>
        )}

        {content && !contentLoading && (
          <>
            {content.definition && (
              <div style={{
                background: 'var(--primary-light)', borderLeft: '3px solid var(--primary)',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📖 定义</div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.7, color: 'var(--text)' }}>{content.definition}</div>
              </div>
            )}
            {content.explanation && (
              <div style={{
                background: 'var(--surface)', border: '1.5px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📚 深入理解</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>{content.explanation}</div>
              </div>
            )}
            {content.example && (
              <div style={{
                background: 'var(--bg)', border: '1.5px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>💼 实际例子</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>{content.example}</div>
              </div>
            )}
            {content.analogy && (
              <div style={{
                background: 'linear-gradient(135deg, var(--orange-light), var(--green-light))',
                borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🎯 趣味类比</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text)' }}>{content.analogy}</div>
              </div>
            )}
          </>
        )}
      </div>

      {content && !contentLoading && (
        <div style={{ flexShrink: 0, padding: '10px 16px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {quizResult && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--green-light)', color: 'var(--green)', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              本次刷题：答对 {quizResult.correct}/{quizResult.total} 题，进度已更新
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleStartQuiz} disabled={quizLoading} style={{
              flex: 1, padding: '13px 0', border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 14, fontWeight: 700, cursor: quizLoading ? 'wait' : 'pointer',
              fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff',
            }}>{quizLoading ? '⏳ 出题中...' : '📝 开始刷题'}</button>
            {status !== 'completed' ? (
              <button onClick={handleMarkDone} style={{
                flex: 1, padding: '13px 0', border: '2px solid var(--green)', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                background: 'var(--surface)', color: 'var(--green)',
              }}>✅ 标记已学</button>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                ✅ 已完成学习
              </div>
            )}
          </div>
          {status === 'completed' && kp?.progress.quizScore !== null && kp?.progress.quizScore !== undefined && (
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              刷题正确率 {Math.round(kp.progress.quizScore)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
