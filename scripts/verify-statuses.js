const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'https://ktivar.kimzan.com.br';let cookie='';const code=process.env.TEST_CODE;
async function request(route,method='GET',body){const r=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,redirect:'manual'});const saved=r.headers.getSetCookie();if(saved.length)cookie=saved.map(v=>v.split(';')[0]).join('; ');return r;}
async function json(route,method='GET',body){const r=await request(route,method,body);const data=await r.json();assert.ok(r.ok,`${method} ${route}: ${r.status} ${data.error||''}`);return data;}
(async()=>{
 assert.match(code,/^PL-\d{6}$/);await json('/api/login','POST',{email:process.env.TEST_EMAIL,password:process.env.TEST_PASSWORD});
 let plate=await json(`/api/plates/${code}`);assert.equal(plate.client?.id,process.env.TEST_CLIENT_ID,'Only the named disposable test record may change');
 const qr=await(await request(`/api/plates/${code}/qr.svg`)).text();
 const status=await json('/api/plate-statuses','POST',{name:'TESTE temporário',color:'#667085',position:99,enabled:true,redirects:false});console.log('CLEANUP_STATUS_ID',status.id);
 const patch=async key=>{plate=await json(`/api/plates/${code}`);await json(`/api/plates/${code}`,'PATCH',{...plate,status:key});};
 await patch(status.key);assert.equal((await request(`/r/${code}`)).status,410);
 await json(`/api/plate-statuses/${status.id}`,'PATCH',{name:'TESTE renomeado',color:'#667085',position:100,enabled:true});assert.equal((await request(`/r/${code}`)).status,410);
 await json(`/api/plate-statuses/${status.id}/redirect`,'PATCH',{redirects:true,confirmed:true});assert.equal((await request(`/r/${code}`)).status,302);
 const filtered=await json(`/api/plates?status=${status.key}&clientId=${plate.clientId}`);assert.ok(filtered.items.some(p=>p.code===code));
 await patch('active');await json(`/api/plate-statuses/${status.id}`,'PATCH',{name:'TESTE encerrado',color:'#667085',position:100,enabled:false});
 assert.equal(await(await request(`/api/plates/${code}/qr.svg`)).text(),qr);
 console.log('PASS production: configurable status, rename, explicit redirect, persisted filters and unchanged QR.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
