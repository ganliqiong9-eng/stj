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
