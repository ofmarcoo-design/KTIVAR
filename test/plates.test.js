const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { registerPlates, validatePlate, validateDestination } = require('../modules/plates');

test('plate input rejects invalid dates and missing links, preserves optional fields', () => {
  const values = { clientId: '00000000-0000-4000-8000-000000000001', productId: '', status: 'pending', purpose: 'pix', destinationUrl: ' https://example.com ', deliveredAt: '', nfcIdentifier: '', installationLocation: '' };
  const normalized = validatePlate(values);
  assert.equal(normalized.productId, null);
  assert.equal(normalized.deliveredAt, null);
  assert.equal(normalized.nfcIdentifier, null);
  assert.equal(normalized.destinationUrl, 'https://example.com');
  for (const changes of [{clientId:''},{status:'unknown'},{purpose:'unknown'},{destinationUrl:'javascript:alert(1)'},{deliveredAt:'2026-02-30'},{deliveredAt:'2026-99-01'}]) assert.throws(() => validatePlate({...values,...changes}));
  assert.equal(validatePlate({...values,deliveredAt:'2024-02-29'}).deliveredAt,'2024-02-29');
  for(const url of ['https://plates.test/r/PL-000143','https://plates.test/R/PL-000143','https://plates.test/r/%50%4C-000143'])assert.throws(()=>validateDestination(url,'plates.test'));
  assert.equal(validateDestination('https://another.test/r/PL-000143','plates.test'),'https://another.test/r/PL-000143');
});

test('login requires allowlisted user, renews session, and protects APIs and screen', async t => {
  let allowed = true, portalAllowed=false;
  const plate = { code: 'PL-000143', destinationUrl: 'https://destination.invalid/first' };
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
    if(url.pathname === '/rest/v1/client_portal_access') return res.end(JSON.stringify(portalAllowed?[{userId:user.id}]:[]));
    if(url.pathname === '/rest/v1/rpc/client_portal_snapshot') return res.end(JSON.stringify({name:'Own client',plates:[]}));
    if(url.pathname === '/rest/v1/plate_access') return res.end(JSON.stringify(allowed?[{userId:user.id}]:[]));
    if(url.pathname === '/rest/v1/plates') {
      const code = url.searchParams.get('code');
      return res.end(JSON.stringify(!code || code === `eq.${plate.code}` ? [plate] : []));
    }
    if(url.pathname === '/auth/v1/logout') {res.statusCode=204;return res.end();}
    if(url.pathname === '/rest/v1/rpc/save_deal') {res.statusCode=409;return res.end(JSON.stringify({code:'PT409',message:'Opportunity changed'}));}
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
  const request=(route,{method='GET',body,cookie='',origin=base,host}={})=>{
    const headers={Origin:origin,'Content-Type':'application/json',Cookie:cookie,...(host ? { Host: host } : {})};
    if (!host) return fetch(base+route,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
    // Use HTTP directly: fetch normalizes Host to the connection URL in some Node versions.
    return new Promise((resolve,reject)=>{
      const outgoing=http.request(base+route,{method,headers},incoming=>{
        const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('end',()=>{
          const responseHeaders=new Headers();
          for(const [name,value] of Object.entries(incoming.headers)) for(const item of Array.isArray(value)?value:[value]) if(item!==undefined) responseHeaders.append(name,item);
          resolve(new Response(Buffer.concat(chunks),{status:incoming.statusCode,headers:responseHeaders}));
        });
      });outgoing.on('error',reject);if(body)outgoing.write(JSON.stringify(body));outgoing.end();
    });
  };
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
  const staleDeal=await request(`/api/workspace/deals/${user.id}`,{method:'PATCH',cookie,body:{clientId:user.id,name:'Deal',stageId:user.id,result:'open',revision:0,tags:[]}});
  assert.equal(staleDeal.status,409);
  assert.match((await staleDeal.json()).error,/Reabra/);
  const host = 'plates.example.test';
  const permanent = `https://${host}/r/PL-000143`;
  const detail = await (await request('/api/plates/PL-000143', {cookie,host})).json();
  assert.equal(detail.permanentUrl, permanent);
  const qrResponse = await request('/api/plates/PL-000143/qr.svg', {cookie,host});
  assert.equal(qrResponse.status, 200);
  assert.match(qrResponse.headers.get('content-type'), /^image\/svg\+xml/);
  assert.equal(qrResponse.headers.get('cache-control'), 'no-store');
  const svg = await qrResponse.text();
  const expected = await require('qrcode').toString(permanent, {type:'svg',errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}});
  assert.equal(svg, expected);
  assert.notEqual(svg, await require('qrcode').toString(plate.destinationUrl, {type:'svg',errorCorrectionLevel:'M',margin:4}));
  plate.destinationUrl = 'https://destination.invalid/changed';
  assert.equal(await (await request('/api/plates/PL-000143/qr.svg', {cookie,host})).text(), svg);
  const anotherHost = await request('/api/plates/PL-000143', {cookie,host:'another.example.test'});
  assert.equal((await anotherHost.json()).permanentUrl, 'https://another.example.test/r/PL-000143');
  const oldOrigin=process.env.PUBLIC_ORIGIN;
  try {
    process.env.PUBLIC_ORIGIN='https://canonical.example.test';
    assert.equal((await(await request('/api/plates/PL-000143',{cookie,host})).json()).permanentUrl,'https://canonical.example.test/r/PL-000143');
    process.env.PUBLIC_ORIGIN='https://canonical.example.test/path';
    assert.equal((await request('/api/plates/PL-000143',{cookie,host})).status,503);
  } finally {if(oldOrigin===undefined)delete process.env.PUBLIC_ORIGIN;else process.env.PUBLIC_ORIGIN=oldOrigin;}
  const download = await request('/api/plates/PL-000143/qr.svg?download=1', {cookie,host});
  assert.match(download.headers.get('content-disposition'), /attachment; filename="PL-000143.svg"/);
  assert.equal(await download.text(), svg);
  assert.equal((await request('/api/plates/PL-000143/qr.svg')).status, 401);
  assert.equal((await request('/api/plates/invalid/qr.svg', {cookie})).status, 404);
  assert.equal((await request('/api/plates/PL-999999/qr.svg', {cookie})).status, 404);
  if (process.env.QR_VERIFY_SVG) require('node:fs').writeFileSync(process.env.QR_VERIFY_SVG, svg);
  response=await request('/api/session',{cookie:'ktivar_refresh=refresh'});
  assert.equal(response.status,200);
  assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('ktivar_access=')));
  assert.equal((await request('/api/plates',{cookie:'ktivar_access=fake'})).status,401);
  assert.equal((await request('/api/plates',{method:'POST',cookie,origin:'https://other.invalid',body:{}})).status,403);
  allowed=false;
  assert.equal((await request('/api/plates',{cookie})).status,403);
  assert.equal((await request('/api/plates/PL-000143/qr.svg',{cookie})).status,403);
  assert.equal((await request('/api/login',{method:'POST',body:{email:user.email,password:'good'}})).status,403);
  portalAllowed=true;
  response=await request('/api/login',{method:'POST',body:{email:user.email,password:'good'}});assert.equal(response.status,200);assert.equal((await response.json()).redirect,'/portal');
  assert.equal((await request('/portal',{cookie})).status,200);
  assert.equal((await request('/api/portal?clientId=OTHER',{cookie})).status,200);
  assert.equal((await request('/api/workspace/clients',{cookie})).status,403);
  assert.equal((await request('/api/plates',{method:'POST',cookie,body:{}})).status,403);
  assert.equal((await request('/api/settings',{cookie})).status,403);
  assert.equal((await request('/api/portal/logout',{method:'POST',cookie,body:{}})).status,200);
  portalAllowed=false;assert.equal((await request('/api/portal',{cookie})).status,403);
  allowed=true;
  response=await request('/api/logout',{method:'POST',cookie,body:{}});
  assert.equal(response.status,200);
  assert.ok(response.headers.getSetCookie().every(value=>value.includes('Expires=Thu, 01 Jan 1970')));
});
