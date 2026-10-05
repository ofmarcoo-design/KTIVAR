const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'https://ktivar.kimzan.com.br';
const code=process.env.TEST_CODE;
let cookie='';
async function request(route,method='GET',body){
 const r=await fetch(base+route,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 const saved=r.headers.getSetCookie();if(saved.length)cookie=saved.map(v=>v.split(';')[0]).join('; ');
 return r;
}
(async()=>{
 assert.match(code,/^PL-\d{6}$/);
 const login=await request('/api/login','POST',{email:process.env.TEST_EMAIL,password:process.env.TEST_PASSWORD});assert.equal(login.status,200);
 const detail=await(await request(`/api/plates/${code}`)).json();assert.equal(detail.client?.id,process.env.TEST_CLIENT_ID,'Only the named disposable test record may be changed');
 const qr=await(await request(`/api/plates/${code}/qr.svg`)).text();
 const changed=await request(`/api/plates/${code}/destination`,'PATCH',{revision:detail.revision,destinationUrl:'https://example.com/ktivar-production-check'});assert.equal(changed.status,200,await changed.text());
 assert.equal((await request(`/api/plates/${code}/destination`,'PATCH',{revision:detail.revision,destinationUrl:'https://example.com/stale'})).status,409);
 const redirect=await request(`/r/${code}`);assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://example.com/ktivar-production-check');
 const history=await(await request(`/api/plates/${code}/destination-history`)).json();assert.equal(history.items[0].previousUrl,detail.destinationUrl);assert.equal(history.items[0].actorEmail,process.env.TEST_EMAIL);
 assert.equal(await(await request(`/api/plates/${code}/qr.svg`)).text(),qr);
 console.log('PASS production: persisted destination, revision conflict, current redirect, attributed history and unchanged QR.');
})().catch(e=>{console.error(e);process.exitCode=1;});
