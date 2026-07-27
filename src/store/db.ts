import Dexie, { type Table } from 'dexie';
import { defaultQuestions, type Question } from '../data/questions';
import { syncUpload, syncDownload } from '../api';

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

class StudyDB extends Dexie {
  questions!: Table<Question, string>;
  notes!: Table<StoredNote, number>;
  progress!: Table<StoredProgress, string>;

  constructor() {
    super('StudyBuddy');
    this.version(1).stores({
      questions: 'id, subj, star',
      notes: '++id, courseId',
      progress: 'chapterId'
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
  }

  async isChapterDone(chapterId: string) {
    const p = await this.progress.get(chapterId);
    return p?.completed ?? false;
  }

  // === Sync methods ===
  async pushSync() {
    try {
      const allQ = await this.questions.toArray();
      const allP = await this.progress.toArray();
      const allN = await this.notes.toArray();
      const stars: Record<string, boolean> = {};
      allQ.forEach(q => { stars[q.id] = q.star; });
      const progress: Record<string, boolean> = {};
      allP.forEach(p => { progress[p.chapterId] = p.completed; });
      await syncUpload(progress, stars, allN);
    } catch {}
  }

  async pullSync() {
    try {
      const data = await syncDownload();
      if (!data) return;
      // Merge stars
      if (data.stars) {
        for (const [qid, starred] of Object.entries(data.stars)) {
          const existing = await this.questions.get(qid);
          if (existing) await this.questions.update(qid, { star: starred });
        }
      }
    } catch {}
  }
}

export const db = new StudyDB();
export default db;
