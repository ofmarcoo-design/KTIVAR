const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync,readdirSync}=require('node:fs');const {database}=require('../scripts/database-fixture');const {validate,fields,catalogs}=require('../modules/workspace');
test('registration catalogues contain real choices and Other without replacing configured records',async t=>{
 const db=await database();t.after(()=>db.close());
 for(const [kind,table] of Object.entries(catalogs)){
  const rows=(await db.query(`select * from ${table} where enabled`)).rows;assert.ok(rows.length,kind+' must have choices');
  if(kind!=='stages')assert.ok(rows.some(r=>r.name==='Outro'),kind+' must offer Other');
 }
 const before=(await db.query('select id,name,revision,enabled from client_segments order by id')).rows;
 await db.exec(readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(f=>f.endsWith('_complete_registration_catalogs.sql')),'utf8'));
 assert.deepEqual((await db.query('select id,name,revision,enabled from client_segments order by id')).rows,before,'seed is idempotent');
 const id=before[0].id;
 for(const [kind,names] of [['clients',['segmentId','sourceId']],['products',['categoryId','typeId']]]){
  assert.throws(()=>validate({name:'Teste'},fields[kind]));
  for(const missing of names){const payload={name:'Teste',...Object.fromEntries(names.map(n=>[n,id]))};payload[missing]='';assert.throws(()=>validate(payload,fields[kind]));}
  assert.equal(validate({name:'Teste',...Object.fromEntries(names.map(n=>[n,id]))},fields[kind]).name,'Teste');
 }
});
test('catalogue API rejects removing its final available choice',async t=>{
 const express=require('express');const {registerWorkspace}=require('../modules/workspace');const app=express();app.use(express.json());let remaining=[],writes=0;
 registerWorkspace(app,async(path,options={})=>{if(options.method){writes++;return [{id:'00000000-0000-4000-8000-000000000001'}];}return remaining;});app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const body={name:'Outro',color:'#667085',position:0,enabled:false,revision:0};const send=()=>fetch(`http://127.0.0.1:${server.address().port}/workspace/catalogs/segments/00000000-0000-4000-8000-000000000001`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await send()).status,409);assert.equal(writes,0);remaining=[{id:'00000000-0000-4000-8000-000000000002'}];assert.equal((await send()).status,200);assert.equal(writes,1);
});
