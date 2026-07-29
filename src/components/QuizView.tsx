import { useState } from 'react';
import { generateQuiz } from '../api';

interface QuizItem {
  id: string;
  knowledgeId: string;
  type: 'choice' | 'fill' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export default function QuizView({ onBack }: { onBack?: () => void }) {
  const [subj, setSubj] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSubmitted(false);
    setAnswers({});
    setQuiz([]);
    const r = await generateQuiz({ subj: subj || undefined, level: level || undefined, count, types: ['choice', 'fill', 'short_answer'] });
    if (r.ok && r.quiz.length > 0) {
      setQuiz(r.quiz);
      localStorage.setItem('last_quiz', JSON.stringify(r.quiz));
    } else {
      setError(r.error || '生成失败，请检查 API Key 配置');
    }
    setLoading(false);
  };

  const handleSubmit = () => {
    let correct = 0;
    for (const q of quiz) {
      if (answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) correct++;
    }
    setScore({ correct, total: quiz.length });
    setSubmitted(true);
    // Store wrong answers
    const wrong = quiz.filter(q => answers[q.id]?.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase());
    if (wrong.length > 0) localStorage.setItem('wrong_quiz', JSON.stringify(wrong));
  };

  const choiceLabel = (i: number) => String.fromCharCode(65 + i);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {onBack && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>刷题模式</h2>
      </div>}

      {!onBack && <h2 style={{ fontSize: 17, fontWeight: 700, padding: '6px 12px' }}>刷题模式</h2>}

      {quiz.length === 0 && !loading && (
        <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={subj} onChange={e => setSubj(e.target.value)} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              <option value="">全科目</option><option value="sql">SQL</option><option value="py">Python</option><option value="da">数据分析</option><option value="dma">DAMA</option>
            </select>
            <select value={level} onChange={e => setLevel(e.target.value)} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              <option value="">全难度</option><option value="beginner">入门</option><option value="intermediate">进阶</option><option value="advanced">实战</option>
            </select>
            <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: 70, border: '2px solid var(--border)', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              <option value={3}>3题</option><option value={5}>5题</option><option value={10}>10题</option>
            </select>
          </div>
          <button onClick={handleGenerate} style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff' }}>🚀 开始刷题</button>
          {error && <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)' }}>✗ {error}</div>}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>AI 出题中...</div>}

      {quiz.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>共 {quiz.length} 题{submitted ? ` · 答对 ${score.correct}/${score.total}` : ''}</div>
          {quiz.map((q, i) => (
            <div key={q.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 8, border: '2px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>第 {i + 1} 题</span>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: q.type === 'choice' ? '#e8f5e9' : q.type === 'fill' ? '#e3f2fd' : '#fff3e0', color: q.type === 'choice' ? '#2e7d32' : q.type === 'fill' ? '#1565c0' : '#e65100' }}>
                  {q.type === 'choice' ? '选择' : q.type === 'fill' ? '填空' : '简答'}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{q.question}</div>
              {q.type === 'choice' && q.options?.map((opt, oi) => {
                const isCorrect = submitted && choiceLabel(oi) === q.correctAnswer;
                const isWrong = submitted && answers[q.id] === choiceLabel(oi) && choiceLabel(oi) !== q.correctAnswer;
                return (
                  <div key={oi} onClick={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: choiceLabel(oi) }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 4, borderRadius: 'var(--radius-sm)', border: '2px solid', cursor: submitted ? 'default' : 'pointer', fontSize: 13,
                      borderColor: isCorrect ? 'var(--green)' : isWrong ? 'var(--rose)' : answers[q.id] === choiceLabel(oi) ? 'var(--primary)' : 'var(--border)',
                      background: isCorrect ? 'var(--green-light)' : isWrong ? 'var(--rose-light)' : answers[q.id] === choiceLabel(oi) ? 'var(--primary-light)' : 'transparent' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      background: isCorrect ? 'var(--green)' : isWrong ? 'var(--rose)' : answers[q.id] === choiceLabel(oi) ? 'var(--primary)' : 'var(--border)', color: '#fff' }}>{choiceLabel(oi)}</span>
                    {opt}
                  </div>
                );
              })}
              {(q.type === 'fill' || q.type === 'short_answer') && (
                <textarea value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} disabled={submitted}
                  placeholder={q.type === 'fill' ? '填写答案...' : '输入你的回答...'} rows={q.type === 'fill' ? 2 : 3}
                  style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font)', background: submitted ? 'var(--bg)' : 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical' }} />
              )}
              {submitted && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', fontSize: 11, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 2 }}>✓ {q.correctAnswer}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{q.explanation}</div>
                </div>
              )}
            </div>
          ))}
          {!submitted && quiz.length > 0 && (
            <button onClick={handleSubmit} style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--primary)', color: '#fff', marginBottom: 6 }}>提交答案</button>
          )}
          {submitted && (
            <button onClick={handleGenerate} style={{ width: '100%', padding: '12px 0', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }}>再出一套题 →</button>
          )}
        </div>
      )}
    </div>
  );
}
