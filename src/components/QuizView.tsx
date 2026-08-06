import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, ArrowLeft, ArrowRight, Check, X, RefreshCw } from 'lucide-react';
import { deepExplain, generateQuiz } from '../api';
import db, { type QuizSession, type QuizHistoryItem } from '../store/db';
import { safeUUID } from '../utils/id';

function parseDeepExplain(content: string): {
  emoji: string;
  title: string;
  body: string;
  hasTable: boolean;
  tableData?: { headers: string[]; rows: string[][] };
}[] {
  const sections: any[] = [];
  const parts = content.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const lines = part.split('\n');
    const headerLine = lines[0]?.trim() || '';
    const emojiMatch = headerLine.match(/^(\p{Emoji_Presentation}|\p{Emoji})\s*/u);
    const emoji = emojiMatch ? emojiMatch[0].trim() : '📌';
    const title = emojiMatch ? headerLine.slice(emojiMatch[0].length).trim() : headerLine;
    const bodyLines = lines.slice(1);
    const bodyText = bodyLines.join('\n').trim();

    const tableLines = bodyLines.filter(l => l.trim().startsWith('|'));
    let hasTable = false;
    let tableData: { headers: string[]; rows: string[][] } | undefined;
    if (tableLines.length >= 2) {
      const dataLines = tableLines.filter(l => !l.match(/^\|[\s\-:|]+\|$/));
      if (dataLines.length >= 2) {
        const parseRow = (line: string) => line.split('|').slice(1, -1).map(cell => cell.trim());
        const headers = parseRow(dataLines[0]);
        const rows = dataLines.slice(1).map(parseRow);
        if (headers.length > 0 && rows.length > 0) {
          hasTable = true;
          tableData = { headers, rows };
        }
      }
    }

    let displayBody = bodyText;
    if (hasTable) {
      const beforeTable = bodyLines.slice(0, bodyLines.findIndex(l => l.trim().startsWith('|')));
      displayBody = beforeTable.join('\n').trim();
    }
    sections.push({ emoji, title, body: displayBody, hasTable, tableData });
  }
  return sections;
}

interface QuizItem {
  id: string;
  knowledgeId: string;
  type: 'choice' | 'fill' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  knowledge?: { title: string; body: string; level: string; tags: string[]; qa?: { question: string; answer: string; plain: string; analogy: string } };
}

type Phase = 'setup' | 'quiz' | 'summary';

const LEVELS = [
  { key: '', label: '全部难度' },
  { key: 'beginner', label: '入门' },
  { key: 'intermediate', label: '进阶' },
  { key: 'advanced', label: '实战' },
];

const SUBJECTS = [
  { key: '', label: '全科目' },
  { key: 'sql', label: 'SQL' },
  { key: 'py', label: 'Python' },
  { key: 'da', label: '数据分析' },
  { key: 'dma', label: 'DAMA' },
];

interface QuizViewProps {
  onBack?: () => void;
  knowledgeId?: string;
  initialQuiz?: QuizItem[];
  onComplete?: (stats: { correct: number; total: number }) => void;
}

export default function QuizView({ knowledgeId, initialQuiz, onComplete }: QuizViewProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [subj, setSubj] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answeredSet, setAnsweredSet] = useState<Record<string, boolean>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0); // for card animation
  const [loggedSummary, setLoggedSummary] = useState(false);
  const [revealedSet, setRevealedSet] = useState<Record<string, boolean>>({});
  const [deepExplainMap, setDeepExplainMap] = useState<Record<string, string>>({});
  const [loadingExplainId, setLoadingExplainId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>(safeUUID());
  const [lastSession, setLastSession] = useState<QuizSession | null>(null);
  const [deepExplainSheet, setDeepExplainSheet] = useState<{ question: QuizItem; content: string } | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<QuizHistoryItem[]>([]);
  const [historyDetail, setHistoryDetail] = useState<QuizHistoryItem | null>(null);
  const [questionStarred, setQuestionStarred] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [allUserTags, setAllUserTags] = useState<string[]>([]);

  useEffect(() => {
    db.getQuizHistoryList().then(setHistoryList).catch(() => {});
    db.getAllTags().then(setAllUserTags).catch(() => {});
  }, []);

  useEffect(() => {
    const q = quiz[currentIdx];
    if (q) {
      db.getQuestionTag(q.id).then(tag => {
        setQuestionStarred(tag?.starred || false);
        setCurrentTags(tag?.tags || []);
      }).catch(() => {});
      setShowTagEditor(false);
      setNewTagInput('');
    }
  }, [currentIdx, quiz]);

  const refreshLastSession = async () => {
    try { await db.cleanOldSessions(); } catch {}
    if (initialQuiz) return;
    try {
      const s = await db.getLastQuizSession();
      setLastSession(s && s.phase === 'quiz' && s.questions.length > 0 ? s : null);
    } catch {}
  };

  useEffect(() => {
    refreshLastSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuiz]);

  useEffect(() => {
    if (phase === 'quiz' && quiz.length > 0) {
      db.saveQuizSession({
        sessionId: currentSessionId,
        subj,
        level,
        knowledgeId,
        questions: quiz,
        answers,
        revealedSet,
        currentIndex: currentIdx,
        phase,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }, [answers, revealedSet, currentIdx, phase, quiz, currentSessionId, subj, level, knowledgeId]);

  useEffect(() => {
    if (phase === 'summary') {
      db.clearQuizSession(currentSessionId).catch(() => {});
    }
  }, [phase, currentSessionId]);

  useEffect(() => {
    if (phase === 'summary' && !loggedSummary && quiz.length > 0) {
      setLoggedSummary(true);
      const score = calcScore();
      db.logQuizResult(score, quiz.length);
      if (currentHistoryId) {
        db.updateQuizHistory(currentHistoryId, { score, completedAt: new Date().toISOString() }).then(() => db.getQuizHistoryList()).then(setHistoryList).catch(() => {});
      }
      if (onComplete) {
        onComplete({ correct: score, total: quiz.length });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loggedSummary, quiz, currentHistoryId]);

  useEffect(() => {
    if (initialQuiz && initialQuiz.length > 0) {
      setQuiz(initialQuiz);
      setAnswers({});
      setAnsweredSet({});
      setRevealedSet({});
      setDeepExplainMap({});
      setLoadingExplainId(null);
      setCurrentIdx(0);
      setLoggedSummary(false);
      setPhase('quiz');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    const [answeredQuestions, wrongAnswers] = await Promise.all([
      db.getAllHistoryForExclude().catch(() => []),
      db.getWrongAnswersForQuiz().catch(() => []),
    ]);
    const sessionId = safeUUID();
    setCurrentSessionId(sessionId);
    const r = await generateQuiz({ subj: subj || undefined, level: level || undefined, count, types: ['choice', 'fill', 'short_answer'], knowledgeId, excludeQuestions: answeredQuestions, wrongQuestions: wrongAnswers });
    if (r.ok && r.quiz.length > 0) {
      const historyId = `hist_${Date.now()}_${safeUUID()}`;
      setCurrentHistoryId(historyId);
      setQuiz(r.quiz);
      setAnswers({});
      setAnsweredSet({});
      setRevealedSet({});
      setDeepExplainMap({});
      setLoadingExplainId(null);
      setCurrentIdx(0);
      setKey(k => k + 1);
      setLoggedSummary(false);
      setPhase('quiz');
      localStorage.setItem('last_quiz', JSON.stringify(r.quiz));
      db.saveQuizSession({ sessionId, subj, level, knowledgeId, questions: r.quiz, answers: {}, revealedSet: {}, currentIndex: 0, phase: 'quiz', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).catch(() => {});
      db.saveQuizHistory({
        historyId,
        subj,
        level,
        knowledgeId,
        knowledgeTitle: (r.quiz[0] as any)?.knowledge?.title || '',
        questions: r.quiz,
        answers: {},
        revealedSet: {},
        totalQuestions: r.quiz.length,
        answeredCount: 0,
        deepExplainMap: {},
        createdAt: new Date().toISOString(),
      }).then(() => db.getQuizHistoryList()).then(setHistoryList).catch(() => {});
      setLastSession(null);
    } else {
      setError(r.error || '生成失败，请检查 API Key');
    }
    setLoading(false);
  };

  const handleOption = (q: QuizItem, opt: string) => {
    if (answeredSet[q.id]) return;
    const newAnswers = { ...answers, [q.id]: opt };
    setAnswers(newAnswers);
    setAnsweredSet(prev => ({ ...prev, [q.id]: true }));
    if (currentHistoryId) {
      db.updateQuizHistory(currentHistoryId, { answers: newAnswers, answeredCount: Object.keys(newAnswers).length }).catch(() => {});
    }
    // Store wrong answer
    if (opt.toLowerCase() !== q.correctAnswer.toLowerCase()) {
      storeWrong(q, opt);
    }
  };

  const handleTextAnswer = (q: QuizItem) => {
    const ans = answers[q.id]?.trim();
    if (!ans || answeredSet[q.id]) return;
    setAnsweredSet(prev => ({ ...prev, [q.id]: true }));
    if (currentHistoryId) {
      const newAnswers = { ...answers, [q.id]: ans };
      db.updateQuizHistory(currentHistoryId, { answers: newAnswers, answeredCount: Object.keys(newAnswers).length }).catch(() => {});
    }
    if (ans.toLowerCase() !== q.correctAnswer.toLowerCase()) {
      storeWrong(q, ans);
    }
  };

  const storeWrong = async (q: QuizItem, userAns: string) => {
    try {
      await db.addWrongAnswer({
        questionId: q.id,
        question: q.question,
        type: q.type,
        userAnswer: userAns,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        knowledge: (q as any).knowledge || null,
        createdAt: new Date().toISOString(),
      });
      await db.addReviewSchedule({
        questionId: q.id,
        question: q.question,
        type: q.type,
        userAnswer: userAns,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
      });
    } catch {}
  };

  const goNext = () => {
    if (currentIdx < quiz.length - 1) {
      setCurrentIdx(i => i + 1);
      setKey(k => k + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(i => i - 1);
      setKey(k => k + 1);
    }
  };

  const handleReveal = (q: QuizItem) => {
    setRevealedSet(prev => ({ ...prev, [q.id]: true }));
    if (currentHistoryId) {
      db.updateQuizHistory(currentHistoryId, { revealedSet: { ...revealedSet, [q.id]: true } }).catch(() => {});
    }
  };

  const handleDeepExplain = async (q: QuizItem) => {
    if (deepExplainMap[q.id]) return;
    setLoadingExplainId(q.id);
    const knowledge = (q as any).knowledge || {};
    const res = await deepExplain({
      question: q.question,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      type: q.type,
      knowledgeTitle: knowledge.title || '',
      knowledgeBody: knowledge.body || '',
    });
    if (res.ok) {
      const content = res.content || '解析为空';
      const newMap = { ...deepExplainMap, [q.id]: content };
      setDeepExplainMap(newMap);
      setDeepExplainSheet({ question: q, content });
      if (currentHistoryId) {
        db.updateQuizHistory(currentHistoryId, { deepExplainMap: newMap }).catch(() => {});
      }
    } else {
      setDeepExplainMap(prev => ({ ...prev, [q.id]: `解析失败：${res.error || '未知错误'}` }));
    }
    setLoadingExplainId(null);
  };

  const calcScore = () => {
    let correct = 0;
    for (const q of quiz) {
      if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) correct++;
    }
    return correct;
  };

  const choiceLabel = (i: number) => String.fromCharCode(65 + i);

  // ===== Setup Screen =====
  if (phase === 'setup') {
    return (
      <div style={{ flex: 1, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>刷题模式</h2>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>选择范围和难度，AI 从知识库生成题目。</div>
        {knowledgeId && (
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: 'var(--primary-light)' }}>
            已锁定当前知识文档出题
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={subj} onChange={e => setSubj(e.target.value)} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 10, padding: '11px 10px', fontSize: 14, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', outline: 'none' }}>
            {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value)} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 10, padding: '11px 10px', fontSize: 14, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', outline: 'none' }}>
            {LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: 76, border: '2px solid var(--border)', borderRadius: 10, padding: '11px 10px', fontSize: 14, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', outline: 'none' }}>
            <option value={3}>3题</option><option value={5}>5题</option><option value={10}>10题</option>
          </select>
        </div>
        {lastSession && lastSession.phase === 'quiz' && lastSession.questions.length > 0 && (
          <div style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 'var(--radius)', background: '#FEF3C7', border: '1px solid #F59E0B' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>
              📝 发现未完成的刷题记录
            </div>
            <div style={{ fontSize: 12, color: '#92400E', marginBottom: 8 }}>
              上次答到第 {lastSession.currentIndex + 1} 题（共 {lastSession.questions.length} 题）
            </div>
            <button
              onClick={() => {
                setQuiz(lastSession.questions);
                setAnswers(lastSession.answers || {});
                setAnsweredSet(lastSession.answers || {});
                setRevealedSet(lastSession.revealedSet || {});
                setDeepExplainMap({});
                setLoadingExplainId(null);
                setCurrentIdx(lastSession.currentIndex || 0);
                setCurrentSessionId(lastSession.sessionId);
                setKey(k => k + 1);
                setLoggedSummary(false);
                setPhase('quiz');
              }}
              style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', background: '#F59E0B', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              继续上次刷题
            </button>
            <button
              onClick={() => {
                db.clearQuizSession(lastSession.sessionId).catch(() => {});
                setLastSession(null);
              }}
              style={{ marginLeft: 8, padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: '#92400E', border: '1px solid #F59E0B', fontSize: 12, cursor: 'pointer' }}>
              重新开始
            </button>
          </div>
        )}
        <button onClick={handleGenerate} disabled={loading}
          style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading ? 'var(--border)' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? 'AI 出题中...' : <><Play size={18} /> 开始刷题</>}
        </button>
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)', lineHeight: 1.6 }}>
            {error}
            {(error.includes('API Key') || error.includes('LLM not configured')) && (
              <div style={{ marginTop: 4, fontWeight: 600 }}>
                请点右下角 AI 助手悬浮球，在输入框上方填写 API Key 后保存。
              </div>
            )}
          </div>
        )}

        {/* 历史刷题记录 */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              历史刷题记录
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showHistory && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, padding: 12 }}>暂无历史记录</div>
              ) : historyList.slice(0, 20).map(hist => (
                <div key={hist.historyId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, background: '#fff',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hist.completedAt ? 'var(--success-light)' : 'var(--warning-light)',
                    border: `1.5px solid ${hist.completedAt ? '#10B981' : '#F59E0B'}`,
                  }}>
                    {hist.completedAt ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                      {hist.knowledgeTitle || hist.subj}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {hist.questions.length}题 · {hist.completedAt ? `得分 ${hist.score}/${hist.totalQuestions}` : `已答 ${hist.answeredCount}/${hist.totalQuestions}`}
                      {' · '}{new Date(hist.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setHistoryDetail(hist)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer', color: '#374151' }}
                    >查看</button>
                    <button
                      onClick={() => {
                        setQuiz(hist.questions as any);
                        setAnswers(hist.answers || {});
                        setAnsweredSet(Object.fromEntries(Object.keys(hist.answers || {}).map(k => [k, true])));
                        setRevealedSet(hist.revealedSet || {});
                        setDeepExplainMap(hist.deepExplainMap || {});
                        setLoadingExplainId(null);
                        setCurrentHistoryId(hist.historyId);
                        setCurrentIdx(0);
                        setKey(k => k + 1);
                        setLoggedSummary(false);
                        setLastSession(null);
                        setPhase('quiz');
                      }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >重做</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 历史详情弹窗 */}
        {historyDetail && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }} onClick={() => setHistoryDetail(null)}>
            <div style={{
              width: '100%', maxWidth: 500, maxHeight: '80vh', borderRadius: 16,
              background: '#fff', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }} onClick={e => e.stopPropagation()}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {historyDetail.knowledgeTitle || historyDetail.subj}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {historyDetail.questions.length}题 · {new Date(historyDetail.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button
                  onClick={() => setHistoryDetail(null)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: '1px solid var(--border-subtle)', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {(historyDetail.questions as any[]).map((q: any, qi: number) => {
                  const userAns = historyDetail.answers?.[q.id]?.trim().toLowerCase();
                  const correct = q.correctAnswer?.trim().toLowerCase();
                  const isCorrectQ = userAns === correct;
                  const isRevealedOnly = historyDetail.revealedSet?.[q.id] && !historyDetail.answers?.[q.id];
                  const dotColor = isRevealedOnly ? '#F59E0B' : (isCorrectQ ? '#10B981' : '#EF4444');
                  return (
                    <div key={q.id || qi} style={{
                      marginBottom: 10, padding: '12px 14px', borderRadius: 10,
                      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${dotColor}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: dotColor, color: '#fff', flexShrink: 0, marginTop: 1,
                        }}>
                          {qi + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.5 }}>
                            {q.question}
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6, marginTop: 4 }}>
                            {!isRevealedOnly && <div>你的答案：<span style={{ color: isCorrectQ ? '#10B981' : '#EF4444', fontWeight: 600 }}>{userAns || '未作答'}</span></div>}
                            <div>正确答案：<span style={{ color: '#10B981', fontWeight: 600 }}>{q.correctAnswer}</span></div>
                            {q.explanation && <div style={{ marginTop: 4, color: '#9CA3AF' }}>{q.explanation}</div>}
                          </div>
                          {historyDetail.deepExplainMap?.[q.id] && (
                            <div style={{
                              marginTop: 6, padding: '8px 10px', borderRadius: 8,
                              background: '#F0F9FF', border: '1px solid #BAE6FD',
                              fontSize: 11, color: '#0369A1', lineHeight: 1.6,
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                多维度解析
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{historyDetail.deepExplainMap[q.id]}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== Summary Screen =====
  if (phase === 'summary') {
    const correct = calcScore();
    const revealedOnlyCount = quiz.filter(q => revealedSet[q.id] && !answeredSet[q.id]).length;
    const scoredCount = quiz.length - revealedOnlyCount;
    const pct = scoredCount > 0 ? Math.round((correct / scoredCount) * 100) : 0;
    const wrongQuiz = quiz.filter(q =>
      answers[q.id]?.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase() &&
      !(revealedSet[q.id] && !answeredSet[q.id])
    );

    return (
      <div style={{ flex: 1, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--rose)' }}>{pct}%</div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>
            答对 {correct}/{scoredCount} 题
            {revealedOnlyCount > 0 && <span style={{ color: 'var(--orange)', fontSize: 12 }}>（{revealedOnlyCount} 题查看答案）</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setPhase('setup'); setQuiz([]); setRevealedSet({}); setDeepExplainMap({}); setLoadingExplainId(null); setCurrentSessionId(safeUUID()); refreshLastSession(); }}
            style={{ flex: 1, padding: '12px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <RefreshCw size={14} /> 再来一套
          </button>
          {wrongQuiz.length > 0 && (
            <button onClick={() => { setQuiz(wrongQuiz); setAnswers({}); setAnsweredSet({}); setRevealedSet({}); setDeepExplainMap({}); setLoadingExplainId(null); setCurrentIdx(0); setKey(k => k+1); setLoggedSummary(false); setCurrentSessionId(safeUUID()); setPhase('quiz'); }}
              style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
              重做错题 ({wrongQuiz.length})
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>题目回顾</div>
        {quiz.map(q => {
          const userAns = answers[q.id]?.trim().toLowerCase();
          const correct = q.correctAnswer.trim().toLowerCase();
          const isRevealedOnly = revealedSet[q.id] && !answeredSet[q.id];
          const isCorrect = !isRevealedOnly && userAns === correct;
          const isWrong = !isRevealedOnly && userAns && userAns !== correct;

          let statusIcon: string, statusColor: string, statusText: string;
          if (isRevealedOnly) {
            statusIcon = '👁'; statusColor = 'var(--orange)'; statusText = '查看答案';
          } else if (isCorrect) {
            statusIcon = '✓'; statusColor = 'var(--green)'; statusText = '答对';
          } else if (isWrong) {
            statusIcon = '✗'; statusColor = 'var(--rose)'; statusText = '答错';
          } else {
            statusIcon = '—'; statusColor = 'var(--text-tertiary)'; statusText = '未作答';
          }

          return (
            <div key={q.id} style={{ border: '2px solid', borderColor: statusColor, borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{statusIcon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text)' }}>{q.question}</span>
                <span style={{ fontSize: 10, color: statusColor, fontWeight: 600, whiteSpace: 'nowrap' }}>{statusText}</span>
              </div>
              {(isWrong || isRevealedOnly) && (
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, marginBottom: 2 }}>正确答案: {q.correctAnswer}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ===== Quiz Screen =====
  const q = quiz[currentIdx];
  if (!q) return null;
  const isAnswered = answeredSet[q.id];
  const isRevealed = revealedSet[q.id];
  const showAnswer = isAnswered || isRevealed;
  const isPureReveal = isRevealed && !isAnswered;
  const isCorrect = answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
  const statusColor = isPureReveal ? '#F59E0B' : (isCorrect ? '#10B981' : '#EF4444');
  const progress = ((currentIdx + 1) / quiz.length) * 100;
  const typeConfig = { choice: { label: '选择题', bg: 'var(--success-light)', c: '#00b365' }, fill: { label: '填空题', bg: 'var(--primary-light)', c: '#3370ff' }, short_answer: { label: '简答题', bg: 'var(--warning-light)', c: '#ff7d00' } };
  const tc = typeConfig[q.type];

  return (
    <>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 12px', gap: 10 }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: 'var(--primary)', width: `${progress}%`, transition: 'width .3s ease' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{currentIdx + 1}/{quiz.length}</span>
      </div>

      {/* Question card */}
      <div key={key} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, border: '2px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', animation: 'slideUp .25s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: tc.bg, color: tc.c }}>{tc.label}</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={async () => {
              const existing = await db.getQuestionTag(q.id).catch(() => undefined);
              const starred = !(existing?.starred || false);
              await db.setQuestionTag(q.id, q.question, existing?.tags || [], starred).catch(() => {});
              setQuestionStarred(starred);
            }}
            style={{
              padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: questionStarred ? '#FEF3C7' : 'transparent',
              fontSize: 11, fontWeight: 500, cursor: 'pointer', color: '#D97706',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24"
              fill={questionStarred ? '#F59E0B' : 'none'} stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {questionStarred ? '已收藏' : '收藏'}
          </button>
          <button
            onClick={() => setShowTagEditor(!showTagEditor)}
            style={{
              padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: showTagEditor ? 'var(--bg-subtle)' : 'transparent', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            标签
          </button>
        </div>

        {showTagEditor && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>管理标签</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {currentTags.map(tag => (
                <span key={tag} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: 'var(--bg-subtle)', color: '#374151', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tag}
                  <span
                    onClick={() => {
                      const newTags = currentTags.filter(t => t !== tag);
                      setCurrentTags(newTags);
                      db.setQuestionTag(q.id, q.question, newTags, questionStarred).catch(() => {});
                    }}
                    style={{ cursor: 'pointer', fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}
                  >×</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                placeholder="输入标签名..."
                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 11, fontFamily: 'var(--font)', outline: 'none', background: '#fff' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTagInput.trim()) {
                    const tag = newTagInput.trim();
                    if (!currentTags.includes(tag)) {
                      const newTags = [...currentTags, tag];
                      setCurrentTags(newTags);
                      db.setQuestionTag(q.id, q.question, newTags, questionStarred).catch(() => {});
                    }
                    setNewTagInput('');
                  }
                }}
              />
              <button
                onClick={async () => {
                  if (!newTagInput.trim()) return;
                  const tag = newTagInput.trim();
                  if (!currentTags.includes(tag)) {
                    const newTags = [...currentTags, tag];
                    setCurrentTags(newTags);
                    await db.setQuestionTag(q.id, q.question, newTags, questionStarred).catch(() => {});
                  }
                  setNewTagInput('');
                }}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >添加</button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {['易错', '重点', '需复习', '概念题', '计算题'].map(sug => (
                <span
                  key={sug}
                  onClick={() => {
                    if (!currentTags.includes(sug)) {
                      const newTags = [...currentTags, sug];
                      setCurrentTags(newTags);
                      db.setQuestionTag(q.id, q.question, newTags, questionStarred).catch(() => {});
                    }
                  }}
                  style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: '#fff', color: '#6B7280', cursor: 'pointer', border: '1px dashed var(--border-subtle)' }}
                >+{sug}</span>
              ))}
            </div>
            {allUserTags.length > 0 && newTagInput && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {allUserTags.filter(t => t.includes(newTagInput) && !currentTags.includes(t)).slice(0, 5).map(t => (
                  <span key={t} onClick={() => {
                    const newTags = [...currentTags, t];
                    setCurrentTags(newTags);
                    db.setQuestionTag(q.id, q.question, newTags, questionStarred).catch(() => {});
                    setNewTagInput('');
                  }} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: 'var(--primary-light)', color: '#4338CA', cursor: 'pointer' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, color: 'var(--text)', marginBottom: 12 }}>{q.question}</div>

        {/* Choice options */}
        {q.type === 'choice' && q.options?.map((opt, oi) => {
          const label = choiceLabel(oi);
          const isSelected = answers[q.id] === label;
          const isCorrect = label === q.correctAnswer;
          let bg = 'transparent', borderColor = 'var(--border)';
          if (isAnswered) {
            if (isCorrect) { bg = 'var(--green-light)'; borderColor = 'var(--green)'; }
            else if (isSelected) { bg = 'var(--rose-light)'; borderColor = 'var(--rose)'; }
          } else if (isSelected) { bg = 'var(--primary-light)'; borderColor = 'var(--primary)'; }

          return (
            <div key={oi} onClick={() => handleOption(q, label)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 6, borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor, background: bg, cursor: isAnswered ? 'default' : 'pointer', fontSize: 14, color: 'var(--text)', transition: 'all .15s' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                background: isAnswered && isCorrect ? 'var(--green)' : isAnswered && isSelected && !isCorrect ? 'var(--rose)' : isSelected ? 'var(--primary)' : 'var(--border)', color: (isAnswered && (isCorrect || (isSelected && !isCorrect))) || isSelected ? '#fff' : 'var(--text)' }}>
                {isAnswered && isCorrect ? <Check size={14} /> : isAnswered && isSelected && !isCorrect ? <X size={14} /> : label}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
            </div>
          );
        })}

        {/* Fill / Short answer */}
        {(q.type === 'fill' || q.type === 'short_answer') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <textarea value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} disabled={isAnswered}
              placeholder={q.type === 'fill' ? '输入答案...' : '输入你的回答...'} rows={q.type === 'fill' ? 3 : 5}
              style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '2px solid', borderColor: isAnswered ? 'var(--green)' : 'var(--border)', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font)', background: isAnswered ? 'var(--success-light)' : 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
            {!isAnswered && (
              <button onClick={() => handleTextAnswer(q)} disabled={!answers[q.id]?.trim()}
                style={{ marginTop: 8, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: (!answers[q.id]?.trim()) ? 'default' : 'pointer', fontFamily: 'var(--font)', background: answers[q.id]?.trim() ? 'var(--primary)' : 'var(--border)', color: '#fff' }}>
                确认
              </button>
            )}
          </div>
        )}

        {/* 查看答案按钮 - 仅在未作答且未查看答案时显示 */}
        {!isAnswered && !isRevealed && (
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
            <button
              onClick={() => handleReveal(q)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: '2px dashed var(--orange)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                background: 'var(--warning-light)',
                color: 'var(--orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              👁 查看答案
            </button>
          </div>
        )}

        {/* Answer + Knowledge + Deep Explain */}
        {showAnswer && (
          <div style={{
            marginTop: 12, borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
          }}>
            {/* 区域A：正确答案 */}
            <div style={{
              padding: '14px 16px 12px 16px',
              borderLeft: `3px solid ${statusColor}`,
              background: isPureReveal ? 'var(--warning-light)' : (isCorrect ? 'var(--success-light)' : 'var(--danger-light)'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: statusColor, color: '#fff',
                }}>
                  {isPureReveal ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : isCorrect ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: statusColor,
                    marginBottom: 2, letterSpacing: 0.3, textTransform: 'uppercase',
                  }}>
                    {isPureReveal ? '查看答案（不计入成绩）' : (isCorrect ? '回答正确' : '回答错误')}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: 0.5 }}>
                    {q.correctAnswer}
                  </div>
                </div>
                {!isPureReveal && !isCorrect && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>你的答案</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#EF4444' }}>{answers[q.id]}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 细分隔线 */}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 16px' }} />

            {/* 区域B：解题思路 */}
            {q.explanation && (
              <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)' }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18h6"/><path d="M10 22h4"/>
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>
                  </svg>
                  解题思路
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
                  {q.explanation}
                </div>
              </div>
            )}

            {/* 细分隔线 */}
            {q.explanation && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 16px' }} />}

            {/* 区域C：知识点溯源 */}
            {(q as any).knowledge && (isPureReveal || !isCorrect) && (
              <div style={{ padding: '12px 16px 14px 16px' }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  关联知识点
                </div>
                {(q as any).knowledge.title && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    {(q as any).knowledge.title}
                  </div>
                )}
                {(q as any).knowledge.body && (
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: '#6B7280' }}>
                    {(q as any).knowledge.body.substring(0, 200)}
                    {(q as any).knowledge.body.length > 200 && '...'}
                  </div>
                )}
                {(q as any).knowledge.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {(q as any).knowledge.tags.map((tag: string, ti: number) => (
                      <span key={ti} style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: 'var(--bg-subtle)', color: '#6B7280', border: '1px solid var(--border-subtle)',
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 底部操作栏：深入解析按钮 */}
            <div style={{
              padding: '10px 16px', background: 'var(--bg-subtle)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
            }}>
              <button
                onClick={() => {
                  if (deepExplainMap[q.id]) {
                    setDeepExplainSheet({ question: q, content: deepExplainMap[q.id] });
                  } else {
                    handleDeepExplain(q);
                  }
                }}
                disabled={loadingExplainId === q.id || !!deepExplainSheet}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: (loadingExplainId === q.id || deepExplainSheet) ? 'var(--border-subtle)' : 'var(--primary)',
                  color: (loadingExplainId === q.id || deepExplainSheet) ? '#9CA3AF' : '#fff',
                  fontSize: 12, fontWeight: 600, cursor: (loadingExplainId === q.id || deepExplainSheet) ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                {loadingExplainId === q.id ? '解析中...' : deepExplainSheet ? '已解析' : '多维度解析'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8 }}>
        {currentIdx > 0 && (
          <button onClick={goPrev} style={{ flex: 1, padding: '12px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ArrowLeft size={16} /> 上一题
          </button>
        )}
        {currentIdx < quiz.length - 1 ? (
          <button onClick={goNext} style={{ flex: currentIdx === 0 ? 1 : 2, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            下一题 <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={() => setPhase('summary')} style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
            查看结果
          </button>
        )}
      </div>
    </div>

    {deepExplainSheet && createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={() => setDeepExplainSheet(null)}
      >
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            maxHeight: '75vh',
            borderRadius: '16px 16px 0 0',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            animation: 'slideUp 0.3s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>多维度解析</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>AI 深度拆解这道题</div>
              </div>
              <button
                onClick={() => setDeepExplainSheet(null)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1px solid var(--border-subtle)', background: 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 16px 24px',
            WebkitOverflowScrolling: 'touch',
          }}>
            {parseDeepExplain(deepExplainSheet.content).map((sec, i) => {
              const COLORS = [
                { accent: '#3B82F6', text: '#1E40AF' },
                { accent: '#F59E0B', text: '#92400E' },
                { accent: '#10B981', text: '#065F46' },
                { accent: '#EF4444', text: '#991B1B' },
                { accent: '#8B5CF6', text: '#5B21B6' },
              ];
              const c = COLORS[i % COLORS.length];
              return (
                <div key={i} style={{
                  marginBottom: 12, padding: '14px 16px', borderRadius: 12,
                  background: 'var(--surface)',
                  borderLeft: `3px solid ${c.accent}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: c.text,
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ fontSize: 14 }}>{sec.emoji}</span>
                    {sec.title}
                  </div>
                  {sec.body && (
                    <div style={{
                      fontSize: 13, lineHeight: 1.75, color: 'var(--text)',
                      whiteSpace: 'pre-wrap', marginBottom: sec.hasTable ? 10 : 0,
                    }}>
                      {sec.body}
                    </div>
                  )}
                  {sec.hasTable && sec.tableData && (
                    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.6 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-subtle)' }}>
                            {sec.tableData.headers.map((h, hi) => (
                              <th key={hi} style={{
                                padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                                color: 'var(--text)', borderBottom: '2px solid var(--border-subtle)',
                                whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.tableData.rows.map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--bg-card)' }}>
                              {row.map((cell, ci) => (
                                <td key={ci} style={{
                                  padding: '8px 12px', color: 'var(--text)',
                                  borderBottom: '1px solid var(--border-subtle)',
                                }}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>,
      document.getElementById('app-root')!
    )}
    </>
  );
}
