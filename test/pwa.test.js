const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {registerPwa}=require('../modules/pwa');

test('PWA metadata is public, icons match their sizes and worker never intercepts private data or redirects',async t=>{
 const app=express();registerPwa(app);app.use('/assets',express.static(path.join(__dirname,'../public')));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+'/manifest.webmanifest');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/manifest\+json/);assert.equal(response.headers.get('cache-control'),'no-cache');
 const manifest=await response.json();assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.prefer_related_applications,false);
 for(const icon of [...manifest.icons,{src:'/assets/pwa/apple-touch-icon.png',sizes:'180x180'}]){const r=await fetch(base+icon.src);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);}
 assert.ok(manifest.icons.some(i=>i.purpose==='any'&&i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.purpose==='any'&&i.sizes==='512x512'));assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
 const worker=await fetch(base+'/service-worker.js');assert.equal(worker.status,200);assert.match(worker.headers.get('content-type'),/javascript/);assert.equal(worker.headers.get('cache-control'),'no-cache');
 const events={};let claimed=0,skipped=0;vm.runInNewContext(await worker.text(),{self:{addEventListener:(name,handler)=>events[name]=handler,skipWaiting:async()=>skipped++,clients:{claim:async()=>claimed++}}});
 for(const name of ['install','activate']){let task;events[name]({waitUntil:value=>task=value});await task;}assert.equal(claimed,1);assert.equal(skipped,1);
 for(const url of ['/api/session','/api/logout','/api/workspace/backup','/api/plates/PL-000143/qr.svg','/r/PL-000143','/plates','/login','/assets/app.css']){let handled=false;events.fetch({request:{url:base+url,method:'GET'},respondWith:()=>handled=true});assert.equal(handled,false,url+' must use the original network request');}
 for(const view of ['dashboard','manage','plates','reports','login','client-portal']){const html=readFileSync(path.join(__dirname,'../views/'+view+'.html'),'utf8');assert.equal((html.match(/rel="manifest"/g)||[]).length,1);assert.ok(html.includes('/assets/pwa.js'));assert.ok(html.includes('apple-touch-icon'));}
});
