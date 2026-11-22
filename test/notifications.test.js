const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const script=fs.readFileSync(path.join(__dirname,'../public/notifications.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../views/notifications.html'),'utf8');

test('notification page uses user action, manifest, PWA and explanatory disclaimer',()=>{
 assert.match(html,/id="notify-test"/);
 assert.match(html,/role="status"/);
 assert.match(html,/manifest.webmanifest/);
 assert.match(html,/assets\/pwa.js/);
 assert.match(html,/Web Push/);
 assert.match(html,/id="reminder-form"/);
 assert.match(html,/id="automation-refresh"/);
 assert.match(html,/id="monitor-state"/);
 assert.doesNotMatch(html,/service_role|VAPID_PRIVATE|api_key/i);
});

function harness({supported=true,standalone=true,permission='default'}={}){
 let listener;const result={textContent:''},support={textContent:''},button={disabled:false,addEventListener:(name,fn)=>{assert.equal(name,'click');listener=fn;}};
 let requests=0,calls=[];
 const notifications={permission,requestPermission:async()=>{requests++;notifications.permission='granted';return 'granted';}};
 const env={window:{isSecureContext:true,matchMedia:()=>({matches:standalone}),Notification:notifications},navigator:{userAgent:'iPhone',standalone,serviceWorker:{ready:Promise.resolve({showNotification:async(...args)=>{calls.push(args);}})}},document:{getElementById:id=>({'notify-test':button,'notify-result':result,'notify-support':support})[id]},Notification:notifications};
 if(!supported)delete env.window.Notification;
 vm.runInNewContext(script,env);
 return {click:()=>listener?.(),button,result,support,requests:()=>requests,calls};
}
test('iPhone must launch installed PWA to request notification',async()=>{
 const h=harness({standalone:false});
 assert.equal(h.button.disabled,true);
 assert.match(h.support.textContent,/Tela de Início/);
 assert.equal(h.calls.length,0);
});
test('unsupported environment never attempts to ask permission',()=>{
 const h=harness({supported:false});
 assert.equal(h.button.disabled,true);
 assert.equal(h.requests(),0);
});
test('single user click requests permission and sends only a local test notification',async()=>{
 const h=harness();
 assert.equal(h.calls.length,0);
 await h.click();
 assert.equal(h.requests(),1);
 assert.equal(h.calls.length,1);
 assert.match(h.calls[0][0],/KTIVAR/);
 assert.equal(h.calls[0][1].data.url,'/notifications');
 assert.match(h.result.textContent,/enviada/);
});
test('no notification is shown when permission denied',async()=>{
 const h=harness({permission:'denied'});
 await h.click();
 assert.equal(h.requests(),0);
 assert.equal(h.calls.length,0);
 assert.match(h.result.textContent,/não autorizadas/);
});
