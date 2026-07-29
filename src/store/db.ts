import Dexie, { type Table } from 'dexie';
import { defaultQuestions, type Question } from '../data/questions';
import type { Section } from '../data/content';
import { syncUpload, syncDownload } from '../api';
import type { Row } from '../api';

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

  constructor() {
    super('StudyBuddy');
    this.version(1).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId',
      knowledge: '++id, subj'
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
    note._id = crypto.randomUUID();
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
      _id: entry._id || crypto.randomUUID(),
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
