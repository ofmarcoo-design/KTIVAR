const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

test('public QR route resolves current destination and handles unavailable plates', async (t) => {
  let rows = [{ code: 'PL-000143', active: true, destinationUrl: 'https://example.com/first' }];
  let databaseStatus = 200;
  let lookupCount = 0;
  const database = http.createServer((req, res) => {
    lookupCount++;
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.pathname, '/rest/v1/plates');
    assert.equal(url.searchParams.get('code'), 'eq.PL-000143');
    assert.equal(url.searchParams.get('select'), 'code,active,destinationUrl');
    assert.equal(req.headers.apikey, 'sb_publishable_test');
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(databaseStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
  });
  await new Promise(resolve => database.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => database.close(resolve)));

  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '0',
      SUPABASE_URL: `http://127.0.0.1:${database.address().port}`,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    const exited = once(app, 'exit');
    app.kill();
    await exited;
  });
  // Discover the ephemeral port without changing the production server exports.
  const output = await new Promise((resolve, reject) => {
    app.stdout.once('data', chunk => resolve(chunk.toString()));
    app.once('error', reject);
    app.once('exit', code => reject(new Error(`Server exited: ${code}`)));
  });
  const port = output.match(/port (\d+)/)[1];
  const base = `http://127.0.0.1:${port}`;
  const request = () => fetch(`${base}/r/PL-000143`, { redirect: 'manual' });

  let response = await request();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://example.com/first');
  assert.equal(response.headers.get('cache-control'), 'no-store');

  rows[0].destinationUrl = 'https://example.org/current?review=1';
  response = await request();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), rows[0].destinationUrl);
  assert.equal(rows[0].code, 'PL-000143');

  rows[0].active = false;
  response = await request();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('location'), null);

  rows = [];
  assert.equal((await request()).status, 404);
  const countBefore = lookupCount;
  assert.equal((await fetch(`${base}/r/invalid`)).status, 404);
  assert.equal(lookupCount, countBefore);

  rows = [{ active: true, destinationUrl: 'javascript:alert(1)' }];
  assert.equal((await request()).status, 503);
  rows[0].destinationUrl = 'invalid';
  assert.equal((await request()).status, 503);
  databaseStatus = 500;
  assert.equal((await request()).status, 503);

  assert.equal((await fetch(base, { redirect: 'manual' })).headers.get('location'), '/plates');
  assert.equal((await fetch(`${base}/health`)).status, 200);
});
