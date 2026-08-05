import Dexie, { type Table } from 'dexie';
import { defaultQuestions, type Question } from '../data/questions';
import type { Section } from '../data/content';
import { syncUpload, syncDownload } from '../api';
import type { Row } from '../api';
import { safeUUID } from '../utils/id';

export interface StoredNote {
  id?: number;
  courseId: string;
  title: string;
  content: string;
  createdAt: string;
  _id?: string;
}

export interface StoredProgress {
  chapterId: string;
  completed: boolean;
  updatedAt: string;
}

export interface KnowledgeEntry {
  id?: number;
  _id?: string;
  title: string;
  subj: string;
  sections: Section[];
  tags: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  _device?: string;
  type?: 'doc' | 'table' | 'paste';
  status?: 'parsing' | 'indexed' | 'error';
}

export interface WrongAnswer {
  id?: number;
  questionId: string;
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  knowledge: any;
  createdAt: string;
}

export interface ReviewSchedule {
  id?: number;
  questionId: string;
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  nextReviewDate: string;
  interval: number;
  reviewed: boolean;
  createdAt: string;
  lastReviewedAt?: string;
  mastered?: boolean;
}

export interface QuizSession {
  id?: number;
  sessionId: string;
  subj?: string;
  level?: string;
  knowledgeId?: string;
  questions: any[];
  answers: Record<string, string>;
  revealedSet: Record<string, boolean>;
  currentIndex: number;
  phase: 'setup' | 'quiz' | 'summary';
  createdAt: string;
  updatedAt: string;
}

/** 同步锁，防止并发请求 */
let _syncLock = false;
/** 末次同步时间戳 */
let _lastSyncAt = 0;
const SYNC_COOLDOWN = 60_000;

class StudyDB extends Dexie {
  questions!: Table<Question, string>;
  notes!: Table<StoredNote, number>;
  progress!: Table<StoredProgress, string>;
  knowledge!: Table<KnowledgeEntry, number>;
  wrongAnswers!: Table<WrongAnswer, number>;
  reviewSchedule!: Table<ReviewSchedule, number>;
  quizSessions!: Table<QuizSession, number>;

  constructor() {
    super('StudyBuddy');
    this.version(1).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId',
      knowledge: '++id, subj'
    });
    this.version(2).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId',
      knowledge: '++id, subj',
      wrongAnswers: '++id, createdAt'
    });
    this.version(3).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId',
      knowledge: '++id, subj',
      wrongAnswers: '++id, createdAt',
      reviewSchedule: '++id, nextReviewDate, reviewed'
    });
    this.version(4).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId',
      knowledge: '++id, subj',
      wrongAnswers: '++id, createdAt',
      reviewSchedule: '++id, nextReviewDate, reviewed',
      quizSessions: '++id, sessionId, updatedAt'
    });
  }

  async initQuestions() {
    const count = await this.questions.count();
    if (count === 0) {
      await this.questions.bulkAdd(defaultQuestions);
    }
  }

  async toggleStar(id: string) {
    const q = await this.questions.get(id);
    if (q) {
      await this.questions.update(id, { star: !q.star });
      return !q.star;
    }
    return false;
  }

  async getStarredCount() {
    return this.questions.where('star').equals(1).count();
  }

  async addNote(note: StoredNote) {
    note._id = safeUUID();
    const id = await this.notes.add(note);
    return id;
  }

  async getNotes(courseId: string) {
    return this.notes.where('courseId').equals(courseId).toArray();
  }

  async markChapterDone(chapterId: string) {
    await this.progress.put({ chapterId, completed: true, updatedAt: new Date().toISOString() });
    this.trackStudy();
  }

  async isChapterDone(chapterId: string) {
    const p = await this.progress.get(chapterId);
    return p?.completed ?? false;
  }


  // === Streak & XP tracking ===
  async trackStudy() {
    const today = new Date().toISOString().slice(0, 10);
    const days = JSON.parse(localStorage.getItem('study_days') || '[]');
    if (!days.includes(today)) {
      days.push(today);
      localStorage.setItem('study_days', JSON.stringify(days));
    }
    // Calculate streak
    let streak = 0;
    const d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10);
      if (days.includes(ds)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    localStorage.setItem('study_streak', String(streak));
    return streak;
  }

  async getXp(): Promise<number> {
    const allProgress = await this.progress.toArray();
    return allProgress.filter(p => p.completed).length * 20 + this.calculateBonusXp();
  }

  async getCompletedCount(): Promise<number> {
    return (await this.progress.toArray()).filter(p => p.completed).length;
  }

  async getStreak(): Promise<number> {
    return parseInt(localStorage.getItem('study_streak') || '0', 10);
  }

  private calculateBonusXp(): number {
    const days = JSON.parse(localStorage.getItem('study_days') || '[]');
    return Math.floor(days.length / 3) * 10; // 每学习3天奖励10XP
  }

  // === Knowledge CRUD ===
  async addKnowledge(entry: Omit<KnowledgeEntry, 'id'>) {
    const full: KnowledgeEntry = {
      ...entry,
      _id: entry._id || safeUUID(),
    };
    return this.knowledge.add(full);
  }

  async updateKnowledge(id: number, entry: Partial<KnowledgeEntry>) {
    return this.knowledge.update(id, { ...entry, updatedAt: new Date().toISOString() });
  }

  async deleteKnowledge(id: number) {
    return this.knowledge.delete(id);
  }

  async getKnowledge(id: number) {
    return this.knowledge.get(id);
  }

  async getAllKnowledge() {
    return this.knowledge.toArray();
  }

  // === Quiz Sessions ===
  async saveQuizSession(session: Omit<QuizSession, 'id'>) {
    const existing = await this.quizSessions.where('sessionId').equals(session.sessionId).first();
    if (existing) {
      await this.quizSessions.update(existing.id!, { ...session, updatedAt: new Date().toISOString() });
    } else {
      await this.quizSessions.add({ ...session, id: undefined });
    }
    // 自动清理 7 天前旧会话
    await this.cleanOldSessions().catch(() => {});
  }

  async getLastQuizSession(): Promise<QuizSession | undefined> {
    return this.quizSessions.orderBy('updatedAt').reverse().first();
  }

  async clearQuizSession(sessionId: string) {
    await this.quizSessions.where('sessionId').equals(sessionId).delete();
  }

  async getAllAnsweredQuestionIds(): Promise<Set<string>> {
    const sessions = await this.quizSessions.toArray();
    const ids = new Set<string>();
    for (const s of sessions) {
      for (const q of (s.questions || [])) {
        if (s.answers[q.id]) ids.add(q.id);
      }
    }
    return ids;
  }

  async getAnsweredQuestions(limit = 15): Promise<{ question: string; knowledgeTitle?: string }[]> {
    const sessions = await this.quizSessions.orderBy('updatedAt').reverse().toArray();
    const seen = new Set<string>();
    const out: { question: string; knowledgeTitle?: string }[] = [];
    for (const s of sessions) {
      for (const q of (s.questions || [])) {
        if (!s.answers[q.id]) continue;
        const key = q.question || '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ question: key, knowledgeTitle: q.knowledge?.title || q.knowledgeTitle || '' });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  async cleanOldSessions() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString();
    const old = await this.quizSessions.where('updatedAt').below(cutoffStr).toArray();
    for (const s of old) {
      await this.quizSessions.delete(s.id!);
    }
  }

  // === Wrong Answers ===
  async addWrongAnswer(wa: Omit<WrongAnswer, 'id'>) {
    return this.wrongAnswers.add(wa as WrongAnswer);
  }

  async getWrongAnswers(): Promise<WrongAnswer[]> {
    return this.wrongAnswers.orderBy('createdAt').reverse().toArray();
  }

  async clearWrongAnswers() {
    return this.wrongAnswers.clear();
  }

  async migrateLegacyWrongQuiz() {
    try {
      const stored = localStorage.getItem('wrong_quiz');
      if (stored) {
        const legacy = JSON.parse(stored);
        if (Array.isArray(legacy) && legacy.length > 0) {
          const existing = await this.wrongAnswers.count();
          if (existing === 0) {
            for (const item of legacy) {
              await this.wrongAnswers.add({
                questionId: item.id || 'legacy',
                question: item.question || '',
                type: item.type || 'choice',
                userAnswer: item.userAnswer || '',
                correctAnswer: item.correctAnswer || '',
                explanation: item.explanation || '',
                knowledge: item.knowledge || null,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
        localStorage.removeItem('wrong_quiz');
      }
    } catch {}
  }

  async initWrongAnswers() {
    await this.migrateLegacyWrongQuiz();
  }

  // === Review Schedule (SM-2) ===
  async addReviewSchedule(data: { questionId: string; question: string; type: string; userAnswer: string; correctAnswer: string; explanation: string }) {
    const existing = await this.reviewSchedule.where('questionId').equals(data.questionId).first();
    const next = new Date();
    next.setDate(next.getDate() + 1);
    if (existing) {
      await this.reviewSchedule.update(existing.id!, {
        userAnswer: data.userAnswer,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        interval: 1,
        nextReviewDate: next.toISOString().slice(0, 10),
        reviewed: false,
        mastered: false,
        lastReviewedAt: new Date().toISOString(),
      });
    } else {
      await this.reviewSchedule.add({
        questionId: data.questionId,
        question: data.question,
        type: data.type,
        userAnswer: data.userAnswer,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        nextReviewDate: next.toISOString().slice(0, 10),
        interval: 1,
        reviewed: false,
        mastered: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async getDueReviews(): Promise<ReviewSchedule[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.reviewSchedule.where('nextReviewDate').belowOrEqual(today).filter(r => !r.reviewed).toArray();
  }

  async completeReview(id: number, knew: boolean) {
    const entry = await this.reviewSchedule.get(id);
    if (!entry) return;
    // SM-2 间隔递增：1 → 3 → 7 → 15 → 30 天
    const INTERVALS = [1, 3, 7, 15, 30];
    const idx = INTERVALS.indexOf(entry.interval);
    const interval = knew ? (idx >= 0 && idx < INTERVALS.length - 1 ? INTERVALS[idx + 1] : 30) : 1;
    const next = new Date();
    next.setDate(next.getDate() + interval);
    await this.reviewSchedule.update(id, {
      interval,
      nextReviewDate: next.toISOString().slice(0, 10),
      reviewed: knew,
      mastered: knew && interval >= 30,
      lastReviewedAt: new Date().toISOString(),
    });
  }

  async getReviewCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return this.reviewSchedule.where('nextReviewDate').belowOrEqual(today).filter(r => !r.reviewed).count();
  }

  // === Quiz history (本周刷题统计 / 趋势) ===
  async logQuizResult(correct: number, total: number) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const history = JSON.parse(localStorage.getItem('quiz_history') || '[]');
      history.push({ date: today, correct, total });
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      localStorage.setItem('quiz_history', JSON.stringify(
        (history as any[]).filter((h: any) => h.date >= cutoff.toISOString().slice(0, 10))
      ));
    } catch {}
  }

  async getQuizHistory(): Promise<{ date: string; correct: number; total: number }[]> {
    try { return JSON.parse(localStorage.getItem('quiz_history') || '[]'); } catch { return []; }
  }

  // === Sync methods ===
  async pushSync() {
    if (_syncLock) return;
    try {
      _syncLock = true;
      const allQ = await this.questions.toArray();
      const allP = await this.progress.toArray();
      const allN = await this.notes.toArray();
      const allK = await this.knowledge.toArray();
      const stars: Record<string, boolean> = {};
      allQ.forEach(q => { stars[q.id] = q.star; });
      const progress: Record<string, boolean> = {};
      allP.forEach(p => { progress[p.chapterId] = p.completed; });
      await syncUpload(progress, stars, allN, allK);
    } catch {} finally {
      _syncLock = false;
    }
  }

  async pullSync() {
    const now = Date.now();
    if (now - _lastSyncAt < SYNC_COOLDOWN) return;
    if (_syncLock) return;
    try {
      _syncLock = true;
      _lastSyncAt = now;
      const data = await syncDownload();
      if (!data) return;
      // Don't pull knowledge from sync since we use the server API directly
      // Knowledge sync is handled by the RAG pipeline
      // Merge stars
      if (data.stars) {
        for (const [qid, starred] of Object.entries(data.stars)) {
          const existing = await this.questions.get(qid);
          if (existing) await this.questions.update(qid, { star: starred });
        }
      }
      // last-modified 对比：只合并服务端更新的记录，避免覆盖本地编辑
      if (data.knowledge && Array.isArray(data.knowledge) && data.knowledge.length > 0) {
        const localAll = await this.knowledge.toArray();
        const localById = new Map(localAll.filter(k => k._id).map(k => [k._id!, k]));
        const toUpsert: any[] = [];
        for (const remote of data.knowledge) {
          if (!remote || !remote._id) continue;
          const local = localById.get(remote._id);
          if (!local) {
            toUpsert.push(remote);
          } else if (remote.updatedAt && local.updatedAt && remote.updatedAt > local.updatedAt) {
            toUpsert.push({ ...remote, id: local.id });
          }
        }
        for (const entry of toUpsert) {
          if (entry.id) {
            await this.knowledge.update(entry.id, entry);
          } else {
            await this.knowledge.add(entry);
          }
        }
      }
    } catch {} finally {
      _syncLock = false;
    }
  }

  async forceSync() {
    _lastSyncAt = 0;
    await this.pushSync();
    await this.pullSync();
  }
}

export const db = new StudyDB();
export default db;
