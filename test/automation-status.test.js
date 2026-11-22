const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {latestMonitorRun,registerAutomationStatus}=require('../modules/automation-status');

const client=fs.readFileSync(path.join(__dirname,'../public/reminders.js'),'utf8');
test('remote reminders use authenticated APIs and describe operating limits',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../views/notifications.html'),'utf8');
 assert.match(html,/mesmo com o KTIVAR fechado/);
 assert.match(html,/Push remoto/);
 for(const view of ['dashboard','manage','plates','reports']){
  const file=fs.readFileSync(path.join(__dirname,'../views',view+'.html'),'utf8');
  assert.ok(!file.includes('/assets/reminder-alerts.js'),'old page-only reminder polling must be removed');
 }
 assert.match(html,/Última execução histórica confirmada/);
 assert.ok(client.includes("request('/api/reminders'"));
 assert.ok(client.includes("readyRegistration.pushManager.subscribe("));
 assert.ok(client.includes("request('/api/push/subscribe'"));
 assert.doesNotMatch(client,/service_role|sb_secret_|VAPID_PRIVATE/);
});
test('GitHub monitor status handles success without modifying anything',async()=>{
 let called;
 const result=await latestMonitorRun(async(url,opts)=>{
   called={url,opts};
   return {ok:true,json:async()=>({workflow_runs:[{status:'completed',conclusion:'success',updated_at:'2026-11-22T04:00:00Z',html_url:'https://github.com/ofmarcoo-design/KTIVAR/actions/runs/100'}]})};
 });
 assert.match(called.url,/ktivar-database-monitor/);
 assert.equal(result.state,'success');
 assert.equal(result.url,'https://github.com/ofmarcoo-design/KTIVAR/actions/runs/100');
});
test('untrusted GitHub links are not surfaced',async()=>{
 const result=await latestMonitorRun(async()=>({ok:true,json:async()=>({workflow_runs:[{status:'completed',conclusion:'failure',html_url:'https://malicious.example/bad'}]})}));
 assert.equal(result.state,'failed');assert.equal(result.url,null);
});
test('automation status registers only read-only GET route',async()=>{
 let path,fn;registerAutomationStatus({get:(p,h)=>{path=p;fn=h;}},{getLatest:async()=>({state:'success'})});
 assert.equal(path,'/automations/status');
 const response={headers:{},set(k,v){this.headers[k]=v;},json(x){this.body=x;}};
 await fn({},response);
 assert.equal(response.body.monitor.state,'success');
 assert.equal(response.headers['Cache-Control'],'no-store');
});
