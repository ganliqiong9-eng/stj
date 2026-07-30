// API 地址：优先使用 localStorage 中配置的地址，否则自动检测
function getApiBase(): string {
  // 1. 用户手动配置的地址（优先级最高）
  const custom = localStorage.getItem('sbuddy_api_base');
  if (custom) return custom;
  // 2. PWA standalone 模式：回退到 localhost
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return 'http://localhost:8086';
  // 3. 开发环境或同域部署：使用当前 hostname
  return `http://${window.location.hostname}:8086`;
}

import type { QA } from './data/content';

export const API_BASE = getApiBase();

export interface RagChunk {
  id: string;
  article_id: string;
  article_title: string;
  content: string;
  score: number;
}

export interface RagQueryResult {
  results: RagChunk[];
  answer: string | null;
  status: string;
}

export interface RagStatus {
  status: string;
  dimension: number;
  articles: number;
  chunks: number;
  configured: boolean;
  endpoint: string;
  model: string;
}

function getDeviceToken(): string {
  let token = localStorage.getItem('sync_device_token');
  if (!token) {
    // Generate and register a new token
    token = crypto.randomUUID();
    localStorage.setItem('sync_device_token', token);
    // Async registration
    fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: navigator.platform || 'unknown' })
    }).then(r => r.json()).then(d => {
      if (d.token) localStorage.setItem('sync_device_token', d.token);
    }).catch(() => {});
  }
  return token;
}

const headers = () => ({
  'Content-Type': 'application/json',
  'x-device-token': getDeviceToken(),
  'x-device-name': navigator.platform || 'unknown',
});

export async function syncUpload(progress: Record<string, boolean>, stars: Record<string, boolean>, notes: any[], knowledge?: any[]) {
  try {
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ progress, stars, notes, knowledge }),
    });
    return res.ok;
  } catch { return false; }
}

export async function syncDownload(): Promise<{ progress: Record<string, boolean>; stars: Record<string, boolean>; notes: any[]; knowledge: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sync`, { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// === RAG API ===

export async function ragQuery(query: string, topK = 5): Promise<RagQueryResult> {
  try {
    const res = await fetch(`${API_BASE}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!res.ok) return { results: [], answer: null, status: 'error' };
    return await res.json();
  } catch { return { results: [], answer: null, status: 'error' }; }
}

export async function getRagStatus(): Promise<RagStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/api/rag/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function configureRag(endpoint: string, model: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/rag/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, model, key }),
    });
    return res.ok;
  } catch { return false; }
}

export async function addKnowledge(article: { _id?: string; title: string; subj?: string; tags?: string; source?: string; sections?: any[]; createdAt?: string; updatedAt?: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article),
    });
    return res.ok;
  } catch { return false; }
}

export async function listKnowledge(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/knowledge`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}

// ============================================================
// AI Generate Cards API
// ============================================================

export async function generateQACards(sections: { title: string; body: string; code: string }[]): Promise<{
  ok: boolean;
  cards: (import('./data/content').QA | null)[];
  error?: string;
}> {
  const API_KEY_READ = 'sbuddy_key';
  const ENDPOINT_KEY = 'sbuddy_endpoint';
  const MODEL_KEY = 'sbuddy_model';
  
  function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
  
  const KEY_ENC_PREFIX = 'enc:';
  function decodeKey(stored: string): string {
    if (!stored.startsWith(KEY_ENC_PREFIX)) return stored;
    try { return decodeURIComponent(atob(stored.slice(KEY_ENC_PREFIX.length))); } catch { return stored; }
  }
  const rawKey = g(API_KEY_READ, '');
  if (!rawKey) return { ok: false, cards: sections.map(() => null), error: '请先在 AI 助手中配置 API Key' };
  
  try {
    const res = await fetch(`${API_BASE}/api/generate-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sections,
        llm_config: {
          endpoint: g(ENDPOINT_KEY, 'https://api.deepseek.com/chat/completions'),
          api_key: decodeKey(rawKey),
          model: g(MODEL_KEY, 'deepseek-chat'),
        },
      }),
    });
    if (!res.ok) return { ok: false, cards: sections.map(() => null), error: '服务器失败: HTTP ' + res.status };
    return await res.json();
  } catch {
    return { ok: false, cards: sections.map(() => null), error: '网络错误' };
  }
}



// ============================================================
// Quiz API
// ============================================================

export async function generateQuiz(params: {
  subj?: string;
  level?: string;
  count?: number;
  types?: string[];
}): Promise<{ ok: boolean; quiz: any[]; error?: string }> {
  const API_KEY = 'sbuddy_key';
  const ENDPOINT_KEY = 'sbuddy_endpoint';
  const MODEL_KEY = 'sbuddy_model';
  function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
  const KEY_ENC_PREFIX = 'enc:';
  function decodeKey(stored: string): string {
    if (!stored.startsWith(KEY_ENC_PREFIX)) return stored;
    try { return decodeURIComponent(atob(stored.slice(KEY_ENC_PREFIX.length))); } catch { return stored; }
  }
  const rawKey = g(API_KEY, '');
  if (!rawKey) return { ok: false, quiz: [], error: 'API Key not configured' };
  try {
    const res = await fetch(`${API_BASE}/api/rag/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        llm_config: {
          endpoint: g(ENDPOINT_KEY, 'https://api.deepseek.com/chat/completions'),
          api_key: decodeKey(rawKey),
          model: g(MODEL_KEY, 'deepseek-chat'),
        },
      }),
    });
    return await res.json();
  } catch { return { ok: false, quiz: [], error: 'Network error' }; }
}



// ============================================================
// Certification / Knowledge Point API
// ============================================================

export async function uploadAndExtractKnowledge(file: File, certType?: string): Promise<{ ok: boolean; points?: any[]; title?: string; error?: string }> {
  const API_KEY = 'sbuddy_key';
  const ENDPOINT_KEY = 'sbuddy_endpoint';
  const MODEL_KEY = 'sbuddy_model';
  function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
  const KEY_ENC_PREFIX = 'enc:';
  function decodeKey(stored: string): string {
    if (!stored.startsWith(KEY_ENC_PREFIX)) return stored;
    try { return decodeURIComponent(atob(stored.slice(KEY_ENC_PREFIX.length))); } catch { return stored; }
  }
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const res = await fetch(`${API_BASE}/api/knowledge/upload-and-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_base64: b64, filename: file.name, certType: certType || 'general',
        llm_config: { endpoint: g(ENDPOINT_KEY, 'https://api.deepseek.com/chat/completions'), api_key: decodeKey(g(API_KEY, '')), model: g(MODEL_KEY, 'deepseek-chat') },
      }),
    });
    return await res.json();
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function getKnowledgePoints(params?: { cert?: string; subj?: string; limit?: number; offset?: number }): Promise<{ ok: boolean; items: any[]; total: number }> {
  try {
    const p = new URLSearchParams();
    if (params?.cert) p.set('cert', params.cert);
    if (params?.subj) p.set('subj', params.subj);
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const res = await fetch(`${API_BASE}/api/knowledge/points?${p}`);
    return await res.json();
  } catch { return { ok: false, items: [], total: 0 }; }
}

export async function generateQuestions(params: { certType?: string; pointIds?: string[]; count?: number }): Promise<{ ok: boolean; questions: any[]; error?: string }> {
  const API_KEY = 'sbuddy_key';
  const ENDPOINT_KEY = 'sbuddy_endpoint';
  const MODEL_KEY = 'sbuddy_model';
  function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
  const KEY_ENC_PREFIX = 'enc:';
  function decodeKey(stored: string): string {
    if (!stored.startsWith(KEY_ENC_PREFIX)) return stored;
    try { return decodeURIComponent(atob(stored.slice(KEY_ENC_PREFIX.length))); } catch { return stored; }
  }
  try {
    const res = await fetch(`${API_BASE}/api/questions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        llm_config: { endpoint: g(ENDPOINT_KEY, 'https://api.deepseek.com/chat/completions'), api_key: decodeKey(g(API_KEY, '')), model: g(MODEL_KEY, 'deepseek-chat') },
      }),
    });
    return await res.json();
  } catch { return { ok: false, questions: [], error: 'Network error' }; }
}

export async function getQuestionBank(params?: { cert?: string; limit?: number; offset?: number }): Promise<{ ok: boolean; items: any[]; total: number }> {
  try {
    const p = new URLSearchParams();
    if (params?.cert) p.set('cert', params.cert);
    if (params?.limit) p.set('limit', String(params.limit));
    if (params?.offset) p.set('offset', String(params.offset));
    const res = await fetch(`${API_BASE}/api/questions/bank?${p}`);
    return await res.json();
  } catch { return { ok: false, items: [], total: 0 }; }
}

// ============================================================
// Knowledge Relations API
// ============================================================

export async function getKnowledgeByLevel(subj?: string, level?: string): Promise<{ ok: boolean; items: any[] }> {
  try {
    const params = new URLSearchParams();
    if (subj) params.set('subj', subj);
    if (level) params.set('level', level);
    const res = await fetch(`${API_BASE}/api/knowledge/by-level?${params}`);
    return await res.json();
  } catch { return { ok: false, items: [] }; }
}

export async function getRelatedKnowledge(id: string): Promise<{ ok: boolean; related: any[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/knowledge/${encodeURIComponent(id)}/related`);
    return await res.json();
  } catch { return { ok: false, related: [] }; }
}

// ============================================================
// Compiler API
// ============================================================

/** 数据行类型：字符串 / 数字 / null */
export type Row = (string | number | null)[];
/** 文件上传最大大小：50 MB */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

export interface CompilerResult {
  ok: boolean;
  msg: string;
  columns: string[];
  rows: Row[];
}

export interface CompilerTable {
  name: string;
  columns: string[];
  rowCount: number;
}

export async function runCompilerCode(language: 'sql' | 'python', code: string): Promise<CompilerResult> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code }),
    });
    if (!res.ok) return { ok: false, msg: '服务器连接失败', columns: [], rows: [] };
    return await res.json();
  } catch {
    return { ok: false, msg: '网络错误: 无法连接服务器', columns: [], rows: [] };
  }
}

export async function listCompilerTables(): Promise<CompilerTable[]> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/tables`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tables || [];
  } catch {
    return [];
  }
}

export async function getCompilerTableData(name: string): Promise<{ columns: string[]; rows: Row[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/table/${encodeURIComponent(name)}`);
    if (!res.ok) return { columns: [], rows: [] };
    return await res.json();
  } catch {
    return { columns: [], rows: [] };
  }
}

export interface ImportExcelResult {
  ok: boolean;
  msg: string;
  tableName?: string;
  rowCount?: number;
  columns?: { name: string; type: string; original: string }[];
}

export async function importCompilerExcel(file: File, tableName?: string): Promise<ImportExcelResult> {
  try {
    // Read file as base64
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const res = await fetch(`${API_BASE}/api/compiler/import-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_base64: base64, table_name: tableName }),
    });
    if (!res.ok) return { ok: false, msg: '导入请求失败' };
    return await res.json();
  } catch {
    return { ok: false, msg: '导入出错: 请检查文件格式' };
  }
}

export async function resetCompilerDB(): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/reset`, { method: 'POST' });
    return await res.json();
  } catch {
    return { ok: false, msg: '重置失败: 无法连接服务器' };
  }
}

export async function getCompilerSampleQueries(): Promise<{ sql: { title: string; code: string }[]; python: { title: string; code: string }[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/sample-queries`);
    if (!res.ok) return { sql: [], python: [] };
    return await res.json();
  } catch {
    return { sql: [], python: [] };
  }
}



// ============================================================
// Upgrade Upload Doc API (smart-index)
// ============================================================

export async function upgradeUploadDocForRag(file: File): Promise<UploadDocResult> {
  const API_KEY = 'sbuddy_key';
  const ENDPOINT_KEY = 'sbuddy_endpoint';
  const MODEL_KEY = 'sbuddy_model';
  function g(k: string, d: string): string { try { return localStorage.getItem(k) || d; } catch { return d; } }
  const KEY_ENC_PREFIX = 'enc:';
  function decodeKey(stored: string): string {
    if (!stored.startsWith(KEY_ENC_PREFIX)) return stored;
    try { return decodeURIComponent(atob(stored.slice(KEY_ENC_PREFIX.length))); } catch { return stored; }
  }
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const res = await fetch(`${API_BASE}/api/rag/upgrade-upload-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_base64: base64,
        filename: file.name,
        subj: 'custom',
        tags: '文档',
        llm_config: {
          endpoint: g(ENDPOINT_KEY, 'https://api.deepseek.com/chat/completions'),
          api_key: decodeKey(g(API_KEY, '')),
          model: g(MODEL_KEY, 'deepseek-chat'),
        },
      }),
    });
    if (!res.ok) return { ok: false, msg: '上传失败' };
    return await res.json();
  } catch {
    return { ok: false, msg: '网络错误: 无法连接服务器' };
  }
}

// ============================================================
// File Parser & Document Upload API
// ============================================================

export interface ParsedSection {
  id: string;
  title: string;
  body: string;
  code: string;
  tip: string;
}

export interface UploadDocResult {
  ok: boolean;
  msg: string;
  title?: string;
  fileType?: string;
  sections?: ParsedSection[];
  articleId?: string;
}

export async function uploadDocForRag(
  file: File,
  subject?: string,
  tags?: string,
): Promise<UploadDocResult> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const res = await fetch(`${API_BASE}/api/rag/upload-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_base64: base64,
        filename: file.name,
        subj: subject || 'custom',
        tags: tags || '文档',
      }),
    });
    if (!res.ok) return { ok: false, msg: '上传失败' };
    return await res.json();
  } catch {
    return { ok: false, msg: '网络错误: 无法连接服务器' };
  }
}

// ============================================================
// Excel Analysis API
// ============================================================

export interface AnalyzedColumn {
  name: string;
  originalName: string;
  type: string;
  description: string;
  sampleValues: string[];
  nonNullCount: number;
  totalCount: number;
}

export interface AnalyzeExcelResult {
  ok: boolean;
  msg: string;
  tableName?: string;
  rowCount?: number;
  columnCount?: number;
  columns?: AnalyzedColumn[];
  suggestedCategory?: string;
  folderId?: string;
  createSql?: string;
}

export async function analyzeExcel(file: File): Promise<AnalyzeExcelResult> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const res = await fetch(`${API_BASE}/api/compiler/analyze-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_base64: base64, filename: file.name }),
    });
    if (!res.ok) return { ok: false, msg: '分析请求失败' };
    return await res.json();
  } catch {
    return { ok: false, msg: '网络错误: 无法连接服务器' };
  }
}

export interface CreateFromExcelResult {
  ok: boolean;
  msg: string;
  tableName?: string;
  rowCount?: number;
  columns?: AnalyzedColumn[];
  folderId?: string;
  createSql?: string;
}

export async function createTableFromExcel(
  file: File,
  folderId?: string,
  customSql?: string,
): Promise<CreateFromExcelResult> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const res = await fetch(`${API_BASE}/api/compiler/create-from-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_base64: base64,
        filename: file.name,
        folder_id: folderId,
        custom_sql: customSql,
      }),
    });
    if (!res.ok) return { ok: false, msg: '创建请求失败' };
    return await res.json();
  } catch {
    return { ok: false, msg: '网络错误: 无法连接服务器' };
  }
}



export async function getTableMeta(tableName: string): Promise<{ ok: boolean; meta: Record<string, any> }> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/table/${encodeURIComponent(tableName)}/meta`);
    return await res.json();
  } catch { return { ok: false, meta: {} }; }
}

export async function updateTableMeta(tableName: string, meta: Record<string, any>): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/table/${encodeURIComponent(tableName)}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta }),
    });
    return await res.json();
  } catch { return { ok: false }; }
}

// ============================================================
// Folder API
// ============================================================

export interface FolderInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface FolderData {
  folders: FolderInfo[];
  tableAssignments: Record<string, string>;
}

export async function getFolders(): Promise<FolderData> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/folders`);
    if (!res.ok) return { folders: [], tableAssignments: {} };
    return await res.json();
  } catch {
    return { folders: [], tableAssignments: {} };
  }
}

export async function moveTableToFolder(tableName: string, folderId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/compiler/move-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name: tableName, folder_id: folderId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
