const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {safeEndpoint,VAPID_PUBLIC,registerWebPush}=require('../modules/web-push');

test('push endpoints only accept trusted HTTPS push services',()=>{
 for(const url of ['https://web.push.apple.com/Q12','https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/wpush/v2/abc'])
   assert.equal(safeEndpoint(url),true,url);
 for(const url of ['http://web.push.apple.com/x','https://localhost/a','https://127.0.0.1/a','https://evil.com/a','https://web.push.apple.com.evil.com/path','https://user:pass@web.push.apple.com/x'])
   assert.equal(safeEndpoint(url),false,url);
 assert.equal(VAPID_PUBLIC.length,87);
});
test('authenticated notification API exposes no server secret',()=>{
 const handlers={get:[],post:[],delete:[]};
 const router={get:(p,h)=>handlers.get.push(p),post:(p,h)=>handlers.post.push(p),delete:(p,h)=>handlers.delete.push(p)};
 registerWebPush(router,async()=>[]);
 assert.ok(handlers.get.includes('/push/config'));
 assert.ok(handlers.get.includes('/reminders'));
 assert.ok(handlers.post.includes('/push/subscribe'));
 assert.ok(handlers.delete.includes('/reminders/:id'));
 const src=fs.readFileSync(path.join(__dirname,'../modules/web-push.js'),'utf8');
 assert.doesNotMatch(src,/SERVICE_ROLE_KEY|vapid_private|dispatch_token/i);
});
test('service worker shows remote notifications without cache or route rewriting',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'../public/service-worker.js'),'utf8');
 assert.match(worker,/addEventListener\('push'/);
 assert.match(worker,/registration.showNotification/);
 assert.ok(!worker.includes('respondWith('));
});
