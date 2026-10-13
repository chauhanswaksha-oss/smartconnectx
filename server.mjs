import http from 'node:http';
import { realpath, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const inside = (root, file) => file === root || file.startsWith(root + path.sep);

export async function createStaticServer({
  directory = path.join(projectDirectory, 'dist'), host = '127.0.0.1', port = 3000,
} = {}) {
  const root = await realpath(directory);
  if (!(await stat(path.join(root, 'index.html'))).isFile()) throw new Error('Build the website first: npm run build');
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const respond = (status, text) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : text);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD'); respond(405, 'Method not allowed'); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/healthz') {
        const body = JSON.stringify({ status: 'ok', app: 'SmartConnectX' });
        response.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      if (pathname.includes('\0') || pathname.includes('\\')) { respond(400, 'Invalid path'); return; }
      const candidate = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!inside(root, candidate)) { respond(403, 'Forbidden'); return; }
      const file = await realpath(candidate);
      if (!inside(root, file)) { respond(403, 'Forbidden'); return; }
      if (!(await stat(file)).isFile()) { respond(404, 'Not found'); return; }
      const content = await readFile(file);
      response.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': content.length,
        'Cache-Control': path.extname(file) === '.html' ? 'no-store' : 'public, max-age=3600',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error instanceof URIError || error.code === 'ERR_INVALID_URL') respond(400, 'Invalid path');
      else if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) respond(404, 'Not found');
      else respond(500, 'Server error');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  return server;
}
export function runtimeOptions() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  return { port, host: process.env.HOST || '127.0.0.1' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = runtimeOptions();
    const server = await createStaticServer(options);
    console.log(`SmartConnectX is running at http://${options.host}:${options.port}`);
    console.log('Keep this terminal open. Press Ctrl+C to stop.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(); server.closeIdleConnections();
    });
  } catch (error) {
    console.error(error.code === 'ENOENT' ? 'The built site is missing. Run npm run build first.' : error.message);
    process.exitCode = 1;
  }
}
