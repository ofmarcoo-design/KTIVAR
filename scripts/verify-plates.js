// Opt-in integration test against the configured real Supabase. No credentials in source.
// Run: node --env-file=.env.verify scripts/verify-plates.js
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3107';
const created = { clients: [], products: [], plates: [] };
let cookie = '';
async function request(route, method = 'GET', body, anonymous = false) {
  const headers = { Origin: base, 'Content-Type': 'application/json' };
  if (!anonymous && cookie) headers.Cookie = cookie;
  const response = await fetch(base + route, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const saved = response.headers.getSetCookie();
  if (saved.length) cookie = saved.map(value => value.split(';')[0]).join('; ');
  const data = await response.json().catch(() => null);
  return { response, data };
}
(async () => {
  const child = process.env.TEST_BASE_URL ? null : spawn(process.execPath, ['server.js'], { env: process.env, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    if (child) await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
    assert.equal((await request('/api/plates', 'GET', null, true)).response.status, 401);
    assert.equal((await request('/plates', 'GET', null, true)).response.headers.get('location'), '/login');
    assert.equal((await request('/api/login', 'POST', { email: process.env.TEST_EMAIL, password: 'wrong-password' })).response.status, 401);
    const login = await request('/api/login', 'POST', { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD });
    assert.equal(login.response.status, 200, JSON.stringify(login.data));
    assert.ok(login.response.headers.getSetCookie().every(value => value.includes('HttpOnly') && value.includes('SameSite=Lax')));
    assert.equal((await request('/plates')).response.status, 200);
    cookie = cookie.split('; ').filter(value => value.startsWith('ktivar_refresh=')).join('; ');
    assert.equal((await request('/api/session')).response.status, 200);
    assert.ok(cookie.includes('ktivar_access='));
    const client = await request('/api/clients', 'POST', { name: 'KTIVAR integration test', company: 'temporary', phone: '000' });
    assert.equal(client.response.status, 201); created.clients.push(client.data.id);
    const product = await request('/api/products', 'POST', { name: 'KTIVAR integration test' });
    assert.equal(product.response.status, 201); created.products.push(product.data.id);
    const values = { clientId: client.data.id, productId: product.data.id, status: 'pending', purpose: 'google_review', installationLocation: 'Balcão teste', destinationUrl: 'https://example.com/test', nfcIdentifier: `test-${Date.now()}`, deliveredAt: '2026-10-05' };
    let plate = await request('/api/plates', 'POST', values);
    assert.equal(plate.response.status, 201, JSON.stringify(plate.data)); created.plates.push(plate.data.code);
    assert.match(plate.data.code, /^PL-\d{6}$/);
    const firstCode = plate.data.code;
    const second = await request('/api/plates', 'POST', { ...values, productId: '', nfcIdentifier: '', deliveredAt: '' });
    assert.equal(second.response.status, 201); created.plates.push(second.data.code);
    assert.notEqual(second.data.code, firstCode);
    const before = await request(`/api/plates/${firstCode}`);
    assert.equal(before.data.client.id, client.data.id);
    assert.equal(before.data.product.id, product.data.id);
    assert.equal(before.data.deliveredAt, values.deliveredAt);
    const changed = { ...values, productId: '', status: 'active', destinationUrl: 'https://example.org/current', installationLocation: 'Entrada' };
    assert.equal((await request(`/api/plates/${firstCode}`, 'PATCH', changed)).response.status, 200);
    const after = await request(`/api/plates/${firstCode}`);
    assert.equal(after.data.code, firstCode);
    assert.equal(after.data.destinationUrl, changed.destinationUrl);
    assert.equal(after.data.productId, null);
    assert.equal(after.data.status, 'active');
    assert.equal(after.data.createdAt, before.data.createdAt);
    assert.ok(new Date(after.data.updatedAt) > new Date(before.data.updatedAt));
    const list = await request(`/api/plates?search=${firstCode}`);
    assert.ok(list.data.items.some(item => item.code === firstCode));
    assert.equal((await request('/api/plates', 'POST', { ...values, clientId: '' })).response.status, 400);
    assert.equal((await request('/api/plates', 'POST', { ...values, deliveredAt: '2026-02-30' })).response.status, 400);
    assert.equal((await request('/api/plates', 'POST', { ...values, destinationUrl: 'javascript:alert(1)' })).response.status, 400);
    assert.equal((await request('/api/plates', 'POST', values)).response.status, 409);
    const csrf = await fetch(base + `/api/plates/${firstCode}`, { method: 'PATCH', headers: { Cookie: cookie, Origin: 'https://other.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(changed) });
    assert.equal(csrf.status, 403);
    const badToken = await fetch(base + '/api/plates', { headers: { Cookie: 'ktivar_access=fake' } });
    assert.equal(badToken.status, 401);
    assert.equal((await request('/api/logout', 'POST', {})).response.status, 200);
    assert.equal((await request('/api/plates')).response.status, 401);
    console.log('PASS: real login, private screen, client/product creation, multiple plates, save, reload, edit, list, optional fields, validation, CSRF, logout.');
  } finally {
    child?.kill();
    console.log('CLEANUP_IDS ' + JSON.stringify(created));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
