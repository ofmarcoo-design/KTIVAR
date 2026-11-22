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

test('iOS subscription is initiated in the tap handler without awaiting a fetch',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/reminders.js'),'utf8');
 assert.match(source,/const \[config,registration\]=await Promise\.all/);
 assert.match(source,/pushBtn\.addEventListener\('click',\(\)=>\{/);
 const handler=source.split("pushBtn.addEventListener('click',()=>{")[1].split("testBtn.addEventListener(")[0];
 const subscription=handler.indexOf('readyRegistration.pushManager.subscribe(');
 assert.ok(subscription>0);
 assert.ok(!handler.slice(0,subscription).includes('await '),'iPhone subscription must be initiated synchronously');
 assert.match(handler,/await request\('\/api\/push\/subscribe'/);
 assert.match(source,/testBtn\.disabled=!subscribed/);
 assert.doesNotMatch(handler,/Notification\.requestPermission/);
});

test('completed reminders remain visible and deletions meet KTIVAR JSON contract',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../views/notifications.html'),'utf8');
 const src=fs.readFileSync(path.join(__dirname,'../public/reminders.js'),'utf8');
 assert.match(html,/id="reminder-history"/);
 assert.match(html,/id="reminder-history-count"/);
 assert.match(src,/\['sent','failed','cancelled'\]/);
 assert.match(src,/method:'DELETE'/);
 assert.match(src,/\['GET','HEAD'\]/);
 assert.match(src,/Content-Type':'application\/json'/);
 assert.match(src,/Não foi possível excluir/);
});
