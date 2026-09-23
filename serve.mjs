// 本地静态服务器：让同一 Wi-Fi 下的 iPhone 直接打开这个 App。
// 用法：node serve.mjs   （可用 PORT=8080 node serve.mjs 改端口）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = new URL('./', import.meta.url);
const PORT = Number(process.env.PORT || 5178);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const target = new URL('.' + normalize(path), ROOT);
    if (!target.href.startsWith(ROOT.href)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[extname(target.pathname)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`电脑： http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`手机： http://${ip}:${PORT}/   （同一 Wi-Fi）`);
});
