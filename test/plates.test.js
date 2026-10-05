const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { registerPlates, validatePlate } = require('../modules/plates');

test('plate input rejects invalid dates and missing links, preserves optional fields', () => {
  const values = { clientId: '00000000-0000-4000-8000-000000000001', productId: '', status: 'pending', purpose: 'pix', destinationUrl: ' https://example.com ', deliveredAt: '', nfcIdentifier: '', installationLocation: '' };
  const normalized = validatePlate(values);
  assert.equal(normalized.productId, null);
  assert.equal(normalized.deliveredAt, null);
  assert.equal(normalized.nfcIdentifier, null);
  assert.equal(normalized.destinationUrl, 'https://example.com');
  for (const changes of [{clientId:''},{status:'unknown'},{purpose:'unknown'},{destinationUrl:'javascript:alert(1)'},{deliveredAt:'2026-02-30'},{deliveredAt:'2026-99-01'}]) assert.throws(() => validatePlate({...values,...changes}));
  assert.equal(validatePlate({...values,deliveredAt:'2024-02-29'}).deliveredAt,'2024-02-29');
});

test('login requires allowlisted user, renews session, and protects APIs and screen', async t => {
  let allowed = true;
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' };
  const database = http.createServer(async (req,res) => {
    const url = new URL(req.url,'http://localhost');
    res.setHeader('Content-Type','application/json');
    if (url.pathname === '/auth/v1/token') {
      let text=''; for await (const chunk of req) text+=chunk;
      const body=JSON.parse(text);
      if (body.password === 'bad') {res.statusCode=400;return res.end('{}');}
      if (body.refresh_token && body.refresh_token !== 'refresh') {res.statusCode=400;return res.end('{}');}
      return res.end(JSON.stringify({access_token:'valid',refresh_token:'refresh',expires_in:3600,user}));
    }
    if(url.pathname === '/auth/v1/user') {
      if(req.headers.authorization !== 'Bearer valid') {res.statusCode=403;return res.end('{}');}
      return res.end(JSON.stringify(user));
    }
    if(url.pathname === '/rest/v1/plate_access') return res.end(JSON.stringify(allowed?[{userId:user.id}]:[]));
    if(url.pathname === '/auth/v1/logout') {res.statusCode=204;return res.end();}
    res.end('[]');
  });
  await new Promise(resolve=>database.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>database.close(resolve)));
  const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
  process.env.SUPABASE_URL=`http://127.0.0.1:${database.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  t.after(()=>{for(const [name,value] of [['SUPABASE_URL',previous.url],['SUPABASE_PUBLISHABLE_KEY',previous.key]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
  const app=express();app.use(express.json());registerPlates(app);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(route,{method='GET',body,cookie='',origin=base}={})=>fetch(base+route,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,redirect:'manual'});
  assert.equal((await request('/api/plates')).status,401);
  assert.equal((await request('/plates')).headers.get('location'),'/login');
  assert.equal((await request('/api/login',{method:'POST',body:{email:user.email,password:'bad'}})).status,401);
  let response=await request('/api/login',{method:'POST',body:{email:user.email,password:'good'}});
  assert.equal(response.status,200);
  const saved=response.headers.getSetCookie();
  assert.ok(saved.every(value=>value.includes('HttpOnly')&&value.includes('SameSite=Lax')));
  const cookie=saved.map(value=>value.split(';')[0]).join('; ');
  assert.equal((await request('/plates',{cookie})).status,200);
  assert.equal((await request('/api/plates',{cookie})).status,200);
  response=await request('/api/session',{cookie:'ktivar_refresh=refresh'});
  assert.equal(response.status,200);
  assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('ktivar_access=')));
  assert.equal((await request('/api/plates',{cookie:'ktivar_access=fake'})).status,401);
  assert.equal((await request('/api/plates',{method:'POST',cookie,origin:'https://other.invalid',body:{}})).status,403);
  allowed=false;
  assert.equal((await request('/api/plates',{cookie})).status,403);
  assert.equal((await request('/api/login',{method:'POST',body:{email:user.email,password:'good'}})).status,403);
  allowed=true;
  response=await request('/api/logout',{method:'POST',cookie,body:{}});
  assert.equal(response.status,200);
  assert.ok(response.headers.getSetCookie().every(value=>value.includes('Expires=Thu, 01 Jan 1970')));
});
