import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticServer } from '../server.mjs';

const html = '<!doctype html><title>SmartConnectX</title><script src="/assets/app.js"></script>';
const privateContent = 'private-file-must-never-be-served';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'smartconnectx-server-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dist = join(directory, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await Promise.all([
    writeFile(join(dist, 'index.html'), html),
    writeFile(join(dist, 'assets', 'app.js'), 'console.log("SmartConnectX");'),
    writeFile(join(dist, 'assets', 'style.css'), 'body { color: lime; }'),
    writeFile(join(dist, 'assets', 'name with spaces.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    writeFile(join(directory, 'private.txt'), privateContent),
  ]);
  const server = await createStaticServer({ directory: dist, host: '127.0.0.1', port: 0 });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { directory, dist, port: address.port };
}

// Node's raw HTTP path preserves traversal attempts that URL/fetch would normalize.
function get(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the portfolio and its browser assets with appropriate content types', async t => {
  const { port } = await fixture(t);
  for (const path of ['/', '/index.html', '/?source=qr']) {
    const response = await get(port, path);
    assert.equal(response.status, 200, path);
    assert.equal(response.body, html);
    assert.match(response.headers['content-type'], /^text\/html\b/);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  }
  for (const [path, mime, content] of [
    ['/assets/app.js?v=1', /^(?:text|application)\/javascript\b/, 'console.log("SmartConnectX");'],
    ['/assets/style.css', /^text\/css\b/, 'body { color: lime; }'],
    ['/assets/name%20with%20spaces.svg', /^image\/svg\+xml\b/, '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
  ]) {
    const response = await get(port, path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers['content-type'], mime);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.body, content);
  }
});

test('HEAD exposes response metadata without sending the portfolio body', async t => {
  const { port } = await fixture(t);
  const response = await get(port, '/', 'HEAD');
  assert.equal(response.status, 200);
  assert.equal(response.body, '');
  assert.match(response.headers['content-type'], /^text\/html\b/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(Number(response.headers['content-length']), Buffer.byteLength(html));
});

test('health endpoint is reachable while missing assets and unsupported methods are explicit', async t => {
  const { port } = await fixture(t);
  const health = await get(port, '/healthz');
  assert.equal(health.status, 200);
  const missing = await get(port, '/assets/missing.js');
  assert.equal(missing.status, 404);
  assert.notEqual(missing.body, html);
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await get(port, '/', method);
    assert.equal(response.status, 405, method);
    assert.match(response.headers.allow, /GET/);
    assert.match(response.headers.allow, /HEAD/);
  }
});

test('malformed and traversal requests cannot expose files outside the build', async t => {
  const { port } = await fixture(t);
  for (const path of [
    '/../private.txt',
    '/%2e%2e/private.txt',
    '/assets/%2e%2e/%2e%2e/private.txt',
    '/..%2fprivate.txt',
    '/%2e%2e%5cprivate.txt',
    '/%00private.txt',
    '/%not-hex',
  ]) {
    const response = await get(port, path);
    assert.ok([400, 403, 404].includes(response.status), `${path}: ${response.status}`);
    assert.equal(response.body.includes(privateContent), false, path);
  }
});

test('a symlink in the build cannot expose an external file or directory', async t => {
  const { directory, dist, port } = await fixture(t);
  try {
    await symlink(join(directory, 'private.txt'), join(dist, 'secret.txt'));
    await symlink(directory, join(dist, 'outside'), 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) {
      t.skip(`Symlinks are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  for (const path of ['/secret.txt', '/outside/private.txt']) {
    const response = await get(port, path);
    assert.ok([403, 404].includes(response.status), `${path}: ${response.status}`);
    assert.equal(response.body.includes(privateContent), false);
  }
});
