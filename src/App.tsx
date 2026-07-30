import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import AIAssistant from './components/AIAssistant';
import SelectionTooltip from './components/SelectionTooltip';
import AdminLayout from './components/AdminLayout';
import Home from './pages/Home';
import SubjectDetail from './pages/SubjectDetail';
import Learn from './pages/Learn';
import Quiz from './pages/Quiz';
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
import WrongAnswersView from './pages/WrongAnswersView';
import AskAI from './pages/AskAI';
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
      <AppContent />
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
          <Route path="/learn/:chapterId" element={<Learn />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/wrong-answers" element={<WrongAnswersView />} />
          <Route path="/ask-ai" element={<AskAI />} />
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
