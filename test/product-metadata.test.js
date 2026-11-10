const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {database}=require('../scripts/database-fixture');
const {registerWorkspace,validate,fields}=require('../modules/workspace');

const OTHER='00000000-0000-4000-8000-000000000010';
const REGULAR='00000000-0000-4000-8000-000000000011';
const TYPE='00000000-0000-4000-8000-000000000012';
const base={name:'Consultoria Estratégica',categoryId:OTHER,typeId:TYPE,priceCents:0,generatesPlate:false,enabled:true};

test('product metadata migration preserves existing rows and optional values',async t=>{
 const db=await database();t.after(()=>db.close());
 const initial=(await db.query("insert into products(name) values('Produto antigo') returning id")).rows[0];
 const row=(await db.query('select "otherLabel",description from products where id=$1',[initial.id])).rows[0];
 assert.deepEqual(row,{otherLabel:null,description:null});
 await db.query('update products set "otherLabel"=$1,description=$2 where id=$3',['Consultoria','Primeira linha\nSegunda linha',initial.id]);
 assert.equal((await db.query('select description from products where id=$1',[initial.id])).rows[0].description,'Primeira linha\nSegunda linha');
 await db.query('update products set "otherLabel"=null,description=null where id=$1',[initial.id]);
 assert.equal((await db.query('select description from products where id=$1',[initial.id])).rows[0].description,null);
 await assert.rejects(db.query('update products set description=$1 where id=$2',['x'.repeat(2001),initial.id]));
 await assert.rejects(db.query('update products set "otherLabel"=$1 where id=$2',['x'.repeat(161),initial.id]));
});

test('metadata uses existing product category, not an extra catalogue',()=>{
 assert.equal(validate({...base,otherLabel:' Consultoria de Marketing ',description:' Plano estratégico '},fields.products).otherLabel,'Consultoria de Marketing');
 assert.equal(validate({...base,description:''},fields.products).description,null);
 assert.throws(()=>validate({...base,description:'x'.repeat(2001)},fields.products));
 assert.throws(()=>validate({...base,otherLabel:'x'.repeat(161)},fields.products));
});

test('product API saves custom label only for canonical Outros and preserves category filters',async t=>{
 const app=express();app.use(express.json());const writes=[];let allOther=true;
 registerWorkspace(app,async(path,options={})=>{
  if(path.includes('product_categories?'))return [{id:allOther?OTHER:REGULAR,name:allOther?'Outro':'Placas inteligentes'}];
  if(options.method==='POST'&&path.startsWith('/rest/v1/products?')){writes.push(options.body);return [{id:'00000000-0000-4000-8000-000000000099',...options.body}];}
  if(path.startsWith('/rest/v1/products?'))return [];
  throw Error('Unexpected call: '+path);
 });
 app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const send=body=>fetch('http://127.0.0.1:'+server.address().port+'/workspace/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const custom=await send({...base,otherLabel:'  Instalação personalizada  ',description:'  Inclui suporte  '});
 assert.equal(custom.status,201);
 assert.equal(writes[0].categoryId,OTHER);
 assert.equal(writes[0].otherLabel,'Instalação personalizada');
 assert.equal(writes[0].description,'Inclui suporte');
 allOther=false;
 const standard=await send({...base,categoryId:REGULAR,otherLabel:'Antiga identificação'});
 assert.equal(standard.status,201);
 assert.equal(writes[1].categoryId,REGULAR);
 assert.equal(writes[1].otherLabel,null);
 const noDescription=await send({...base,categoryId:REGULAR,description:''});
 assert.equal(noDescription.status,201);
 assert.equal(writes[2].description,null);
});
