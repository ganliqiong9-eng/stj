// 生产前端静态服务器：HTML 禁止缓存，哈希资源永久缓存，缺失资源返回 404
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), 'dist');
const PORT = Number(process.env.PORT || 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const file = path.normalize(path.join(root, decoded));
  if (!file.startsWith(root + path.sep) && file !== root) return null;
  return file;
}

http.createServer((req, res) => {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const urlPath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
    let filePath = safeJoin(ROOT, urlPath);
    if (!filePath) return notFound(res);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // 只有浏览器导航请求才回退到 index.html；资源请求一律 404
      const isNav = (req.headers.accept || '').includes('text/html');
      const isAsset = /^\/(assets|icons)\//.test(urlPath) || /\.[a-z0-9]+$/i.test(urlPath);
      if (isNav && !isAsset) filePath = path.join(ROOT, 'index.html');
      else return notFound(res);
    }

    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html' || filePath.endsWith('index.html');
    const isHashedAsset = urlPath.startsWith('/assets/') && /\.[a-z0-9]+$/i.test(urlPath);
    const data = fs.readFileSync(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (isHtml) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (isHashedAsset) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.writeHead(200);
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end('server error');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`STJ static server on http://0.0.0.0:${PORT}/ (dist)`);
});

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end('Not Found');
}
