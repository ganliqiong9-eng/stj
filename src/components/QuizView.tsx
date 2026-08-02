import { useState, useEffect } from 'react';
import { Play, ArrowLeft, ArrowRight, Check, X, RefreshCw, BookOpen } from 'lucide-react';
import { generateQuiz } from '../api';
import db from '../store/db';

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

export default function QuizView({ onBack, knowledgeId }: { onBack?: () => void; knowledgeId?: string }) {
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

  useEffect(() => {
    if (phase === 'summary' && !loggedSummary && quiz.length > 0) {
      setLoggedSummary(true);
      db.logQuizResult(calcScore(), quiz.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, loggedSummary, quiz]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    const r = await generateQuiz({ subj: subj || undefined, level: level || undefined, count, types: ['choice', 'fill', 'short_answer'], knowledgeId });
    if (r.ok && r.quiz.length > 0) {
      setQuiz(r.quiz);
      setAnswers({});
      setAnsweredSet({});
      setCurrentIdx(0);
      setKey(k => k + 1);
      setLoggedSummary(false);
      setPhase('quiz');
      localStorage.setItem('last_quiz', JSON.stringify(r.quiz));
    } else {
      setError(r.error || '生成失败，请检查 API Key');
    }
    setLoading(false);
  };

  const handleOption = (q: QuizItem, opt: string) => {
    if (answeredSet[q.id]) return;
    setAnswers(prev => ({ ...prev, [q.id]: opt }));
    setAnsweredSet(prev => ({ ...prev, [q.id]: true }));
    // Store wrong answer
    if (opt.toLowerCase() !== q.correctAnswer.toLowerCase()) {
      storeWrong(q, opt);
    }
  };

  const handleTextAnswer = (q: QuizItem) => {
    const ans = answers[q.id]?.trim();
    if (!ans || answeredSet[q.id]) return;
    setAnsweredSet(prev => ({ ...prev, [q.id]: true }));
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
        <button onClick={handleGenerate} disabled={loading}
          style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading ? 'var(--border)' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? 'AI 出题中...' : <><Play size={18} /> 开始刷题</>}
        </button>
        {error && <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)' }}>{error}</div>}
      </div>
    );
  }

  // ===== Summary Screen =====
  if (phase === 'summary') {
    const correct = calcScore();
    const pct = Math.round((correct / quiz.length) * 100);
    const wrongQuiz = quiz.filter(q => answers[q.id]?.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase());

    return (
      <div style={{ flex: 1, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--rose)' }}>{pct}%</div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 4 }}>答对 {correct}/{quiz.length} 题</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setPhase('setup'); setQuiz([]); }}
            style={{ flex: 1, padding: '12px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <RefreshCw size={14} /> 再来一套
          </button>
          {wrongQuiz.length > 0 && (
            <button onClick={() => { setQuiz(wrongQuiz); setAnswers({}); setAnsweredSet({}); setCurrentIdx(0); setKey(k => k+1); setLoggedSummary(false); setPhase('quiz'); }}
              style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>
              重做错题 ({wrongQuiz.length})
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>题目回顾</div>
        {quiz.map((q, i) => {
          const isCorrect = answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
          return (
            <div key={q.id} style={{ border: '2px solid', borderColor: isCorrect ? 'var(--green)' : 'var(--rose)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {isCorrect ? <Check size={14} color="var(--green)" /> : <X size={14} color="var(--rose)" />}
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'var(--text)' }}>{q.question}</span>
              </div>
              {!isCorrect && (
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
  const progress = ((currentIdx + 1) / quiz.length) * 100;
  const typeConfig = { choice: { label: '选择题', bg: '#e6f7ef', c: '#00b365' }, fill: { label: '填空题', bg: '#e8f0ff', c: '#3370ff' }, short_answer: { label: '简答题', bg: '#fff3e0', c: '#ff7d00' } };
  const tc = typeConfig[q.type];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 12px', gap: 10 }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: 'var(--primary)', width: `${progress}%`, transition: 'width .3s ease' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{currentIdx + 1}/{quiz.length}</span>
      </div>

      {/* Question card */}
      <div key={key} style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, border: '2px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', animation: 'slideUp .25s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: tc.bg, color: tc.c }}>{tc.label}</span>
        </div>
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

        {/* Answer + Knowledge */}
        {isAnswered && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 2 }}>✓ {q.correctAnswer}</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 11 }}>{q.explanation}</div>
            {(q as any).knowledge && answers[q.id]?.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase() && (
              <div style={{ marginTop: 6, borderTop: '1px solid var(--border-light)', paddingTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={12} /> 知识点溯源
                </div>
                <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
                  {(q as any).knowledge.title && <div style={{ fontWeight: 600 }}>{(q as any).knowledge.title}</div>}
                  {(q as any).knowledge.body && <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{(q as any).knowledge.body.substring(0, 200)}</div>}
                </div>
              </div>
            )}
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
  );
}
