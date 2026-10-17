const {test}=require('node:test');
const assert=require('node:assert/strict');
const {database}=require('../scripts/database-fixture');
const {restoreFixture}=require('../scripts/restore-fixture');
const {validateBulk}=require('../modules/plate-bulk');

test('bulk requests are bounded and never accept duplicate codes or stale missing revisions',()=>{
 const row={code:'PL-000143',revision:0};
 for(const action of ['archive','restore','activate','deactivate'])assert.equal(validateBulk({action,plates:[row]}),true);
 for(const body of [null,{},[],{action:'delete',plates:[row]},{action:'archive',plates:[]},{action:'archive',plates:[row,row]},{action:'archive',plates:[{...row,revision:-1}]},{action:'archive',plates:[{...row,revision:'0'}]},{action:'archive',plates:[null]},{action:'archive',plates:[{code:'anything',revision:0}]},{action:'archive',plates:Array.from({length:51},(_,i)=>({code:'PL-'+String(i).padStart(6,'0'),revision:0}))}])assert.equal(validateBulk(body),false);
});

test('bulk archive is atomic, reversible, audited and disables redirects without changing plate identities',async t=>{
 const db=await database();t.after(()=>db.close());
 const actor='00000000-0000-4000-8000-000000000071',outsider='00000000-0000-4000-8000-000000000072';
 await db.exec(`insert into auth.users values('${actor}','bulk@test.test'),('${outsider}','out@test.test');insert into plate_access("userId") values('${actor}');`);
 const client=(await db.query("insert into clients(name) values('Bulk') returning id")).rows[0].id;
 const active=(await db.query('insert into plates("clientId",status,"destinationUrl") values($1,$2,$3) returning *',[client,'active','https://example.test/real'])).rows[0];
 const stock=(await db.query("insert into plates(status) values('stock') returning *")).rows[0];
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${actor}',false)`);
 const rows=async codes=>(await db.query('select code,revision from plates where code=any($1::text[]) order by code',[codes])).rows;
 const perform=async(action,plates)=>(await db.query('select bulk_plate_action($1,$2::jsonb) data',[action,JSON.stringify(plates)])).rows[0].data;
 let selection=await rows([active.code,stock.code]);
 const overview=(await db.query('select administration_overview() data')).rows[0].data;
 await assert.rejects(perform('deactivate',selection));
 await assert.rejects(perform('activate',selection));
 assert.equal((await db.query('select active from plates where code=$1',[active.code])).rows[0].active,true,'invalid stock activation rolls back all rows');
 assert.equal((await perform('archive',selection)).updated,2);
 for(const original of [active,stock]){
  const archived=(await db.query('select * from plates where code=$1',[original.code])).rows[0];
  assert.equal(archived.archived,true);assert.equal(archived.active,false);
  for(const field of ['code','serialNumber','status','clientId','destinationUrl','createdAt'])assert.deepEqual(archived[field],original[field],field+' is preserved');
 }
 const after=(await db.query('select administration_overview() data')).rows[0].data;
 assert.equal((await db.query('select workspace_report(current_date-1,current_date+1) data')).rows[0].data.current.newPlates,0);
 assert.equal(after.plates,overview.plates-2);assert.equal(after.stock,overview.stock-1);assert.equal(after.active,0);
 assert.equal((await db.query('select count(*)::int n from plate_destination_history')).rows[0].n,1,'archival creates no destination change');
 assert.equal((await db.query("select count(*)::int n from audit_log where entity='plates' and operation='UPDATE' and 'archived'=any(\"changedFields\")")).rows[0].n,2);
 await db.exec('reset role;set role anon');
 const resolved=(await db.query('select * from resolve_plate_access($1,true)',[active.code])).rows[0];assert.equal(resolved.active,false);assert.equal(resolved.recorded,false);
 await assert.rejects(db.query('select archived from plates'));
 await assert.rejects(perform('restore',await Promise.resolve(selection)));
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${outsider}',false)`);
 await assert.rejects(perform('archive',selection));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 await assert.rejects(perform('restore',selection),'stale revision rejects the entire selection');
 selection=await rows([active.code,stock.code]);
 await assert.rejects(perform('restore',[selection[0],{code:'PL-999999',revision:0}]));
 assert.equal((await db.query('select count(*)::int n from plates where archived')).rows[0].n,2,'missing plate cannot partially restore');
 await db.query("update plate_statuses set redirects=false where key='active'");
 await db.query("update plate_statuses set redirects=true where key='active'");
 assert.equal((await db.query('select active from plates where code=$1',[active.code])).rows[0].active,false,'status configuration cannot reactivate archived plates');
 selection=await rows([active.code,stock.code]);
 assert.equal((await perform('restore',selection)).updated,2);
 assert.equal((await db.query('select active from plates where code=$1',[active.code])).rows[0].active,true);
 const restoredStock=(await db.query('select status,active,archived from plates where code=$1',[stock.code])).rows[0];assert.deepEqual(restoredStock,{status:'stock',active:false,archived:false});
 assert.equal((await perform('deactivate',await rows([active.code]))).updated,1);
 assert.equal((await db.query('select active from plates where code=$1',[active.code])).rows[0].active,false);
 assert.equal((await perform('activate',await rows([active.code]))).updated,1);
 await perform('archive',await rows([active.code]));
 const backup=(await db.query('select workspace_backup() data')).rows[0].data;
 assert.equal(backup.tables.plates.find(p=>p.code===active.code).archived,true);
 const restored=await database();t.after(()=>restored.close());await restoreFixture(restored,backup);
 assert.deepEqual((await restored.query('select archived,active,status,"serialNumber" from plates where code=$1',[active.code])).rows[0],{archived:true,active:false,status:'active',serialNumber:active.serialNumber});
 const legacy=JSON.parse(JSON.stringify(backup));for(const p of legacy.tables.plates)delete p.archived;
 // Legacy snapshots predate archival, and retain normal default behavior.
 for(const p of legacy.tables.plates)if(p.status==='active')p.active=true;
 await restoreFixture(restored,legacy);assert.equal((await restored.query('select count(*)::int n from plates where archived')).rows[0].n,0);
});
