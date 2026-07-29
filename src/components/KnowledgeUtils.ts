import type { Section } from '../data/content';

export const SUBJECT_OPTIONS = [
  { value: 'sql', label: 'SQL' },
  { value: 'py', label: 'Python' },
  { value: 'da', label: '数据分析' },
  { value: 'dma', label: 'DAMA' },
  { value: 'custom', label: '自定义' },
];

export function formatDate(s: string) {
  try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
}

export function emptySection(): Section {
  return { title: '', body: '', code: '', tip: '' };
}
