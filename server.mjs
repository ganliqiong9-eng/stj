import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ============================================================
// Configuration
// ============================================================
const PORT = 8086;
const BASE = path.dirname(new URL(import.meta.url).pathname);
const DATA_FILE = path.join(BASE, 'data.json');
const KNOWLEDGE_FILE = path.join(BASE, 'knowledge.json');
const EMBEDDINGS_FILE = path.join(BASE, 'embeddings.json');
const RAG_CONFIG_FILE = path.join(BASE, 'rag_config.json');

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
    const res = await fetch(config.embedding_endpoint, {
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
    if (!res.ok) return null;
    const data = await res.json();
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
      const res = await fetch(llmConfig.endpoint, {
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
      const data = await res.json();
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

  // ---- 404 ---- //
  // Root URL — return friendly info for browser access
  if (url === '/') {
    return json(res, {
      service: '学习伴侣 API Server',
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
  console.log(`\n📚 学习伴侣服务器 v2 (unified)`);
  console.log(`   Sync API + RAG → http://0.0.0.0:${PORT}/`);
  console.log(`   Tailscale: http://100.101.115.91:${PORT}/`);

  // Seed + reindex on startup
  const ragCfg = loadRagConfig();
  console.log(`   RAG status: ${ragCfg.status || 'unconfigured'}`);
  console.log(`   Knowledge: ${loadKnowledge().length} articles`);

  // Auto-seed built-in content if empty
  seedBuiltinContent().catch(e => console.error('Seed error:', e));
});
