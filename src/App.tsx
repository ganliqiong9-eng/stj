import { BrowserRouter, Routes, Route, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import AIAssistant from './components/AIAssistant';
import SelectionTooltip from './components/SelectionTooltip';
import Home from './pages/Home';
import StatusBar from './components/StatusBar';
import QuizView from './components/QuizView';
import SubjectDetail from './pages/SubjectDetail';
import LearnHome from './pages/LearnHome';
import PathDetail from './pages/PathDetail';
import ChapterDetail from './pages/ChapterDetail';
import KnowledgePointDetail from './pages/KnowledgePointDetail';
import Bank from './pages/Bank';
import Compiler from './pages/Compiler';
import Notes from './pages/Notes';
import Knowledge from './pages/Knowledge';
import AdminDashboard from './pages/AdminDashboard';
import AdminKnowledge from './pages/AdminKnowledge';
import AdminEditor from './pages/AdminEditor';
import AdminUpload from './pages/AdminUpload';
import AdminQuiz from './pages/AdminQuiz';
import AdminDatabase from './pages/AdminDatabase';
import AdminRag from './pages/AdminRag';
import AdminLearningPaths from './pages/AdminLearningPaths';
import AdminLearningPathEditor from './pages/AdminLearningPathEditor';
import { ToastProvider } from './components/Toast';
import WrongAnswersView from './pages/WrongAnswersView';
import AskAI from './pages/AskAI';
import ReviewView from './pages/ReviewView';
import TutorView from './pages/TutorView';
import LearningReport from './pages/LearningReport';
import Library from './pages/Library';
import MockExam from './pages/MockExam';
import AITutorChat from './pages/AITutorChat';
import StudyPlan from './pages/StudyPlan';
import AdminWrongAnswers from './pages/AdminWrongAnswers';
import db from './store/db';
import './App.css';


// Theme: auto-detect from system or localStorage
function getPreferredTheme(): string {
  const stored = localStorage.getItem('kye_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
}

// 移动端刷题页：QuizView 三阶段完整流程 + 返回入口
function MobileQuiz() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const knowledgeId = params.get('knowledgeId') || '';
  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0
        }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>刷题</h2>
        <button onClick={() => nav('/ai-quiz')} style={{
          padding: '5px 10px', border: '2px solid var(--primary)', borderRadius: 8,
          fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
          background: 'var(--surface)', color: 'var(--primary)', whiteSpace: 'nowrap'
        }}>对话式</button>
      </div>
      <QuizView onBack={() => nav('/')} knowledgeId={knowledgeId} />
    </div>
  );
}
// Expose toggle for AI Assistant / other components
(window as any).__toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('kye_theme', next);
};

export default function App() {
  useEffect(() => {
    const theme = getPreferredTheme();
    applyTheme(theme);
    // Listen for system preference changes (only when user hasn't manually set)
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (!localStorage.getItem('kye_theme')) {
        applyTheme(mq.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    db.initQuestions();
    // Pull remote data on startup
    db.pullSync();
  }, []);
  // Periodic sync
  useEffect(() => {
    const timer = setInterval(() => {
      db.pushSync();
      db.pullSync();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <div className="admin-wrapper">
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/knowledge" element={<AdminKnowledge />} />
        <Route path="/admin/knowledge/:id" element={<AdminEditor />} />
        <Route path="/admin/upload" element={<AdminUpload />} />
        <Route path="/admin/quiz" element={<AdminQuiz />} />
          <Route path="/admin/database" element={<AdminDatabase />} />
          <Route path="/admin/rag" element={<AdminRag />} />
          <Route path="/admin/wrong-answers" element={<AdminWrongAnswers />} />
          <Route path="/admin/learning-paths" element={<AdminLearningPaths />} />
          <Route path="/admin/learning-paths/:id" element={<AdminLearningPathEditor />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="phone-frame" id="app-root">
      <div className="phone-notch" />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subject/:id" element={<SubjectDetail />} />
          <Route path="/learn" element={<LearnHome />} />
          <Route path="/learn/:pathId" element={<PathDetail />} />
          <Route path="/learn/:pathId/chapter/:chapterId" element={<ChapterDetail />} />
          <Route path="/learn/:pathId/chapter/:chapterId/kp/:kpId" element={<KnowledgePointDetail />} />
          <Route path="/quiz" element={<MobileQuiz />} />
          <Route path="/wrong-answers" element={<WrongAnswersView />} />
          <Route path="/ask-ai" element={<AskAI />} />
          <Route path="/review" element={<ReviewView />} />
          <Route path="/tutor" element={<TutorView />} />
          <Route path="/report" element={<LearningReport />} />
          <Route path="/library" element={<Library />} />
          <Route path="/mock-exam" element={<MockExam />} />
          <Route path="/ai-quiz" element={<AITutorChat />} />
          <Route path="/plan" element={<StudyPlan />} />
          <Route path="/bank" element={<Bank />} />
          <Route path="/compiler" element={<Compiler />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/knowledge" element={<Knowledge />} />
        </Routes>
      </div>
      <AIAssistant />
      <SelectionTooltip />
      <BottomNav />
    </div>
  );
}
