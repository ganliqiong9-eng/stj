import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import BottomNav from './components/BottomNav';
import AIAssistant from './components/AIAssistant';
import SelectionTooltip from './components/SelectionTooltip';
import Home from './pages/Home';
import SubjectDetail from './pages/SubjectDetail';
import Learn from './pages/Learn';
import Quiz from './pages/Quiz';
import Bank from './pages/Bank';
import Compiler from './pages/Compiler';
import Notes from './pages/Notes';
import db from './store/db';
import './App.css';

export default function App() {
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
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <BrowserRouter>
      <div className="phone-frame" id="app-root">
        <div className="phone-notch" />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/subject/:id" element={<SubjectDetail />} />
            <Route path="/learn/:chapterId" element={<Learn />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/compiler" element={<Compiler />} />
            <Route path="/notes" element={<Notes />} />
          </Routes>
        </div>
        <AIAssistant />
        <SelectionTooltip />
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
