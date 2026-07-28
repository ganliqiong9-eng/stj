import Dexie, { type Table } from 'dexie';
import { defaultQuestions, type Question } from '../data/questions';
import type { Section } from '../data/content';
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
  }

  async isChapterDone(chapterId: string) {
    const p = await this.progress.get(chapterId);
    return p?.completed ?? false;
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
    try {
      const allQ = await this.questions.toArray();
      const allP = await this.progress.toArray();
      const allN = await this.notes.toArray();
      const allK = await this.knowledge.toArray();
      const stars: Record<string, boolean> = {};
      allQ.forEach(q => { stars[q.id] = q.star; });
      const progress: Record<string, boolean> = {};
      allP.forEach(p => { progress[p.chapterId] = p.completed; });
      await syncUpload(progress, stars, allN, allK);
    } catch {}
  }

  async pullSync() {
    try {
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
      // Merge knowledge from server
      if (data.knowledge) {
        for (const k of data.knowledge) {
          const existing = await this.knowledge.where('_id').equals(k._id).first();
          if (!existing) {
            await this.knowledge.add(k);
          }
        }
      }
    } catch {}
  }
}

export const db = new StudyDB();
export default db;
