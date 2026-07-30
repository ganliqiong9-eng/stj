import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Check, X, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { generateQuiz } from '../api';
import StatusBar from '../components/StatusBar';
import db from '../store/db';

export default function MockExam() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<'setup' | 'exam' | 'results'>('setup');
  const [subj, setSubj] = useState('');
  const [count, setCount] = useState(10);
  const [timeLimit, set用时Limit] = useState(10);
  const [quiz, setQuiz] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, set用时Left] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);

  // 用时r
  useEffect(() => {
    if (phase !== 'exam') return;
    const timer = setInterval(() => {
      set用时Left(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'exam' && timeLeft <= 0 && quiz.length > 0) {
      setPhase('results');
    }
  }, [timeLeft, phase, quiz.length]);

  const handleStart = async () => {
    setLoading(true);
    setError('');
    const r = await generateQuiz({ subj: subj || undefined, count, types: ['choice', 'fill', 'short_answer'] });
    if (r.ok && r.quiz.length > 0) {
      setQuiz(r.quiz);
      setAnswers({});
      setCurrentIdx(0);
      set用时Left(timeLimit * 60);
      setPhase('exam');
      setKey(k => k + 1);
    } else {
      setError(r.error || 'Failed to generate questions');
    }
    setLoading(false);
  };

  const handle提交 = () => {
    // Store wrong answers
    for (const q of quiz) {
      if (answers[q.id]?.trim().toLowerCase() !== q.correctAnswer?.trim().toLowerCase()) {
        try {
          db.addWrongAnswer({
            questionId: q.id, question: q.question, type: q.type,
            userAnswer: answers[q.id] || '', correctAnswer: q.correctAnswer,
            explanation: q.explanation || '', knowledge: (q).knowledge || null,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }
    }
    setPhase('results');
  };

  const score = quiz.filter(q => answers[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()).length;
  const pct = quiz.length > 0 ? Math.round((score / quiz.length) * 100) : 0;
  const passed = pct >= 60;
  const timeSpent = timeLimit * 60 - timeLeft;
  const format用时 = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const choiceLabel = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => phase === 'exam' ? null : nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>模拟考试</h2>
        {phase === 'exam' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: timeLeft < 60 ? 'var(--rose)' : 'var(--text)' }}>
            <Clock size={16} /> {format用时(timeLeft)}
          </span>
        )}
      </div>

      {/* Setup */}
      {phase === 'setup' && (
        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={subj} onChange={e => setSubj(e.target.value)} style={{ border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}>
            <option value="">全部科目</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">Data Analysis</option><option value="dma">DAMA</option>
          </select>
          <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}>
            <option value={5}>5 题</option><option value={10}>10 题</option><option value={20}>20 题</option><option value={30}>30 题</option>
          </select>
          <select value={timeLimit} onChange={e => set用时Limit(Number(e.target.value))} style={{ border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}>
            <option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option>
          </select>
          <button onClick={handleStart} disabled={loading}
            style={{ padding: '14px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading ? 'var(--border)' : 'var(--primary)', color: '#fff' }}>
            {loading ? '生成中...' : '开始考试'}
          </button>
          {error && <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)' }}>{error}</div>}
        </div>
      )}

      {/* Exam */}
      {phase === 'exam' && quiz.length > 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--primary)', width: `${((currentIdx + 1) / quiz.length) * 100}%`, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{currentIdx + 1}/{quiz.length}</span>
          </div>

          <div key={key} style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 16, border: '2px solid var(--border-light)', animation: 'slideUp .25s ease-out', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: quiz[currentIdx]?.type === 'choice' ? '#e6f7ef' : '#e8f0ff', color: quiz[currentIdx]?.type === 'choice' ? '#00b365' : '#3370ff', alignSelf: 'flex-start', marginBottom: 6 }}>
              {quiz[currentIdx]?.type === 'choice' ? '选择题' : quiz[currentIdx]?.type === 'fill' ? 'Fill' : '简答题'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: 'var(--text)', marginBottom: 10 }}>{quiz[currentIdx]?.question}</div>

            {quiz[currentIdx]?.type === 'choice' && quiz[currentIdx]?.options?.map((opt: string, oi: number) => {
              const isSelected = answers[quiz[currentIdx]?.id] === choiceLabel(oi);
              return (
                <div key={oi} onClick={() => setAnswers(prev => ({ ...prev, [quiz[currentIdx]?.id]: choiceLabel(oi) }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 4, borderRadius: 'var(--radius-sm)', border: '2px solid', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    background: isSelected ? 'var(--primary-light)' : 'transparent' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: isSelected ? 'var(--primary)' : 'var(--border)', color: isSelected ? '#fff' : 'var(--text)' }}>{choiceLabel(oi)}</span>
                  <span>{opt}</span>
                </div>
              );
            })}

            {(quiz[currentIdx]?.type === 'fill' || quiz[currentIdx]?.type === 'short_answer') && (
              <textarea value={answers[quiz[currentIdx]?.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [quiz[currentIdx]?.id]: e.target.value }))}
                placeholder={quiz[currentIdx]?.type === 'fill' ? '输入答案...' : '输入你的回答...'} rows={quiz[currentIdx]?.type === 'fill' ? 3 : 5}
                style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {currentIdx > 0 && (
              <button onClick={() => { setCurrentIdx(i => i - 1); setKey(k => k + 1); }} style={{ flex: 1, padding: '10px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <ArrowLeft size={14} /> 上一题
              </button>
            )}
            {currentIdx < quiz.length - 1 ? (
              <button onClick={() => { setCurrentIdx(i => i + 1); setKey(k => k + 1); }} style={{ flex: currentIdx === 0 ? 1 : 2, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                下一题 <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handle提交} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>提交</button>
            )}
          </div>
        </div>
      )}

      {/* 结果s */}
      {phase === 'results' && (
        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: passed ? 'var(--green)' : 'var(--rose)' }}>{pct}%</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              {score}/{quiz.length} {passed ? ' - 通过!' : ' - 未通过'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>用时: {format用时(timeSpent)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setPhase('setup'); setQuiz([]); }} style={{ flex: 1, padding: '10px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)' }}>重试</button>
            <button onClick={() => nav('/')} style={{ flex: 2, padding: '10px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>Home</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 8 }}>回顾</div>
          {quiz.map((q, i) => {
            const correct = answers[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
            return (
              <div key={q.id} style={{ border: '2px solid', borderColor: correct ? 'var(--green)' : 'var(--rose)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface)', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                  {correct ? <Check size={14} color="var(--green)" /> : <X size={14} color="var(--rose)" />}
                  <span style={{ fontWeight: 600, display: 'block' }}>{q.question}</span>
                </div>
                {!correct && (
                  <div style={{ marginTop: 4, fontSize: 11 }}>
                    <div style={{ color: 'var(--rose)' }}>你的回答: {answers[q.id]}</div>
                    <div style={{ color: 'var(--green)', fontWeight: 600 }}>正确答案: {q.correctAnswer}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
