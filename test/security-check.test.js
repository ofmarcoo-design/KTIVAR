const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../scripts/security-check.js'),'utf8');
test('security scan ignores withdrawn advisories, blocks active findings and never treats failed lookups as clean',async()=>{
 async function run(response){
  const messages=[],state={env:{GITHUB_TOKEN:'fixture-token-value'},exitCode:0};
  await vm.runInNewContext(source,{require:()=>({dependencies:{fixture:'1.0.0'}}),AbortSignal,process:state,console:{log:message=>messages.push(message),error:message=>messages.push(message)},fetch:async(url,options)=>{
   assert.ok(url.startsWith('https://api.github.com/advisories?'));assert.equal(options.headers.Authorization,'Bearer fixture-token-value');if(response instanceof Error)throw response;return {ok:response.status===200,status:response.status,json:async()=>response.data};
  }});
  assert.ok(messages.every(message=>!message.includes('fixture-token-value')));return state.exitCode;
 }
 assert.equal(await run({status:200,data:[]}),0);
 assert.equal(await run({status:200,data:[{ghsa_id:'withdrawn',withdrawn_at:'2025-12-02'}]}),0);
 assert.equal(await run({status:200,data:[{ghsa_id:'active',severity:'low',html_url:'https://github.com/advisories/active'}]}),1);
 assert.equal(await run({status:503,data:[]}),1);
 assert.equal(await run({status:200,data:null}),1);
 assert.equal(await run(Error('network unavailable')),1);
});
