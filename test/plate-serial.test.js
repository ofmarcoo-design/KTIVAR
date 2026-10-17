const {test}=require('node:test');
const assert=require('node:assert/strict');
const {database}=require('../scripts/database-fixture');
const {plateQrSvg}=require('../modules/plate-qr');

test('printed serials are unique, four digits, immutable, private and exhausted safely',async t=>{
 const db=await database();t.after(()=>db.close());const actor='00000000-0000-4000-8000-000000000001';
 await db.exec(`insert into auth.users values('${actor}','serial@example.test');insert into plate_access("userId") values('${actor}');set role authenticated;select set_config('request.jwt.claim.sub','${actor}',false);`);
 const batch=(await db.query('select generate_plate_batch($1,100) data',[actor])).rows[0].data;
 const plates=(await db.query('select code,"serialNumber" from plates order by code')).rows;
 assert.equal(plates.length,100);assert.equal(new Set(plates.map(p=>p.serialNumber)).size,100);
 assert.ok(plates.every(p=>Number.isInteger(p.serialNumber)&&p.serialNumber>=1000&&p.serialNumber<=9999));
 assert.deepEqual((await db.query('select generate_plate_batch($1,100) data',[actor])).rows[0].data,batch);
 const plate=plates[0];const client=(await db.query("insert into clients(name) values('Serial') returning id")).rows[0].id;
 await db.query('update plates set status=$1,"clientId"=$2,"destinationUrl"=$3 where code=$4',['active',client,'https://example.test/a',plate.code]);
 await db.query('update plates set "destinationUrl"=$1 where code=$2',['https://example.test/b',plate.code]);
 assert.equal((await db.query('select "serialNumber" from plates where code=$1',[plate.code])).rows[0].serialNumber,plate.serialNumber);
 await assert.rejects(db.query('update plates set "serialNumber"=$1 where code=$2',[plates[1].serialNumber,plate.code]));
 for(const serial of [999,10000,plate.serialNumber])await assert.rejects(db.query('insert into plates(status,"serialNumber") values($1,$2)',['stock',serial]));
 // Populate the entire finite namespace, then exercise the normal allocation path.
 await db.exec(`insert into plates(status,"serialNumber") select 'stock',n from generate_series(1000,9999) n where not exists(select 1 from plates p where p."serialNumber"=n);`);
 assert.equal((await db.query('select count(*)::int n from plates')).rows[0].n,9000);
 await assert.rejects(db.query("insert into plates(status) values('stock')"),/Plate serial capacity exhausted/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select "serialNumber" from plates'));await assert.rejects(db.query('select private.next_plate_serial()'));
});

test('printed SVG keeps original QR paths and safe quiet zone, with a discreet fixed serial',async()=>{
 const url='https://example.test/r/PL-000143',svg=await plateQrSvg(url,4827);
 const original=await require('qrcode').toString(url,{type:'svg',errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}});
 const size=Number(original.match(/viewBox="0 0 (\d+) \d+"/)[1]);
 assert.ok(svg.includes(`viewBox="0 0 ${size+2} ${size+2}"`));
 const paths=text=>[...text.matchAll(/<path[^>]*>/g)].map(m=>m[0]);assert.deepEqual(paths(svg).slice(1,3),paths(original));
 assert.match(svg,/font-size="1.5"/);assert.match(svg,/>4827<\/text>/);
 for(const value of [null,999,10000,'4827','<script>'])await assert.rejects(plateQrSvg(url,value));
});

test('serial backfill preserves existing plate fields, revisions, audit and destination history',async t=>{
 const name='20261017184816_plate_print_serial.sql';const db=await database({beforeMigration:name});t.after(()=>db.close());
 const client=(await db.query("insert into clients(name) values('Existing') returning id")).rows[0].id;
 await db.query('insert into plates("clientId",status,"destinationUrl") values($1,$2,$3)',[client,'active','https://example.test/existing']);
 await db.exec("insert into plates(status) values('stock'),('stock')");
 const before=(await db.query('select * from plates order by code')).rows;
 const auditBefore=(await db.query('select count(*)::int n from audit_log')).rows[0].n;
 const historyBefore=(await db.query('select count(*)::int n from plate_destination_history')).rows[0].n;
 await db.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'../supabase/migrations',name),'utf8'));
 const after=(await db.query('select * from plates order by code')).rows;
 assert.deepEqual(after.map(({serialNumber,...row})=>row),before);
 assert.equal(new Set(after.map(p=>p.serialNumber)).size,3);
 assert.equal((await db.query('select count(*)::int n from audit_log')).rows[0].n,auditBefore);
 assert.equal((await db.query('select count(*)::int n from plate_destination_history')).rows[0].n,historyBefore);
});
