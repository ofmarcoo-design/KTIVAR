const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const path=require('node:path');

test('public health fails closed, supports current keys, and rejects malformed requests safely',async t=>{
 let healthRows=[{status:'online',checked_at:'2000-01-01T00:00:00Z'}],databaseStatus=200;
 const db=http.createServer((req,res)=>{
  assert.equal(req.headers.apikey,'sb_publishable_test');assert.equal(req.headers.authorization,undefined);
  assert.equal(new URL(req.url,'http://localhost').pathname,'/rest/v1/health_check');
  res.writeHead(databaseStatus,{'Content-Type':'application/json'});res.end(JSON.stringify(healthRows));
 });
 await new Promise(resolve=>db.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>db.close(resolve)));
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'0',SUPABASE_URL:`http://127.0.0.1:${db.address().port}`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{const stopped=once(child,'exit');child.kill();await stopped;});
 const started=await new Promise((resolve,reject)=>{child.stdout.once('data',data=>resolve(data.toString()));child.once('error',reject);child.once('exit',code=>reject(Error(`Server stopped: ${code}`)));});
 const base='http://127.0.0.1:'+started.match(/port (\d+)/)[1];
 const response=await fetch(base+'/health/database');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();assert.equal(data.database,'online');assert.ok(Date.now()-Date.parse(data.checked_at)<10000);
 for(const rows of [[],null,[{}],[{status:'offline'}]]){healthRows=rows;assert.equal((await fetch(base+'/health/database')).status,503);}
 databaseStatus=503;assert.equal((await fetch(base+'/health/database')).status,503);
 for(const route of ['/login','/health','/manifest.webmanifest','/api/plates','/r/invalid']){
  const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.headers.get('x-powered-by'),null);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 }
 assert.equal((await fetch(base+'/r/%E0%A4%A')).status,400);
 for(const [body,status] of [['{',400],[JSON.stringify({text:'a'.repeat(33000)}),413]]){
  const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body});assert.equal(r.status,status);assert.ok(!(await r.text()).includes('SyntaxError'));
 }
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'email=a&password=b'})).status,403);
});
