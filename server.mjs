import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { initCompilerDB, runSQL, runPython, listTables, getTableData, importExcel, resetDatabase, getSampleQueries } from './server-compiler.mjs';
import crypto from 'node:crypto';
import { parseDocForRAG, analyzeExcelFields, createTableFromExcel, getFolders, moveTableToFolder } from './server-file-parser.mjs';


// ============================================================
// Configuration
// ============================================================
const PORT = 8086;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CHUNKS_PER_DOC = 50;

let _uploadMutex = false;
let _uploadBusyUntil = 0;
const _llmCallTimes = [];
const MAX_LLM_PER_MINUTE = 10;
const MAX_LLM_PER_HOUR = 60;

function checkLlmRateLimit() {
  const now = Date.now();
  const recentMin = _llmCallTimes.filter(t => t > now - 60000).length;
  if (recentMin >= MAX_LLM_PER_MINUTE) return false;
  if (_llmCallTimes.length >= MAX_LLM_PER_HOUR) return false;
  _llmCallTimes.push(now);
  return true;
}

let _rejectNewTasks = false;
setInterval(() => {
  const mem = process.memoryUsage();
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  if (rssMB > 1024) _rejectNewTasks = true;
  if (rssMB < 512) _rejectNewTasks = false;
}, 30000);
const BASE = path.dirname(new URL(import.meta.url).pathname);
const DATA_FILE = path.join(BASE, 'data.json');
const KNOWLEDGE_FILE = path.join(BASE, 'knowledge.json');
const EMBEDDINGS_FILE = path.join(BASE, 'embeddings.json');
const RAG_CONFIG_FILE = path.join(BASE, 'rag_config.json');
const TABLE_META_FILE = path.join(BASE, 'table_meta.json');
const KNOWLEDGE_POINTS_FILE = path.join(BASE, 'knowledge_points.json');
const QUESTIONS_FILE = path.join(BASE, 'questions.json');
const LEARNING_PATHS_FILE = path.join(BASE, 'learning-paths.json');
const LEARNING_PROGRESS_FILE = path.join(BASE, 'learning_progress.json');
const LEARNING_CONTENT_FILE = path.join(BASE, 'learning_content.json');

// ============================================================
// Storage helpers
// ============================================================
function readJSON(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { /* corrupted, reset */ }
  return fallback;
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadData() { return readJSON(DATA_FILE, { devices: {}, progress: {}, stars: {}, notes: [] }); }
function saveData(d) { writeJSON(DATA_FILE, d); }

function loadKnowledge() { return readJSON(KNOWLEDGE_FILE, []); }
function saveKnowledge(d) { writeJSON(KNOWLEDGE_FILE, d); }

function loadEmbeddings() { return readJSON(EMBEDDINGS_FILE, []); }
function saveEmbeddings(d) { writeJSON(EMBEDDINGS_FILE, d); }

function loadRagConfig() {
  const cfg = readJSON(RAG_CONFIG_FILE, { embedding_endpoint: '', embedding_model: '', embedding_key: '', dimension: 0, status: 'unconfigured' });
  return cfg;
}
function saveRagConfig(c) { writeJSON(RAG_CONFIG_FILE, c); }

// ============================================================
// Utility
// ============================================================
function uuid() { return crypto.randomUUID(); }
function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
  });
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}



// ============================================================
// Async Task Queue (M4 performance protection)
// ============================================================
const taskQueue = {
  queue: [],
  running: 0,
  maxConcurrent: 1,
  history: [],

  add(type, payload, handler) {
    return new Promise((resolve) => {
      this.queue.push({ type, payload, handler, resolve, createdAt: Date.now() });
      this.processNext();
    });
  },

  async processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    this.running++;
    const task = this.queue.shift();
    try {
      const result = await task.handler(task.payload);
      this.history.push({ type: task.type, status: 'done', createdAt: task.createdAt, finishedAt: Date.now() });
      task.resolve({ ok: true, result });
    } catch (err) {
      this.history.push({ type: task.type, status: 'error', error: err.message, createdAt: task.createdAt, finishedAt: Date.now() });
      task.resolve({ ok: false, error: err.message });
    }
    this.running--;
    this.processNext();
  },

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      recentHistory: this.history.slice(-10),
    };
  }
};




// ============================================================
// SM-2 Spaced Repetition Algorithm
// ============================================================
function sm2Schedule(quality, prevEase, prevInterval, prevReps) {
  let ease = prevEase || 2.5;
  let interval = prevInterval || 0;
  let reps = prevReps || 0;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 3;
    else interval = Math.round(interval * ease);
    reps++;
  }

  ease = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const next = new Date();
  next.setDate(next.getDate() + interval);

  return { easeFactor: ease, interval, repetitions: reps, nextReviewDate: next.toISOString().slice(0, 10) };
}

// ============================================================
// Chunking logic
// ============================================================
function chunkText(text) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = [];
  let currentLen = 0;
  const MAX_CHUNK = 400;

  for (const para of paragraphs) {
    const pLen = para.length + 1;
    if (currentLen + pLen > MAX_CHUNK && current.length > 0) {
      chunks.push(current.join('\n\n'));
      // Keep last sentence for overlap
      const kept = [];
      let keptLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const k = current[i];
        if (keptLen + k.length > 80) break;
        kept.unshift(k);
        keptLen += k.length;
      }
      current = kept;
      currentLen = keptLen;
    }
    current.push(para);
    currentLen += pLen;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks.length > 0 ? chunks : [text];
}

// Chunk article sections into indexed pieces
function chunkArticle(article) {
  const allText = (article.sections || [])
    .map(s => `${s.title || ''}\n${s.body || ''}${s.code ? '\n```\n' + s.code + '\n```' : ''}${s.tip ? '\n💡 ' + s.tip : ''}`)
    .join('\n\n');
  const enriched = `# ${article.title}\n\n${allText}`;

  const rawChunks = chunkText(allText);
  return rawChunks.map((content, i) => {
    // Prepend title to each chunk for semantic context
    const enrichedContent = i === 0 ? enriched : `${article.title} › ${content}`;
    return {
    id: uuid(),
    article_id: article.id || article._id,
    article_title: article.title,
    content: enrichedContent,
    chunk_index: i,
    };
  });
}

// ============================================================
// Embedding service (OpenAI-compatible)
// ============================================================
async function embedTexts(texts, config) {
  if (!config || !config.embedding_endpoint || !config.embedding_key) {
    return null;
  }
  try {
    const resp = await fetch(config.embedding_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.embedding_key}`,
      },
      body: JSON.stringify({
        model: config.embedding_model || 'text-embedding-3-small',
        input: texts,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.data || !Array.isArray(data.data)) return null;
    return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
  } catch {
    return null;
  }
}

// ============================================================
// Cosine similarity
// ============================================================
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb);
  return mag === 0 ? 0 : dot / mag;
}

// ============================================================
// Learning paths helpers
// ============================================================
function loadLearningPaths() { return readJSON(LEARNING_PATHS_FILE, { paths: [] }); }
function loadLearningProgress() { return readJSON(LEARNING_PROGRESS_FILE, {}); }
function saveLearningProgress(data) { writeJSON(LEARNING_PROGRESS_FILE, data); }
function loadLearningContent() { return readJSON(LEARNING_CONTENT_FILE, {}); }
function saveLearningContent(data) { writeJSON(LEARNING_CONTENT_FILE, data); }

function findKnowledgePointConfig(cfg, knowledgePointId) {
  for (const p of cfg.paths || []) {
    for (const ch of p.chapters || []) {
      const kp = (ch.knowledgePoints || []).find(k => k.id === knowledgePointId);
      if (kp) return { path: p, chapter: ch, kp };
    }
  }
  return null;
}

function collectKnowledgePointIds(cfg) {
  const ids = [];
  for (const p of cfg.paths || []) {
    for (const ch of p.chapters || []) {
      for (const kp of ch.knowledgePoints || []) ids.push(kp.id);
    }
  }
  return ids;
}

function chapterProgress(ch, progress) {
  const kps = ch.knowledgePoints || [];
  const completed = kps.filter(kp => progress[kp.id]?.status === 'completed').length;
  return { completed, total: kps.length, percent: kps.length > 0 ? Math.round((completed / kps.length) * 100) : 0 };
}

function pathProgress(p, progress) {
  let total = 0, completed = 0;
  for (const ch of p.chapters || []) {
    total += (ch.knowledgePoints || []).length;
    completed += (ch.knowledgePoints || []).filter(kp => progress[kp.id]?.status === 'completed').length;
  }
  return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function extractJsonObject(text) {
  if (!text) return null;
  let s = String(text).trim();
  const fence = s.indexOf('```');
  if (fence >= 0) s = s.slice(fence + 3).replace(/^[^\n]*\n/, '').replace(/```[\s\S]*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  const arrStart = s.indexOf('[');
  const arrEnd = s.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try { return JSON.parse(s.slice(arrStart, arrEnd + 1)); } catch {}
  }
  return null;
}

// ============================================================
// Keyword search (fallback when no embedding configured)
// ============================================================
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function keywordScore(queryTokens, content) {
  const ct = tokenize(content);
  if (ct.length === 0) return 0;
  let matches = 0;
  for (const qt of queryTokens) {
    if (ct.some(t => t.includes(qt) || qt.includes(t))) matches++;
  }
  return matches / Math.max(queryTokens.length, 1);
}

// ============================================================
// Re-index all knowledge into chunks + embeddings
// ============================================================
async function reindexAll(ragConfig) {
  const knowledge = loadKnowledge();
  let chunks = [];

  for (const article of knowledge) {
    const articleChunks = chunkArticle(article);
    chunks = chunks.concat(articleChunks);
  }

  // Try to embed
  const texts = chunks.map(c => c.content);
  let embeddings = null;
  if (ragConfig && ragConfig.embedding_endpoint && ragConfig.embedding_key) {
    try {
      embeddings = await embedTexts(texts, ragConfig);
      if (embeddings && embeddings.length === chunks.length) {
        ragConfig.dimension = embeddings[0].length;
        ragConfig.status = 'ready';
      } else {
        embeddings = null;
        ragConfig.status = 'partial';
      }
    } catch {
      ragConfig.status = 'partial';
    }
  } else {
    ragConfig.status = 'keyword';
  }

  // Store
  const chunkData = chunks.map((c, i) => ({
    ...c,
    embedding: embeddings ? embeddings[i] : null,
  }));
  saveEmbeddings(chunkData);
  saveRagConfig(ragConfig);
  return { chunkCount: chunkData.length, embedCount: embeddings ? embeddings.length : 0, status: ragConfig.status };
}



// ============================================================
// Smart Index - LLM-powered intelligent chunking + QA generation
// ============================================================

async function smartIndex(text, subj, llmConfig) {
  if (!llmConfig || !llmConfig.api_key) {
    // Fallback: use traditional chunking
    const chunks = chunkText(text);
    return chunks.map((c, i) => ({
      id: crypto.randomUUID(),
      title: `节 ${i + 1}`,
      body: c,
      qa: null,
      level: null,
      tags: [subj || 'custom'],
    }));
  }

  const SYSTEM_PROMPT_EN = `你是一个技术教育专家，善长把专业概念用生活化的比喻讲清楚。用户会给你一篇技术文档的全文，你的任务是：

1. 按知识点边界智能切分（不要按字数硬切），每个知识点应该是一个完整的、可独立理解的概念
2. 为每个知识点生成：
   - title: 简短明确的标题
   - body: 保留原文关键信息的内容
   - qa.question: 一道考察这个知识点的实战题目
   - qa.answer: 标准答案（3-5行）
   - qa.plain: 大白话解析，用“说白了”“就是说”开头，零基础也能听懂
   - qa.analogy: 生动比喻，用相亲/做饭/购物/物流场景类比技术概念，越具体越有趣越好
   - level: 难度 beginner/intermediate/advanced
   - tags: 2-4个关键词标签

严格输出JSON：
{ "sections": [{ "title": "...", "body": "...", "qa": { "question": "...", "answer": "...", "plain": "...", "analogy": "..." }, "level": "...", "tags": [...] }] }`;

  const userContent = `Document content:\n\n${text.substring(0, 8000)}`;

  try {
    const resp = await fetch(llmConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.api_key}`,
      },
      body: JSON.stringify({
        model: llmConfig.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_EN },
          { role: 'user', content: userContent },
        ],
        max_tokens: 8192,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) {
      let d = '';
      try { const j = await resp.json(); d = j.error?.message || ''; } catch {}
      throw new Error(d || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Failed to parse LLM response');
    }
    const sections = (result.sections || []).slice(0, MAX_CHUNKS_PER_DOC).map(s => ({
      id: crypto.randomUUID(),
      title: s.title || '',
      body: s.body || '',
      code: s.code || '',
      tip: s.tip || '',
      qa: s.qa ? {
        question: s.qa.question || '',
        answer: s.qa.answer || '',
        plain: s.qa.plain || '',
        analogy: s.qa.analogy || '',
      } : null,
      level: s.level || null,
      tags: s.tags || [],
      relatedIds: [],
    }));
    return sections;
  } catch (err) {
    // Fallback: use traditional chunking
    const chunks = chunkText(text);
    return chunks.map((c, i) => ({
      id: crypto.randomUUID(),
      title: `节 ${i + 1}`,
      body: c,
      qa: null,
      level: null,
      tags: [subj || 'custom'],
    }));
  }
}


// ============================================================
// RAG Query
// ============================================================
async function ragQuery(query, topK = 5, llmConfig) {
  const chunks = loadEmbeddings();
  const ragConfig = loadRagConfig();

  if (chunks.length === 0) {
    return { results: [], answer: null, status: 'empty' };
  }

  // Decide search method
  const useEmbedding = ragConfig.status === 'ready' && chunks.some(c => c.embedding);

  let scored;

  if (useEmbedding) {
    // Embed the query
    const emb = await embedTexts([query], ragConfig);
    if (emb && emb.length > 0) {
      const qVec = emb[0];
      scored = chunks
        .filter(c => c.embedding)
        .map(c => ({
          id: c.id,
          article_id: c.article_id,
          article_title: c.article_title,
          content: c.content,
          score: cosineSimilarity(qVec, c.embedding),
        }))
        .filter(r => r.score > 0.2);
      scored.sort((a, b) => b.score - a.score);
    } else {
      // Fall back to keyword
      const qt = tokenize(query);
      scored = chunks.map(c => ({
        id: c.id,
        article_id: c.article_id,
        article_title: c.article_title,
        content: c.content,
        score: keywordScore(qt, c.content),
      })).filter(r => r.score > 0);
      scored.sort((a, b) => b.score - a.score);
    }
  } else {
    // Keyword search
    const qt = tokenize(query);
    scored = chunks.map(c => ({
      id: c.id,
      article_id: c.article_id,
      article_title: c.article_title,
      content: c.content,
      score: keywordScore(qt, c.content),
    })).filter(r => r.score > 0);
    scored.sort((a, b) => b.score - a.score);
  }

  const results = scored.slice(0, topK);

  // Optionally generate LLM answer with context
  let answer = null;
  if (llmConfig && llmConfig.api_key && results.length > 0) {
    const context = results.map(r => `[${r.article_title}]\n${r.content}`).join('\n\n---\n\n');
    try {
      const resp = await fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.api_key}`,
        },
        body: JSON.stringify({
          model: llmConfig.model || 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是一个学习助手，基于以下知识库内容回答用户问题。请用中文回答，简洁专业，引用信息来源。\n\n## 知识库参考\n${context}`,
            },
            { role: 'user', content: query },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
      const data = await resp.json();
      answer = data.choices?.[0]?.message?.content || null;
    } catch {
      answer = null;
    }
  }

  return { results, answer, status: useEmbedding ? 'vector' : 'keyword' };
}

// ============================================================
// Seed existing course content into knowledge base
// ============================================================
async function seedBuiltinContent() {
  const existing = loadKnowledge();
  if (existing.length > 0) return; // Already seeded

  // Hard-code built-in course titles (avoids fragile regex on content.ts)
  const builtinCourses = [
    { id: 's1', title: 'SELECT 基础查询', subj: 'sql' },
    { id: 's2', title: 'WHERE 条件过滤', subj: 'sql' },
    { id: 's3', title: 'JOIN 多表连接', subj: 'sql' },
    { id: 's4', title: '窗口函数', subj: 'sql' },
    { id: 's5', title: '子查询与 CTE', subj: 'sql' },
    { id: 'p1', title: '变量与数据类型', subj: 'py' },
    { id: 'p2', title: '列表与循环', subj: 'py' },
    { id: 'p3', title: '函数与模块', subj: 'py' },
    { id: 'p4', title: '字典与集合', subj: 'py' },
    { id: 'd1', title: '数据分析流程', subj: 'da' },
    { id: 'd2', title: '数据清洗基础', subj: 'da' },
    { id: 'd3', title: '可视化入门', subj: 'da' },
    { id: 'm1', title: '数据管理概述', subj: 'dma' },
    { id: 'm2', title: '数据治理框架', subj: 'dma' },
    { id: 'm3', title: '数据架构', subj: 'dma' },
  ];

  const knowledge = builtinCourses.map(c => ({
    id: uuid(),
    _id: uuid(),
    title: c.title,
    subj: c.subj,
    tags: '内置课程',
    source: '课程内容',
    sections: [{ title: '内置内容', body: `这是来自课程「${c.title}」的内容，可通过学习页面查看完整版本。` }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _builtin: true,
  }));

  saveKnowledge(knowledge);
  console.log(`Seeded ${knowledge.length} built-in courses into knowledge base`);

  // Reindex after seeding
  const ragCfg = loadRagConfig();
  await reindexAll(ragCfg);
  console.log('Reindexed knowledge base after seeding');
}

// ============================================================
// Server
// ============================================================
http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    res.end();
    return;
  }

  // ---- Existing sync API ---- //

  // POST /api/register
  if (url === '/api/register' && method === 'POST') {
    const body = await parseBody(req);
    const token = uuid();
    const data = loadData();
    data.devices[token] = { name: body.name || 'unknown', lastSeen: new Date().toISOString() };
    saveData(data);
    return json(res, { token, message: 'Device registered' });
  }

  // Auth for sync endpoints
  const deviceId = (() => {
    const t = req.headers['x-device-token'];
    if (!t) return null;
    const d = loadData();
    if (!d.devices[t]) {
      d.devices[t] = { name: req.headers['x-device-name'] || 'unknown', lastSeen: new Date().toISOString() };
      saveData(d);
    }
    return t;
  })();

  // POST /api/sync
  if (url === '/api/sync' && method === 'POST') {
    if (!deviceId) return json(res, { error: 'Missing x-device-token' }, 401);
    const body = await parseBody(req);
    const data = loadData();
    if (body.progress) {
      Object.entries(body.progress).forEach(([k, v]) => {
        if (!data.progress[k]) data.progress[k] = {};
        data.progress[k][deviceId] = v;
      });
    }
    if (body.stars) {
      Object.entries(body.stars).forEach(([k, v]) => {
        if (!data.stars[k]) data.stars[k] = {};
        data.stars[k][deviceId] = v;
      });
    }
    if (body.notes) {
      const existingIds = new Set(data.notes.map(n => n._id));
      body.notes.forEach(n => {
        if (!n._id) n._id = uuid();
        if (!existingIds.has(n._id)) {
          n._device = deviceId;
          n._createdAt = new Date().toISOString();
          data.notes.push(n);
          existingIds.add(n._id);
        }
      });
    }
    data.devices[deviceId].lastSeen = new Date().toISOString();
    saveData(data);
    return json(res, { ok: true });
  }

  // GET /api/sync
  if (url === '/api/sync' && method === 'GET') {
    if (!deviceId) return json(res, { error: 'Missing x-device-token' }, 401);
    const data = loadData();
    const mergedProgress = {};
    Object.entries(data.progress).forEach(([ch, devs]) => {
      Object.values(devs).forEach(v => { mergedProgress[ch] = v; });
    });
    const mergedStars = {};
    Object.entries(data.stars).forEach(([qid, devs]) => {
      Object.values(devs).forEach(v => { mergedStars[qid] = v; });
    });
    return json(res, {
      progress: mergedProgress,
      stars: mergedStars,
      notes: data.notes || [],
      knowledge: loadKnowledge(),
      devices: Object.keys(data.devices).length,
    });
  }

  // ---- Knowledge API ---- //

  // GET /api/knowledge
  if (url === '/api/knowledge' && method === 'GET') {
    return json(res, loadKnowledge());
  }

  // POST /api/knowledge - Add/upload knowledge (auto-chunk + embed)
  if (url === '/api/knowledge' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.title) return json(res, { error: 'title required' }, 400);

    const article = {
      id: body._id || uuid(),
      _id: body._id || uuid(),
      title: body.title,
      subj: body.subj || 'custom',
      tags: body.tags || '',
      source: body.source || '',
      sections: body.sections || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const knowledge = loadKnowledge();
    knowledge.push(article);
    saveKnowledge(knowledge);

    // Reindex async (don't block response)
    const ragCfg = loadRagConfig();
    reindexAll(ragCfg).catch(() => {});

    return json(res, { ok: true, id: article.id });
  }

  // DELETE /api/knowledge/:id
  const deleteMatch = url.match(/^\/api\/knowledge\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1];
    let knowledge = loadKnowledge();
    knowledge = knowledge.filter(a => a.id !== id && a._id !== id);
    saveKnowledge(knowledge);
    // Reindex
    const ragCfg = loadRagConfig();
    reindexAll(ragCfg).catch(() => {});
    return json(res, { ok: true });
  }

  // ---- RAG API ---- //

  // POST /api/rag/configure - Save embedding config
  if (url === '/api/rag/configure' && method === 'POST') {
    const body = await parseBody(req);
    const cfg = loadRagConfig();
    if (body.endpoint !== undefined) cfg.embedding_endpoint = body.endpoint;
    if (body.model !== undefined) cfg.embedding_model = body.model;
    if (body.key !== undefined) cfg.embedding_key = body.key;
    saveRagConfig(cfg);

    // Reindex with new config
    await reindexAll(cfg);
    const updated = loadRagConfig();
    return json(res, { ok: true, status: updated.status, dimension: updated.dimension });
  }

  // GET /api/rag/status - Get RAG pipeline status
  if (url === '/api/rag/status' && method === 'GET') {
    const cfg = loadRagConfig();
    const chunks = loadEmbeddings();
    const articles = loadKnowledge();
    return json(res, {
      status: cfg.status,
      dimension: cfg.dimension,
      articles: articles.length,
      chunks: chunks.length,
      configured: !!(cfg.embedding_endpoint && cfg.embedding_key),
      endpoint: cfg.embedding_endpoint || '',
      model: cfg.embedding_model || '',
    });
  }

  // POST /api/rag/reindex - Force re-index all content
  if (url === '/api/rag/reindex' && method === 'POST') {
    const cfg = loadRagConfig();
    const result = await reindexAll(cfg);
    return json(res, result);
  }

  // POST /api/rag/query - RAG query
  if (url === '/api/rag/query' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.query) return json(res, { error: 'query required' }, 400);

    const llmConfig = body.llm_config || null;
    const result = await ragQuery(body.query, body.top_k || 5, llmConfig);
    return json(res, result);
  }

  // POST /api/rag/semantic-search - 语义搜索（返回相关片段，不带 LLM 回答）
  if (url === '/api/rag/semantic-search' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.query) return json(res, { error: 'query required' }, 400);
    const result = await ragQuery(body.query, body.top_k || 20, null);
    return json(res, { ok: true, results: result.results || [], status: result.status });
  }

  // POST /api/rag/upload-doc - Upload and parse document for RAG
  if (url === '/api/rag/upload-doc' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.file_base64) return json(res, { error: 'file_base64 required' }, 400);
    const buffer = Buffer.from(body.file_base64, 'base64');
    const filename = body.filename || 'document';
    const result = parseDocForRAG(buffer, filename);
    if (!result.ok) return json(res, result);
    const article = {
      _id: body._id || crypto.randomUUID(),
      title: result.title || filename,
      subj: body.subj || 'custom',
      tags: body.tags || '文档',
      source: "文件上传: " + filename + " (" + result.fileType + ")",
      sections: result.sections,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const knowledge = loadKnowledge();
    knowledge.push(article);
    saveKnowledge(knowledge);
    const ragCfg = loadRagConfig();
    reindexAll(ragCfg).catch(() => {});
    return json(res, { ok: true, sections: result.sections, title: result.title, fileType: result.fileType, articleId: article._id });
  }

  // ---- Compiler API ---- //
  if (url.startsWith("/api/compiler/")) {
    if (url === "/api/compiler/run" && method === "POST") {
      const body = await parseBody(req);
      if (!body.language || !body.code) return json(res, { error: "language and code required" }, 400);
      let result;
      if (body.language === "sql") {
        result = runSQL(body.code);
      } else if (body.language === "python") {
        result = runPython(body.code);
      } else {
        return json(res, { error: "Unsupported language" }, 400);
      }
      return json(res, result);
    }
    if (url === "/api/compiler/tables" && method === "GET") {
      const tables = listTables();
      return json(res, { tables });
    }
    if (url === "/api/compiler/sample-queries" && method === "GET") {
      return json(res, getSampleQueries());
    }
    if (url === "/api/compiler/reset" && method === "POST") {
      return json(res, resetDatabase());
    }
    if (url === "/api/compiler/import-excel" && method === "POST") {
      const body = await parseBody(req);
      if (!body.file_base64) return json(res, { error: "file_base64 required" }, 400);
      const buffer = Buffer.from(body.file_base64, "base64");
      const result = importExcel(buffer, body.table_name);
      return json(res, result);
    }
    const tableMatch = url.match(/^\/api\/compiler\/table\/([^/]+)$/);
    if (tableMatch && method === "GET") {
      const data = getTableData(decodeURIComponent(tableMatch[1]));
      return json(res, data);
    }
    if (url === '/api/compiler/analyze-excel' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.file_base64) return json(res, { error: 'file_base64 required' }, 400);
      const buffer = Buffer.from(body.file_base64, 'base64');
      const result = analyzeExcelFields(buffer, body.filename || 'spreadsheet.xlsx');
      return json(res, result);
    }
    if (url === '/api/compiler/create-from-excel' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.file_base64) return json(res, { error: 'file_base64 required' }, 400);
      const buffer = Buffer.from(body.file_base64, 'base64');
      const options = { folderId: body.folder_id, customSql: body.custom_sql };
      const result = createTableFromExcel(buffer, body.filename || 'spreadsheet.xlsx', options);
      return json(res, result);
    }
    if (url === '/api/compiler/folders' && method === 'GET') {
      return json(res, getFolders());
    }
    if (url === '/api/compiler/move-table' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.table_name || !body.folder_id) return json(res, { error: 'table_name and folder_id required' }, 400);
      return json(res, moveTableToFolder(body.table_name, body.folder_id));
    }

    // GET/POST /api/compiler/table/:name/meta - Table metadata
    const metaMatch = url.match(/^\/api\/compiler\/table\/([^/]+)\/meta$/);
    if (metaMatch && method === 'GET') {
      const name = decodeURIComponent(metaMatch[1]);
      const meta = readJSON(TABLE_META_FILE, {});
      return json(res, { ok: true, meta: meta[name] || {} });
    }
    if (metaMatch && method === 'POST') {
      (async () => {
        const name = decodeURIComponent(metaMatch[1]);
        const body = await parseBody(req);
        const meta = readJSON(TABLE_META_FILE, {});
        meta[name] = { ...(meta[name] || {}), ...body.meta, updatedAt: new Date().toISOString() };
        writeJSON(TABLE_META_FILE, meta);
        return json(res, { ok: true });
      })();
      return;
    }

    return json(res, { error: "Not found" }, 404);
  }


  // POST /api/generate-cards - AI generate knowledge cards from sections
  if (url === '/api/generate-cards' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const sections = body.sections || [];
      if (sections.length === 0) return json(res, { ok: false, cards: [], error: 'No sections provided' });

      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, cards: sections.map(() => null), error: 'LLM not configured' });

      const SYSTEM_PROMPT = `你是一个技术教育专家。用户会给你技术文档的章节内容，你需要为每个章节生成一个知识点卡片。

每个卡片包含4个字段，输出JSON数组：
1. question: 一句话提问，贴近实战场景，像面试题或考试题
2. answer: 标准答案，简洁准确，3-5行
3. plain: 大白话解析，用日常口语，零基础也能听懂，用“说白了”“就是说”开头
4. analogy: 生动比喻，用日常生活场景类比技术概念，越具体越好

要求：
- 比喻要接地气、有趣、帮助记忆
- 大白话要真的通俗，不要换个方式说术语
- 如果某个章节内容不足以生成卡片，返回null

严格输出JSON数组，每个元素是 {question, answer, plain, analogy} 或 null`;

      const userContent = sections.map((s, i) =>
        `第${i+1}章: ${s.title}\n内容: ${s.body}\n代码: ${s.code || '无'}`
      ).join('\n\n---\n\n');

      // Call LLM
      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmConfig.api_key}`,
          },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            max_tokens: 4096,
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });

        if (!resp.ok) {
          let d = '';
          try { const j = await resp.json(); d = j.error?.message || ''; } catch {}
          throw new Error(d || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        let cards;
        try {
          const parsed = JSON.parse(text);
          cards = parsed.cards || parsed;
          if (!Array.isArray(cards)) cards = [cards];
        } catch {
          cards = sections.map(() => null);
        }

        // Ensure cards length matches sections
        while (cards.length < sections.length) cards.push(null);

        return json(res, { ok: true, cards });
      } catch (err) {
        return json(res, { ok: false, cards: sections.map(() => null), error: err.message });
      }
    })();
    return;
  }



  // POST /api/rag/smart-index - LLM-powered intelligent chunking
  if (url === '/api/rag/smart-index' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      if (!checkLlmRateLimit()) return json(res, { ok: false, sections: [], error: 'rate limit' }, 429);
      if (!body.text) return json(res, { ok: false, error: 'text required' }, 400);
      const llmConfig = body.llm_config || null;
      const sections = await smartIndex(body.text, body.subj || 'custom', llmConfig);
      return json(res, { ok: true, sections });
    })();
    return;
  }

  // POST /api/rag/upgrade-upload-doc - Upload + Smart Index
  if (url === '/api/rag/upgrade-upload-doc' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, error: 'system busy' }, 503);
      if (_uploadMutex && Date.now() < _uploadBusyUntil) return json(res, { ok: false, error: '上传队列繁忙，请稍后重试' }, 429);
      _uploadMutex = true;
      _uploadBusyUntil = Date.now() + 5 * 60 * 1000;
      try {
        const body = await parseBody(req);
        if (!body.file_base64) return json(res, { ok: false, error: 'file_base64 required' }, 400);
        const fileBytes = Buffer.from(body.file_base64, 'base64').length;
        if (fileBytes > MAX_FILE_SIZE) return json(res, { ok: false, error: 'file too large (max 50MB)' }, 413);
        const buffer = Buffer.from(body.file_base64, 'base64');
        const filename = body.filename || 'document';
        const parseResult = parseDocForRAG(buffer, filename);
        if (!parseResult.ok) return json(res, parseResult);
        const fullText = (parseResult.sections || []).map(s => s.title ? `# ${s.title}\n\n${s.body}` : s.body).join('\n\n');
        const llmConfig = body.llm_config || null;
        const enriched = await smartIndex(fullText, body.subj || 'custom', llmConfig);
        const article = {
          _id: body._id || crypto.randomUUID(),
          title: parseResult.title || filename,
          subj: body.subj || 'custom',
          tags: body.tags || '文档',
          source: '文件上传: ' + filename + ' (' + parseResult.fileType + ')',
          sections: enriched.length > 0 ? enriched : (parseResult.sections || []),
          type: 'doc',
          status: 'indexed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const knowledge = loadKnowledge();
        knowledge.push(article);
        saveKnowledge(knowledge);
        const ragCfg = loadRagConfig();
        reindexAll(ragCfg).catch(() => {});
        return json(res, { ok: true, sections: article.sections, title: article.title, fileType: parseResult.fileType, articleId: article._id });
      } finally {
        _uploadMutex = false;
        _uploadBusyUntil = 0;
      }
    })();
    return;
  }

  // POST /api/rag/discover-links - Discover knowledge connections
  if (url === '/api/rag/discover-links' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const chunks = loadEmbeddings();
      const targetId = body.chunk_id || null;
      const threshold = body.threshold || 0.8;
      const links = [];
      for (let i = 0; i < chunks.length; i++) {
        if (targetId && chunks[i].id !== targetId) continue;
        if (!chunks[i].embedding) continue;
        for (let j = 0; j < chunks.length; j++) {
          if (i === j) continue;
          if (!chunks[j].embedding) continue;
          const sim = cosineSimilarity(chunks[i].embedding, chunks[j].embedding);
          if (sim > threshold) {
            links.push({
              source_id: chunks[i].id,
              target_id: chunks[j].id,
              similarity: Math.round(sim * 100) / 100,
            });
          }
        }
      }
      return json(res, { ok: true, links });
    })();
    return;
  }

  // GET /api/knowledge/by-level - Filter by subject + level
  if (url.startsWith('/api/knowledge/by-level') && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const subj = urlObj.searchParams.get('subj') || '';
    const level = urlObj.searchParams.get('level') || '';
    const knowledge = loadKnowledge();
    const items = [];
    for (const article of knowledge) {
      for (const sec of article.sections || []) {
        if (subj && article.subj !== subj) continue;
        if (level && sec.level !== level) continue;
        items.push({
          article_id: article.id || article._id,
          article_title: article.title,
          chunk_id: sec.id || crypto.randomUUID(),
          title: sec.title,
          level: sec.level || null,
          tags: sec.tags || [],
          qa: sec.qa || null,
        });
      }
    }
    return json(res, { ok: true, items });
  }


  // GET /api/knowledge/:id/related - Get related knowledge points
  const relatedMatch = url.match(/^\/api\/knowledge\/([^/]+)\/related$/);
  if (relatedMatch && method === 'GET') {
    const targetId = relatedMatch[1];
    const chunks = loadEmbeddings();
    const target = chunks.find(c => c.id === targetId || c.article_id === targetId);
    if (!target || !target.embedding) return json(res, { ok: true, related: [] });
    const related = [];
    for (const c of chunks) {
      if (c.id === target.id) continue;
      if (!c.embedding) continue;
      const sim = cosineSimilarity(target.embedding, c.embedding);
      if (sim > 0.7) {
        related.push({
          chunk_id: c.id,
          title: c.article_title + ' › ' + (c.content?.substring(0, 60) || ''),
          subj: c.subj || 'custom',
          level: c.level || null,
          similarity: Math.round(sim * 100) / 100,
        });
      }
    }
    related.sort((a, b) => b.similarity - a.similarity);
    return json(res, { ok: true, related: related.slice(0, 10) });
  }



  // POST /api/rag/generate-quiz - Generate quiz questions from knowledge base
  if (url === '/api/rag/generate-quiz' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, quiz: [], error: 'system busy' }, 503);
      if (!checkLlmRateLimit()) return json(res, { ok: false, quiz: [], error: 'rate limit' }, 429);
      const body = await parseBody(req);
      const subj = body.subj || '';
      const level = body.level || '';
      const knowledgeId = body.knowledgeId || '';
      const count = body.count || 10;
      const types = body.types || ['choice', 'fill', 'short_answer'];
      const llmConfig = body.llm_config || {};
      const excludeQuestions = body.excludeQuestions || [];
      if (!llmConfig.api_key) return json(res, { ok: false, quiz: [], error: 'LLM not configured' });

      // Fetch relevant chunks
      const knowledge = loadKnowledge();
      let relevantSections = [];
      for (const article of knowledge) {
        if (knowledgeId && article._id !== knowledgeId && article.id !== knowledgeId) continue;
        if (subj && article.subj !== subj) continue;
        for (const sec of article.sections || []) {
          if (level && sec.level !== level) continue;
          relevantSections.push({
            title: sec.title,
            body: sec.body,
            qa: sec.qa || null,
            level: sec.level || 'beginner',
            tags: sec.tags || [],
          });
        }
      }
      if (relevantSections.length === 0) {
        return json(res, { ok: false, quiz: [], error: 'No matching knowledge found' });
      }

      const excludeText = excludeQuestions.length > 0
        ? `\n- 避免生成与以下已刷过的题目相同或高度相似的题目：\n${excludeQuestions.map((q, i) => `${i + 1}. [${q.knowledgeTitle || '未知知识点'}] ${q.question}`).join('\n')}`
        : '';

      const SYS_PROMPT = `你是一名出题专家，擅长把专业概念用生活化比喻讲清楚。基于下面的知识要点生成考试题目。

要求：
- 选择题：4 个选项，1 个正确答案
- 填空题：挖掉一个关键词
- 简答题：需要解释概念或写代码
- 每道题尽量融入生活化比喻（相亲、做饭、购物、物流等场景），帮助记忆
- explanation 用大白话写清楚，最好带一句贴切的比喻
${excludeText}

严格输出 JSON 数组：
[{
  "type": "choice|fill|short_answer",
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A",
  "explanation": "..."
}]`;

      const knowledgeText = relevantSections.slice(0, 15).map(s =>
        `Title: ${s.title || 'Untitled'}\nContent: ${(s.body || '').substring(0, 300)}\nLevel: ${s.level}\nTags: ${(s.tags || []).join(', ')}`
      ).join('\n\n---\n\n');

      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: SYS_PROMPT },
              { role: 'user', content: `Generate ${count} questions (types: ${types.join(', ')}). Knowledge base:\n\n${knowledgeText}` },
            ],
            max_tokens: 4096,
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        let quiz = [];
        try { const p = JSON.parse(text); quiz = p.quiz || p; if (!Array.isArray(quiz)) quiz = [quiz]; } catch { quiz = []; }
        // Attach knowledgeId to each quiz item
        quiz = quiz.slice(0, count).map((q, i) => {
          const section = relevantSections[i % relevantSections.length];
          return {
            id: crypto.randomUUID(),
            knowledgeId: section?.title || '',
            knowledge: section ? {
              title: section.title,
              body: (section.body || '').substring(0, 800),
              level: section.level || 'beginner',
              tags: section.tags || [],
              qa: section.qa || null,
            } : null,
            type: q.type || 'choice',
            question: q.question || '',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || '',
          };
        });
        return json(res, { ok: true, quiz });
      } catch (err) {
        return json(res, { ok: false, quiz: [], error: err.message });
      }
    })();
    return;
  }

  // POST /api/quiz/deep-explain - 生成多维度深入解析
  if (url === '/api/quiz/deep-explain' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, error: 'system busy' }, 503);
      if (!checkLlmRateLimit()) return json(res, { ok: false, error: 'rate limit' }, 429);
      const body = await parseBody(req);
      const { question, correctAnswer, explanation, type, knowledgeTitle, knowledgeBody } = body;
      if (!question || !correctAnswer) {
        return json(res, { ok: false, error: '缺少题目或答案信息' }, 400);
      }
      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, error: 'LLM not configured' }, 500);

      const prompt = `你是一位耐心的数据管理/IT 领域导师。请对以下题目进行多维度深入解析，帮助用户真正理解这个知识点。

题目：${question}
题目类型：${type || '未知'}
正确答案：${correctAnswer}
基础解析：${explanation || '无'}
${knowledgeTitle ? `相关知识：${knowledgeTitle}` : ''}
${knowledgeBody ? `知识内容摘要：${String(knowledgeBody).substring(0, 300)}` : ''}

请按以下 5 个维度组织解析（每个维度用 emoji 标题 + 2-3 句话，简洁明了）：

📖 概念定义
用一句话精准定义这个概念/知识点。

🎯 生活类比
用一个日常生活场景来类比解释（如相亲、做饭、职场、物流等），让非技术人员也能秒懂。

💼 实际应用
在工作场景中，这个知识点怎么用到？举一个具体例子。

⚠️ 易混淆点
列出 1-2 个容易和这个概念搞混的点，说明区别。

💡 记忆技巧
给一个好记的口诀、联想或记忆方法。

注意：
- 用大白话，避免堆砌术语
- 每段 2-3 句话即可，不要长篇大论
- 类比要生动有趣，像朋友聊天一样
- 如果是编程题，实际应用部分给一个简短的代码示例`;

      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmConfig.api_key}`,
          },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一位生动有趣的IT/数据管理导师，擅长用大白话和生活类比解释复杂概念。' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('[deep-explain] LLM error:', resp.status, errText);
          return json(res, { ok: false, error: 'AI 服务返回错误' }, 502);
        }
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (!content) return json(res, { ok: false, error: 'AI 返回内容为空' }, 500);
        return json(res, { ok: true, content });
      } catch (err) {
        console.error('[deep-explain] Error:', err);
        return json(res, { ok: false, error: err.message }, 500);
      }
    })();
    return;
  }

  // ============================================================
  // Learning paths API
  // ============================================================

  // POST /api/learning-paths/sync - 从 JSON 配置文件同步骨架
  if (url === '/api/learning-paths/sync' && method === 'POST') {
    try {
      const cfg = JSON.parse(fs.readFileSync(LEARNING_PATHS_FILE, 'utf-8'));
      const validIds = collectKnowledgePointIds(cfg);
      const progress = loadLearningProgress();
      for (const id of Object.keys(progress)) {
        if (!validIds.includes(id)) delete progress[id];
      }
      saveLearningProgress(progress);
      return json(res, { ok: true, message: '同步完成' });
    } catch (err) {
      return json(res, { ok: false, error: 'learning-paths.json 格式错误: ' + err.message }, 400);
    }
  }

  // GET /api/learning-paths - 获取所有学习路径（含进度）
  if (url === '/api/learning-paths' && method === 'GET') {
    const cfg = loadLearningPaths();
    const progress = loadLearningProgress();
    const paths = (cfg.paths || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      progress: pathProgress(p, progress),
    }));
    return json(res, { ok: true, paths });
  }

  // GET /api/learning-paths/:id - 获取单个学习路径详情
  const learningPathMatch = url.match(/^\/api\/learning-paths\/([^/]+)$/);
  if (learningPathMatch && method === 'GET') {
    const cfg = loadLearningPaths();
    const progress = loadLearningProgress();
    const content = loadLearningContent();
    const p = (cfg.paths || []).find(x => x.id === learningPathMatch[1]);
    if (!p) return json(res, { ok: false, error: '路径不存在' }, 404);
    const chapters = (p.chapters || []).map(ch => ({
      id: ch.id,
      order: ch.order,
      title: ch.title,
      description: ch.description,
      knowledgePoints: (ch.knowledgePoints || []).map(kp => ({
        id: kp.id,
        order: kp.order,
        title: kp.title,
        contentGenerated: !!(content[kp.id]?.definition),
        content: content[kp.id] || null,
        progress: {
          status: progress[kp.id]?.status || 'not_started',
          quizScore: progress[kp.id]?.quizScore ?? null,
          quizCount: progress[kp.id]?.quizCount || 0,
          lastStudiedAt: progress[kp.id]?.lastStudiedAt || null,
        },
      })),
      progress: chapterProgress(ch, progress),
    }));
    return json(res, {
      ok: true,
      path: {
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon,
        progress: pathProgress(p, progress),
        chapters,
      },
    });
  }

  // POST /api/learning-progress - 记录学习进度
  if (url === '/api/learning-progress' && method === 'POST') {
    const body = await parseBody(req);
    const { pathId, chapterId, knowledgePointId, status, quizScore } = body;
    if (!knowledgePointId || !pathId || !chapterId || !status) {
      return json(res, { ok: false, error: '缺少必要参数' }, 400);
    }
    const progress = loadLearningProgress();
    const prev = progress[knowledgePointId] || { quizCount: 0 };
    const record = {
      pathId,
      chapterId,
      knowledgePointId,
      status,
      quizScore: typeof quizScore === 'number' ? quizScore : (prev.quizScore ?? null),
      quizCount: typeof quizScore === 'number' ? (prev.quizCount || 0) + 1 : (prev.quizCount || 0),
      lastStudiedAt: typeof quizScore === 'number' ? new Date().toISOString() : (prev.lastStudiedAt || null),
      updatedAt: new Date().toISOString(),
    };
    progress[knowledgePointId] = record;
    saveLearningProgress(progress);
    return json(res, { ok: true, progress: record });
  }

  // GET /api/learning-progress/:pathId - 获取某路径的学习进度
  const learningProgressMatch = url.match(/^\/api\/learning-progress\/([^/]+)$/);
  if (learningProgressMatch && method === 'GET') {
    const progress = loadLearningProgress();
    const list = Object.values(progress).filter(p => p.pathId === learningProgressMatch[1]);
    return json(res, { ok: true, progress: list });
  }

  // POST /api/learning-paths/generate-content - 为指定知识点生成学习内容
  if (url === '/api/learning-paths/generate-content' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, error: 'system busy' }, 503);
      if (!checkLlmRateLimit()) return json(res, { ok: false, error: 'rate limit' }, 429);
      const body = await parseBody(req);
      const knowledgePointId = body.knowledgePointId;
      if (!knowledgePointId) return json(res, { ok: false, error: '缺少知识点 ID' }, 400);
      const cfg = loadLearningPaths();
      const found = findKnowledgePointConfig(cfg, knowledgePointId);
      if (!found) return json(res, { ok: false, error: '知识点不存在' }, 404);

      const contentCache = loadLearningContent();
      const cached = contentCache[knowledgePointId];
      if (cached && cached.definition) {
        return json(res, { ok: true, ...cached, cached: true });
      }

      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, error: 'LLM not configured' }, 500);
      const { kp } = found;
      const isEnglish = found.path.id === 'english-essentials';

      let specialRules = '';
      if (isEnglish) {
        const title = kp.title || '';
        const rules = [];
        if (/时态|一般|进行|完成/.test(title)) rules.push('时态类知识点必须附带该时态的标志词列表');
        if (/对比|vs/.test(title)) rules.push('对比类知识点必须用 ❌ vs ✅ 表格对照，一目了然');
        if (/间接引语/.test(title)) rules.push('间接引语需包含时态后退规则');
        if (/缩略词/.test(title)) rules.push('缩略词需包含全称 + 中文释义 + 使用场景');
        if (/情态动词/.test(title)) rules.push('情态动词需区分主观/客观、建议/命令');
        if (/比较级|最高级/.test(title)) rules.push('比较级需包含规则变化和不规则变化完整表');
        if (rules.length > 0) specialRules = '\n【特殊要求】\n- ' + rules.join('\n- ');
      }

      const englishPrompt = `你是一位趣味英语语法老师，教学风格幽默、接地气，擅长用口诀和生活类比帮助记忆。

请为以下知识点生成学习内容：
- 路径：英语趣味语法
- 章节：${found.chapter.title}
- 知识点：${kp.title}

请按以下 5 个模块输出（第 6 模块「随堂小测」暂不实现）：

1. 🎯 核心口诀
   - definition：知识小结，1-2 句话概括本知识点最核心的规则
   - mnemonic：随堂小口诀，不超过 20 字，朗朗上口有节奏感，谐音梗/顺口溜/打油诗都行

2. 📖 生动用法解析
   - explanation：用生活化类比讲解规则（相亲/做饭/快递/公司/朋友圈等），先建立中文思维桥梁再对比英文差异，多条规则逐条编号拆解，禁止堆砌语法术语

3. 💬 实景例句
   - example：至少 3-5 个例句，格式为「英文 + 中文翻译 + (括号标注语法点)」，场景覆盖职场/物流/日常生活，禁止 "My name is Tom" 式课本句

4. ⚠️ 易错提示
   - mistakes：至少 2-3 个中国学生常见错误，格式「❌ 错误用法 → ✅ 正确用法 → 💡 为什么错」

5. 🔗 扩展固定搭配
   - collocations：3-8 个高频固定搭配/短语，优先职场/商务/物流场景，格式「搭配 + 中文 + 例句」${specialRules}

【输出格式】
严格返回 JSON。每个字段的值必须使用 Markdown 格式排版：
- 用 **加粗** 标记关键词/核心概念
- 用 - 列表 或 1. 2. 3. 编号列表 分行展示多条内容
- 用空行分段（两个换行）
- 例句每行一个，用 - 开头

示例：
{
  "definition": "**核心规则**：英语的「的」有三种表达\n\n- 有生命的用 **'s**（the boy's book）\n- 无生命的用 **of**（the door of the room）\n- 一一对应用 **to**（the key to the door）",
  "mnemonic": "**活的 's，死的 of，一对一的交给 to**",
  "explanation": "把所有格想象成「贴标签」：\n\n1. **'s** = 便利贴，直接贴在人/动物身上 → my dog's tail\n2. **of** = 快递单，写清楚「A of B = B 的 A」→ the roof of the house\n3. **to** = 配对关系，钥匙配锁、答案配题目 → the answer to the question\n\n⚠️ 注意：有些固定搭配不讲道理，只能记住：\n- **at the door**（在门口）不说 on the door\n- **the key to success**（成功的钥匙）不用 of",
  "example": "- **The manager's decision surprised everyone.** 经理的决定让所有人吃惊。（'s 所有格：人→决定）\n- **The completion rate of the project is 80%.** 项目完成率80%。（of 所有格：物→属性）\n- **She has the answer to the question.** 她有这道题的答案。（to 配对：答案→问题）\n- **The ETA of the shipment is next Monday.** 货物预计到达时间是下周一。（of + 物流场景）",
  "mistakes": "❌ **The book of Tom** is on the table.\n✅ **Tom's book** is on the table.\n💡 人名/有生命的名词用 's，不用 of。of 用于无生命的东西。\n\n❌ **I am looking for the key of the door.**\n✅ **I am looking for the key to the door.**\n💡 key/answer/response/solution 这些「配对关系」的词，后面固定用 to，不用 of。",
  "collocations": "- **the key to...** ……的钥匙/关键 → the key to success\n- **the answer to...** ……的答案 → the answer to the question\n- **at the door** 在门口 → Someone is knocking at the door\n- **the roof of** ……的屋顶 → the roof of the building\n- **by heart** 背诵 → Learn the poem by heart"
}`;

      const defaultPrompt = `你是一个专业的知识讲解专家，擅长用大白话和生动类比解释专业概念。

请围绕「${kp.title}」这个知识点，生成以下四部分内容：

1. 📖 定义（definition）：用一句话精准定义，不超过50字
2. 📚 详细解释（explanation）：用3-5句话详细解释，通俗易懂
3. 💼 实际例子（example）：给出1-2个真实工作场景的例子
4. 🎯 生活类比（analogy）：用生活化的比喻（如相亲、做饭、快递、职场等场景）帮助理解

【风格要求】
- 大白话，不要学术腔
- 类比要生动有趣、贴近生活
- 例子要贴合实际工作场景（尤其是数据/物流/IT 领域）

【输出格式】
严格返回 JSON。每个字段的值必须使用 Markdown 格式排版：
- 用 **加粗** 标记关键词/核心概念
- 用 - 列表 或 1. 2. 3. 编号列表分行展示多条内容
- 用空行分段

返回 JSON：
{
  "definition": "**核心定义**：用一句话精准描述...\n\n关键特征：\n- 特征1\n- 特征2\n- 特征3",
  "explanation": "**深入理解**：\n\n1. **第一点**：详细解释...\n2. **第二点**：详细解释...\n3. **第三点**：详细解释...",
  "example": "**工作场景**：\n\n- 例子1 + 具体说明\n- 例子2 + 具体说明",
  "analogy": "**生活类比**：\n\n把这个概念想象成...\n\n- 相似点1\n- 相似点2"
}`;

      const prompt = isEnglish ? englishPrompt : defaultPrompt;

      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个专业的知识讲解专家，输出必须是合法 JSON。' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: isEnglish ? 2500 : 1200,
            response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('[learning-content] LLM error:', resp.status, errText);
          return json(res, { ok: false, error: 'AI 服务返回错误' }, 502);
        }
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        const parsed = extractJsonObject(text);
        if (!parsed) return json(res, { ok: false, error: 'AI 返回内容格式错误' }, 500);
        const item = {
          definition: String(parsed.definition || '').trim(),
          explanation: String(parsed.explanation || '').trim(),
          example: String(parsed.example || '').trim(),
          analogy: String(parsed.analogy || '').trim(),
          ...(isEnglish ? {
            mnemonic: String(parsed.mnemonic || '').trim(),
            mistakes: String(parsed.mistakes || '').trim(),
            collocations: String(parsed.collocations || '').trim(),
          } : {}),
          generatedAt: new Date().toISOString(),
        };
        if (!item.definition) return json(res, { ok: false, error: 'AI 返回内容为空' }, 500);
        contentCache[knowledgePointId] = item;
        saveLearningContent(contentCache);
        return json(res, { ok: true, ...item, cached: false });
      } catch (err) {
        console.error('[learning-content] Error:', err);
        return json(res, { ok: false, error: err.message }, 500);
      }
    })();
    return;
  }

  // POST /api/quiz/by-knowledge - 基于知识点出题（RAG 优先）
  if (url === '/api/quiz/by-knowledge' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, quiz: [], error: 'system busy' }, 503);
      if (!checkLlmRateLimit()) return json(res, { ok: false, quiz: [], error: 'rate limit' }, 429);
      const body = await parseBody(req);
      const knowledgePointId = body.knowledgePointId;
      const count = body.count || 5;
      const types = body.types || ['choice', 'fill', 'short_answer'];
      const cfg = loadLearningPaths();
      const found = findKnowledgePointConfig(cfg, knowledgePointId);
      if (!found) return json(res, { ok: false, quiz: [], error: '知识点不存在' }, 404);
      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, quiz: [], error: 'LLM not configured' });
      const { kp } = found;
      const content = loadLearningContent();
      const kpContent = content[knowledgePointId] || {};

      let ragResults = [];
      try {
        const r = await ragQuery(kp.title, 5, null);
        ragResults = r.results || [];
      } catch (err) {
        console.warn('[by-knowledge] RAG search failed, fallback to pure AI:', err.message);
      }
      const hasRagContext = ragResults.length > 0;
      const knowledgeText = hasRagContext
        ? ragResults.map(r => `标题：${r.article_title || ''}\n内容：${(r.content || '').substring(0, 500)}`).join('\n---\n')
        : [kpContent.definition, kpContent.explanation, kpContent.example, kpContent.analogy].filter(Boolean).join('\n');
      const prompt = hasRagContext
        ? `你是一个专业考试出题专家。请基于以下参考资料，围绕「${kp.title}」这个知识点出题。

【参考资料】（来自用户知识库）
${knowledgeText}

【要求】
- 生成 ${count} 道题目
- 题型：${types.join('、')}
- 题目必须基于参考资料的内容，不要凭空编造
- 每道题附带正确答案和简要解析
- 选择题要有 4 个选项（A/B/C/D），其中 1 个正确答案
- 填空题用 ___ 标记答案位置
- 难度分布：简单40% + 中等40% + 较难20%

【输出格式】
返回 JSON 数组，每题格式：
[
  {
    "type": "choice|fill|short_answer",
    "question": "题目内容",
    "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
    "correctAnswer": "正确答案",
    "explanation": "解析",
    "difficulty": "easy|medium|hard"
  }
]`
        : `你是一个专业考试出题专家。请围绕「${kp.title}」这个知识点出题。

【知识点背景】
${knowledgeText || '（暂无背景资料，请用通用专业知识出题）'}

【要求】
- 生成 ${count} 道题目
- 题型：${types.join('、')}
- 每道题附带正确答案和简要解析
- 选择题要有 4 个选项（A/B/C/D），其中 1 个正确答案
- 填空题用 ___ 标记答案位置
- 难度分布：简单40% + 中等40% + 较难20%

【输出格式】
返回 JSON 数组，每题格式：
[
  {
    "type": "choice|fill|short_answer",
    "question": "题目内容",
    "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
    "correctAnswer": "正确答案",
    "explanation": "解析",
    "difficulty": "easy|medium|hard"
  }
]`;

      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个专业考试出题专家，输出必须是合法 JSON。' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 4096,
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        let raw = [];
        try { const parsed = JSON.parse(text); raw = parsed.quiz || parsed; if (!Array.isArray(raw)) raw = [raw]; } catch { raw = []; }
        const quiz = raw.slice(0, count).map(q => ({
          id: crypto.randomUUID(),
          knowledgeId: knowledgePointId,
          type: q.type || 'choice',
          question: q.question || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || q.answer || '',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          knowledge: { title: kp.title, body: knowledgeText.substring(0, 800), level: 'beginner', tags: [] },
        }));
        return json(res, { ok: true, quiz, hasRagContext });
      } catch (err) {
        return json(res, { ok: false, quiz: [], error: err.message });
      }
    })();
    return;
  }

  // POST /api/ai/tutor-session - 对话式刷题（多轮递进）
  if (url === '/api/ai/tutor-session' && method === 'POST') {
    (async () => {
      if (_rejectNewTasks) return json(res, { ok: false, error: 'system busy' }, 503);
      if (!checkLlmRateLimit()) return json(res, { ok: false, error: 'rate limit' }, 429);
      const body = await parseBody(req);
      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, error: 'LLM not configured' });
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const subj = body.subj || '';

      const knowledge = loadKnowledge();
      let relevantSections = [];
      for (const article of knowledge) {
        if (subj && article.subj !== subj) continue;
        for (const sec of article.sections || []) {
          relevantSections.push({ title: sec.title, body: sec.body, tags: sec.tags || [] });
        }
      }
      const knowledgeText = relevantSections.slice(0, 12).map(s =>
        `Title: ${s.title || 'Untitled'}\nContent: ${(s.body || '').substring(0, 300)}\nTags: ${(s.tags || []).join(', ')}`
      ).join('\n\n---\n\n');

      const SYS_PROMPT = `你是“大白话刷题教练”，擅长把专业概念用生活化比喻讲清楚（相亲、做饭、购物、物流等场景）。

规则：
1. 每轮出 5 道题，题型可混合选择题、填空题、简答题
2. 第一轮直接出题，开头用一句话打招呼
3. 之后每一轮：先根据用户上一轮的回答分析薄弱点（analysis 字段），再针对薄弱点出 5 道新题
4. 选择题 4 个选项，correctAnswer 填选项字母
5. explanation 用大白话写清楚，最好带一句贴切比喻

严格输出 JSON：
{
  "analysis": "对上一轮的回答分析（第一轮可留空）",
  "quiz": [{
    "type": "choice|fill|short_answer",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "explanation": "..."
  }]
}

知识库内容：
${knowledgeText || '（暂无知识库内容，请用通用常识出题）'}`;

      try {
        const res2 = await fetch(llmConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: SYS_PROMPT },
              ...messages.slice(-10),
            ],
            max_tokens: 4096,
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const data = await res2.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        let parsed = {};
        try { parsed = JSON.parse(text); } catch { parsed = {}; }
        const quiz = Array.isArray(parsed.quiz) ? parsed.quiz.slice(0, 5).map((q) => ({
          id: crypto.randomUUID(),
          type: q.type || 'choice',
          question: q.question || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || '',
        })) : [];
        return json(res, { ok: true, analysis: parsed.analysis || '', quiz });
      } catch (err) {
        return json(res, { ok: false, error: err.message });
      }
    })();
    return;
  }

  // GET /api/knowledge/stats - Knowledge base statistics
  if (url === '/api/knowledge/stats' && method === 'GET') {
    const knowledge = loadKnowledge();
    const chunks = loadEmbeddings();
    let bySubj = {};
    let byStatus = {};
    let totalSections = 0;
    let totalQaCards = 0;
    for (const article of knowledge) {
      bySubj[article.subj] = (bySubj[article.subj] || 0) + 1;
      const st = article.status || 'indexed';
      byStatus[st] = (byStatus[st] || 0) + 1;
      totalSections += (article.sections || []).length;
      totalQaCards += (article.sections || []).filter(s => s.qa).length;
    }
    return json(res, {
      ok: true,
      total: knowledge.length,
      totalChunks: chunks.length,
      totalSections,
      totalQaCards,
      bySubj,
      byStatus,
    });
  }

  // POST /api/knowledge/reprocess - Reprocess a knowledge entry
  if (url === '/api/knowledge/reprocess' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const id = body.id;
      if (!id) return json(res, { ok: false, error: 'id required' }, 400);

      const knowledge = loadKnowledge();
      const article = knowledge.find(a => a.id === id || a._id === id || String(a.id) === String(id));
      if (!article) return json(res, { ok: false, error: 'Not found' }, 404);

      const llmConfig = body.llm_config || null;
      const sections = article.sections || [];

      // Regenerate QA cards for sections without them
      const sectionsToEnrich = sections.filter(s => !s.qa);
      if (sectionsToEnrich.length > 0 && llmConfig && llmConfig.api_key) {
        const result = await taskQueue.add('reprocess', { sections: sectionsToEnrich, llmConfig }, async (payload) => {
          const { sections, llmConfig } = payload;
          const resp = await fetch(llmConfig.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
            body: JSON.stringify({
              model: llmConfig.model || 'deepseek-chat',
              messages: [
                { role: 'system', content: 'Generate a QA knowledge card (question, answer, plain language explanation, analogy) for each given section. Output JSON array: [{ question, answer, plain, analogy }]' },
                { role: 'user', content: JSON.stringify(sections.map(s => ({ title: s.title, body: s.body }))) },
              ],
              max_tokens: 4096,
              temperature: 0.7,
              response_format: { type: 'json_object' },
            }),
          });
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || '{}';
          let cards;
          try { const p = JSON.parse(text); cards = p.cards || p; } catch { cards = []; }
          return { sections, cards };
        });
      }

      // Update status
      article.status = 'indexed';
      article.updatedAt = new Date().toISOString();
      saveKnowledge(knowledge);

      const ragCfg = loadRagConfig();
      await reindexAll(ragCfg);
      return json(res, { ok: true, article });
    })();
    return;
  }

  // GET /api/task-queue/status - Task queue monitoring
  if (url === '/api/task-queue/status' && method === 'GET') {
    return json(res, taskQueue.getStatus());
  }





  // POST /api/knowledge/upload-and-extract - Upload file + AI extract knowledge points
  if (url === '/api/knowledge/upload-and-extract' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      if (!body.file_base64) return json(res, { ok: false, error: 'file_base64 required' }, 400);
      const buffer = Buffer.from(body.file_base64, 'base64');
      const filename = body.filename || 'document';
      const parseResult = parseDocForRAG(buffer, filename);
      if (!parseResult.ok) return json(res, parseResult);

      const fullText = (parseResult.sections || []).map(s => s.title ? `# ${s.title}\n\n${s.body}` : s.body).join('\n\n');
      const llmConfig = body.llm_config || null;

      let knowledgePoints = [];
      if (llmConfig && llmConfig.api_key) {
        try {
          const prompt = `你是一个考证辅导专家，善长把专业概念用生活化的比喻讲清楚。
从用户上传的资料中提取知识点。
每个知识点：
- title: 简明标题
- content: 核心内容摘要（2-3句）
- importance: 重要程度1-5
- difficulty: 难度1-5
- tags: 2-4个关键词
- mnemonic: 一句话记忆口诀或生动比喻（优先用相亲/做饭/购物/物流场景）

输出 JSON: { "points": [{ "title": "...", "content": "...", "importance": 3, "difficulty": 2, "tags": [...], "mnemonic": "..." }] }`;

          const resp = await fetch(llmConfig.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
            body: JSON.stringify({
              model: llmConfig.model || 'deepseek-chat',
              messages: [{ role: 'system', content: prompt }, { role: 'user', content: fullText.substring(0, 8000) }],
              max_tokens: 8192, temperature: 0.7, response_format: { type: 'json_object' },
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const text = data.choices?.[0]?.message?.content || '{}';
            try { const p = JSON.parse(text); knowledgePoints = p.points || p; if (!Array.isArray(knowledgePoints)) knowledgePoints = [knowledgePoints]; } catch {}
          }
        } catch {}
      }

      knowledgePoints = knowledgePoints.map(p => ({
        id: crypto.randomUUID(),
        certType: body.certType || 'general',
        subject: body.subject || parseResult.title || '',
        title: p.title || '',
        content: p.content || '',
        importance: p.importance || 3,
        difficulty: p.difficulty || 3,
        tags: p.tags || [],
        mnemonic: p.mnemonic || '',
        sourceDocId: body._id || '',
        relatedIds: [],
        createdAt: new Date().toISOString(),
      }));

      const existing = readJSON(KNOWLEDGE_POINTS_FILE, []);
      existing.push(...knowledgePoints);
      writeJSON(KNOWLEDGE_POINTS_FILE, existing);

      const article = {
        _id: crypto.randomUUID(),
        title: parseResult.title || filename,
        subj: body.subj || 'custom',
        tags: body.tags || '\u6587\u6863',
        source: '\u6587\u4ef6\u4e0a\u4f20: ' + filename,
        sections: parseResult.sections || [],
        type: 'doc', status: 'indexed',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const knowledge = loadKnowledge();
      knowledge.push(article);
      saveKnowledge(knowledge);
      const ragCfg = loadRagConfig();
      reindexAll(ragCfg).catch(() => {});

      return json(res, { ok: true, points: knowledgePoints, title: article.title });
    })();
    return;
  }

  // GET /api/knowledge/points - Query knowledge points
  if (url === '/api/knowledge/points' && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const cert = urlObj.searchParams.get('cert') || '';
    const subj = urlObj.searchParams.get('subj') || '';
    const limit = parseInt(urlObj.searchParams.get('limit') || '50');
    const offset = parseInt(urlObj.searchParams.get('offset') || '0');
    let points = readJSON(KNOWLEDGE_POINTS_FILE, []);
    if (cert) points = points.filter(p => p.certType === cert);
    if (subj) points = points.filter(p => p.subject === subj);
    const total = points.length;
    points = points.slice(offset, offset + limit);
    return json(res, { ok: true, items: points, total });
  }

  // POST /api/questions/generate - Generate questions from knowledge points
  if (url === '/api/questions/generate' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const certType = body.certType || 'general';
      const pointIds = body.pointIds || [];
      const count = body.count || 5;
      const llmConfig = body.llm_config || {};
      if (!llmConfig.api_key) return json(res, { ok: false, questions: [], error: 'LLM not configured' });

      let points = readJSON(KNOWLEDGE_POINTS_FILE, []);
      if (pointIds.length > 0) points = points.filter(p => pointIds.includes(p.id));
      else if (certType !== 'general') points = points.filter(p => p.certType === certType);

      if (points.length === 0) return json(res, { ok: false, questions: [], error: 'No knowledge points found' });

      const selectedPoints = points.slice(0, Math.min(count, points.length));
      const prompt = `你是一个出题专家，善长把专业知识融入到生活场景中出题。
基于以下知识点生成考试题目。

要求：
- 题目场景化：把知识点放到相亲/做饭/购物/物流/职场场景中
- 语气轻松，像朋友聊天
- 每个题目附带记忆口诀或趣味提示
- 题型混合：单选/判断/填空/简答

输出JSON：{ "questions": [{ "type": "single_choice|true_false|fill_in|short_answer", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A", "explanation": "...\n记忆口诀: ..." }] }`;

      const pointsText = selectedPoints.map(p => `[${p.title}]\nContent: ${p.content}\nDifficulty: ${p.difficulty}\nTags: ${(p.tags || []).join(', ')}`).join('\n\n---\n\n');

      try {
        const resp = await fetch(llmConfig.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
          body: JSON.stringify({
            model: llmConfig.model || 'deepseek-chat',
            messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Generate ${count} questions from:\n\n${pointsText}` }],
            max_tokens: 4096, temperature: 0.7, response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        let questions = [];
        try { const p = JSON.parse(text); questions = p.questions || p; if (!Array.isArray(questions)) questions = [questions]; } catch {}

        questions = questions.slice(0, count).map((q, i) => ({
          id: crypto.randomUUID(),
          knowledgePointId: selectedPoints[i % selectedPoints.length]?.id || '',
          certType,
          type: q.type || 'single_choice',
          difficulty: selectedPoints[i % selectedPoints.length]?.difficulty || 3,
          question: q.question || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || '',
          mnemonic: '',
          source: 'auto-generated',
          createdAt: new Date().toISOString(),
        }));

        const existing = readJSON(QUESTIONS_FILE, []);
        existing.push(...questions);
        writeJSON(QUESTIONS_FILE, existing);

        return json(res, { ok: true, questions });
      } catch (err) {
        return json(res, { ok: false, questions: [], error: err.message });
      }
    })();
    return;
  }

  // GET /api/questions/bank - Query question bank
  if (url === '/api/questions/bank' && method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const cert = urlObj.searchParams.get('cert') || '';
    const limit = parseInt(urlObj.searchParams.get('limit') || '50');
    const offset = parseInt(urlObj.searchParams.get('offset') || '0');
    let questions = readJSON(QUESTIONS_FILE, []);
    if (cert) questions = questions.filter(q => q.certType === cert);
    const total = questions.length;
    questions = questions.slice(offset, offset + limit);
    return json(res, { ok: true, items: questions, total });
  }

  // POST /api/review/submit - SM-2 review submission
  if (url === '/api/review/submit' && method === 'POST') {
    (async () => {
      const body = await parseBody(req);
      const { questionId, quality } = body;
      if (!questionId || quality === undefined) return json(res, { ok: false, error: 'questionId and quality required' }, 400);
      // Store review result in knowledge_points or questions - use a simple reviews file
      return json(res, { ok: true, schedule: sm2Schedule(quality, body.ease || 2.5, body.interval || 0, body.reps || 0) });
    })();
    return;
  }

  // ---- 404 ---- //
  // Root URL — return friendly info for browser access
  if (url === '/') {
    return json(res, {
      service: 'kye-test API Server',
      version: 2,
      endpoints: {
        sync: '/api/sync',
        register: '/api/register',
        knowledge: '/api/knowledge',
        rag_query: '/api/rag/query',
        rag_status: '/api/rag/status',
        rag_reindex: '/api/rag/reindex',
      },
      frontend: 'http://localhost:5173',
    });
  }

  json(res, { error: 'Not found' }, 404);
}).listen(PORT, '0.0.0.0', async () => {
  initCompilerDB();

  console.log(`\n📚 kye-test服务器 v2 (unified)`);
  console.log(`   Sync API + RAG → http://0.0.0.0:${PORT}/`);
  console.log(`   Tailscale: http://100.101.115.91:${PORT}/`);

  // Seed + reindex on startup
  const ragCfg = loadRagConfig();
  console.log(`   RAG status: ${ragCfg.status || 'unconfigured'}`);
  console.log(`   Knowledge: ${loadKnowledge().length} articles`);

  // Auto-seed built-in content if empty
  seedBuiltinContent().catch(e => console.error('Seed error:', e));
});
