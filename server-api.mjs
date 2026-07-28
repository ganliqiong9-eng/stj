import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_FILE = path.join('/Users/albee/Documents/stj', 'data.json');
const KNOWLEDGE_FILE = path.join('/Users/albee/Documents/stj', 'knowledge.json');
const PORT = 8086;

// Load or create data file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {}
  return { devices: {}, progress: {}, stars: {}, notes: [] };
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadKnowledge() {
  try {
    if (fs.existsSync(KNOWLEDGE_FILE)) return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
  } catch {}
  return [];
}
function saveKnowledge(data) {
  fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2));
}

// Get or create device ID from token
function getDeviceId(headers) {
  const token = headers['x-device-token'];
  if (!token) return null;
  const data = loadData();
  if (!data.devices[token]) {
    data.devices[token] = { name: headers['x-device-name'] || 'unknown', lastSeen: new Date().toISOString() };
    saveData(data);
  }
  return token;
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(JSON.stringify(data));
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end();
    return;
  }

  // POST /api/register - Register this device
  if (url === '/api/register' && method === 'POST') {
    const body = await parseBody(req);
    const token = crypto.randomUUID();
    const data = loadData();
    data.devices[token] = { name: body.name || 'unknown', lastSeen: new Date().toISOString() };
    saveData(data);
    return json(res, { token, message: 'Device registered' });
  }

  const deviceId = getDeviceId(req.headers);
  if (!deviceId) return json(res, { error: 'Missing x-device-token header' }, 401);

  // POST /api/sync - Sync all data (client sends complete state)
  if (url === '/api/sync' && method === 'POST') {
    const body = await parseBody(req);
    const data = loadData();
    // Update progress
    if (body.progress) {
      Object.entries(body.progress).forEach(([k, v]) => {
        if (!data.progress[k]) data.progress[k] = {};
        data.progress[k][deviceId] = v;
      });
    }
    // Update stars
    if (body.stars) {
      Object.entries(body.stars).forEach(([k, v]) => {
        if (!data.stars[k]) data.stars[k] = {};
        data.stars[k][deviceId] = v;
      });
    }
    // Update notes (append new ones)
    if (body.notes) {
      const existingIds = new Set(data.notes.map(n => n._id));
      body.notes.forEach(n => {
        if (!n._id) n._id = crypto.randomUUID();
        if (!existingIds.has(n._id)) {
          n._device = deviceId;
          n._createdAt = new Date().toISOString();
          data.notes.push(n);
          existingIds.add(n._id);
        }
      });
    }
    // Update knowledge (append new ones from this device)
    if (body.knowledge) {
      const knowledge = loadKnowledge();
      const existingIds = new Set(knowledge.map(k => k._id));
      body.knowledge.forEach(k => {
        if (!k._id) k._id = crypto.randomUUID();
        if (!existingIds.has(k._id)) {
          k._device = deviceId;
          k._serverCreatedAt = new Date().toISOString();
          knowledge.push(k);
          existingIds.add(k._id);
        }
      });
      saveKnowledge(knowledge);
    }
    data.devices[deviceId].lastSeen = new Date().toISOString();
    saveData(data);
    return json(res, { ok: true });
  }

  // GET /api/sync - Download all data
  if (url === '/api/sync' && method === 'GET') {
    const data = loadData();
    // Merge progress across devices (latest wins)
    const mergedProgress = {};
    Object.entries(data.progress).forEach(([ch, devs]) => {
      Object.values(devs).forEach(v => { mergedProgress[ch] = v; });
    });
    // Merge stars across devices
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

  json(res, { error: 'Not found' }, 404);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}/`);
  console.log(`Tailscale IP: http://100.101.115.91:${PORT}/`);
});
