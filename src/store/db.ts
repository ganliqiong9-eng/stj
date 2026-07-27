import Dexie, { type Table } from 'dexie';
import { defaultQuestions, type Question } from '../data/questions';

export interface StoredNote {
  id?: number;
  courseId: string;
  title: string;
  content: string;
  createdAt: string;
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
    return this.notes.add(note);
  }

  async getNotes(courseId: string) {
    return this.notes.where('courseId').equals(courseId).toArray();
  }

  async markChapterDone(chapterId: string) {
    await this.progress.put({
      chapterId,
      completed: true,
      updatedAt: new Date().toISOString()
    });
  }

  async isChapterDone(chapterId: string) {
    const p = await this.progress.get(chapterId);
    return p?.completed ?? false;
  }
}

export const db = new StudyDB();
export default db;
