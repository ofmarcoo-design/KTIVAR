const {Router}=require('express');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const catalogs={segments:'client_segments',sources:'client_sources',tags:'tags',categories:'product_categories',types:'product_types','activity-types':'activity_types','loss-reasons':'loss_reasons',stages:'crm_stages'};
const fields={
 clients:{name:['text',160,true],company:['text',160],phone:['text',160],segmentId:['uuid'],sourceId:['uuid'],ownerId:['uuid'],city:['text',160],state:['state'],address:['text',500],cnpj:['text',30],enabled:['boolean']},
 products:{name:['text',160,true],categoryId:['uuid'],typeId:['uuid'],priceCents:['integer',1000000000],generatesPlate:['boolean'],enabled:['boolean']},
 contacts:{clientId:['uuid',null,true],name:['text',160,true],phone:['text',160],whatsapp:['text',160],email:['email'],instagram:['text',300],website:['url'],enabled:['boolean']}
};
const catalogFields={name:['text',100,true],color:['color',null,true],position:['integer',100000,true],enabled:['boolean',null,true]};
function invalid(message='Confira os dados informados.'){return Object.assign(new Error(message),{status:400});}
function validate(body,schema){
 if(!body||typeof body!=='object'||Array.isArray(body))throw invalid();const result={};
 for(const [field,[type,max,required]] of Object.entries(schema)){
  let value=body[field];if(value===undefined){if(required)throw invalid(`Informe ${field}.`);continue;}
  if(value===''||value===null){if(required||['boolean','integer'].includes(type))throw invalid();result[field]=null;continue;}
  if(type==='boolean'){if(typeof value!=='boolean')throw invalid();}
  else if(type==='integer'){if(!Number.isSafeInteger(value)||value<0||value>max)throw invalid();}
  else{
   if(typeof value!=='string')throw invalid();value=value.trim();
   if(required&&!value||max&&value.length>max)throw invalid();
   if(type==='uuid'&&!uuid.test(value)||type==='color'&&!/^#[0-9a-f]{6}$/i.test(value)||type==='state'&&!/^[A-Z]{2}$/.test(value)||type==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>254))throw invalid();
   if(type==='url'){let u;try{u=new URL(value);}catch{throw invalid();}if(!['http:','https:'].includes(u.protocol)||u.username||u.password||value.length>2048)throw invalid();}
  }
  result[field]=value;
 }
 return result;
}
function registerWorkspace(api,supabase){
 const router=Router();const db=(req,path,options={})=>supabase('/rest/v1/'+path,{token:req.supabaseToken,...options});
 const guarded=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
 router.get('/operators',guarded(async(req,res)=>res.json(await db(req,'rpc/operator_list',{method:'POST',body:{}}))));
 function crud(route,table,schema,selection='*'){
  router.get(route,guarded(async(req,res)=>{
   const page=Math.max(0,Math.min(100000,parseInt(req.query.page,10)||0));const q=new URLSearchParams({select:selection,order:'createdAt.desc,id.desc',limit:'51',offset:String(page*50)});
   const search=String(req.query.search||'').replace(/[*,()%_]/g,'').slice(0,120);if(search)q.set('name',`ilike.*${search}*`);
   for(const field of Object.keys(schema))if(schema[field][0]==='uuid'&&req.query[field]){if(!uuid.test(req.query[field]))throw invalid();q.set(field,`eq.${req.query[field]}`);}
   if(req.query.from||req.query.to){if(table!=='clients')throw invalid('Filtro de período indisponível neste cadastro.');const {date}=require('./crm');const from=date(req.query.from),to=date(req.query.to);if(to<from)throw invalid();q.set('and',`(createdDay.gte.${from},createdDay.lte.${to})`);}
   if(['true','false'].includes(req.query.enabled))q.set('enabled',`eq.${req.query.enabled}`);
   const rows=await db(req,`${table}?${q}`);res.json({items:rows.slice(0,50),hasMore:rows.length>50,page});
  }));
  router.get(route+'/:id',guarded(async(req,res)=>{if(!uuid.test(req.params.id))throw invalid();const rows=await db(req,`${table}?${new URLSearchParams({select:selection,id:`eq.${req.params.id}`,limit:'1'})}`);if(!rows.length)return res.status(404).json({error:'Registro não encontrado.'});res.json(rows[0]);}));
  for(const method of ['post','patch'])router[method](method==='post'?route:route+'/:id',guarded(async(req,res)=>{
   const values=validate(req.body,schema);const q=new URLSearchParams({select:'*'});
   if(method==='patch'){if(!uuid.test(req.params.id))throw invalid();if(!Number.isSafeInteger(req.body.revision)||req.body.revision<0)return res.status(428).json({error:'Reabra o registro antes de salvar.'});q.set('id',`eq.${req.params.id}`);q.set('revision',`eq.${req.body.revision}`);}
   const rows=await db(req,`${table}?${q}`,{method:method.toUpperCase(),body:values,prefer:'return=representation'});if(!rows.length)return res.status(409).json({error:'O registro mudou. Reabra antes de salvar.'});res.status(method==='post'?201:200).json(rows[0]);
  }));
 }
 crud('/clients','clients',fields.clients);
 crud('/products','products',fields.products);
 crud('/contacts','contacts',fields.contacts);
 router.get('/catalogs/:kind',guarded(async(req,res)=>{const table=Object.hasOwn(catalogs,req.params.kind)?catalogs[req.params.kind]:null;if(!table)return res.status(404).json({error:'Configuração não encontrada.'});res.json(await db(req,table+'?select=*&order=position.asc,name.asc'));}));
 for(const method of ['post','patch'])router[method](method==='post'?'/catalogs/:kind':'/catalogs/:kind/:id',guarded(async(req,res)=>{
  const table=Object.hasOwn(catalogs,req.params.kind)?catalogs[req.params.kind]:null;if(!table)return res.status(404).json({error:'Configuração não encontrada.'});const schema={...catalogFields};if(table==='crm_stages')schema.requiresFollowup=['boolean'];const values=validate(req.body,schema);const q=new URLSearchParams({select:'*'});
  if(method==='patch'){if(!uuid.test(req.params.id))throw invalid();if(!Number.isSafeInteger(req.body.revision)||req.body.revision<0)return res.status(428).json({error:'Reabra a configuração.'});q.set('id',`eq.${req.params.id}`);q.set('revision',`eq.${req.body.revision}`);}
  const rows=await db(req,`${table}?${q}`,{method:method.toUpperCase(),body:values,prefer:'return=representation'});if(!rows.length)return res.status(409).json({error:'Configuração alterada por outra sessão.'});res.status(method==='post'?201:200).json(rows[0]);
 }));
 router.post('/contacts/:id/primary',guarded(async(req,res)=>{if(!uuid.test(req.params.id))throw invalid();await db(req,'rpc/set_primary_contact',{method:'POST',body:{p_id:req.params.id}});res.json({ok:true});}));
 router.put('/clients/:id/tags',guarded(async(req,res)=>{if(!uuid.test(req.params.id)||!Array.isArray(req.body?.tags)||req.body.tags.length>50||req.body.tags.some(t=>!uuid.test(t)))throw invalid();await db(req,'rpc/set_client_tags',{method:'POST',body:{p_client:req.params.id,p_tags:req.body.tags}});res.json({ok:true});}));
 const saleSelect='id,clientId,dealId,soldAt,status,cancellationReason,createdAt,updatedAt,revision,client:clients(id,name),items:sale_items(*),plates:plates(code,saleItemId,saleUnit)';
 // Plates link to an item; avoid a nonexistent direct sales relationship.
 const selection=saleSelect.replace(',plates:plates(code,saleItemId,saleUnit)','').replace('items:sale_items(*)','items:sale_items(*,plates(code,saleUnit))');
 router.get('/sales',guarded(async(req,res)=>{const page=Math.max(0,Math.min(100000,parseInt(req.query.page,10)||0));const q=new URLSearchParams({select:selection,order:'soldAt.desc,id.desc',limit:'51',offset:String(page*50)});if(req.query.clientId){if(!uuid.test(req.query.clientId))throw invalid();q.set('clientId',`eq.${req.query.clientId}`);}if(req.query.from||req.query.to){const {date}=require('./crm');const from=date(req.query.from),to=date(req.query.to);if(to<from)throw invalid();q.set('and',`(soldAt.gte.${from},soldAt.lte.${to})`);}
  if(req.query.status){if(!['confirmed','cancelled'].includes(req.query.status))throw invalid();q.set('status',`eq.${req.query.status}`);}const rows=await db(req,`sales?${q}`);res.json({items:rows.slice(0,50).map(s=>({...s,totalCents:s.items.reduce((n,i)=>n+Number(i.totalCents),0)})),hasMore:rows.length>50,page});}));
 router.get('/sales/:id',guarded(async(req,res)=>{if(!uuid.test(req.params.id))throw invalid();const rows=await db(req,`sales?${new URLSearchParams({select:selection,id:`eq.${req.params.id}`})}`);if(!rows.length)return res.status(404).json({error:'Venda não encontrada.'});res.json({...rows[0],totalCents:rows[0].items.reduce((n,i)=>n+Number(i.totalCents),0)});}));
 router.post('/sales',guarded(async(req,res)=>{
  const b=req.body||{};if(!uuid.test(b.id)||!uuid.test(b.clientId)||typeof b.soldAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.soldAt)||!Array.isArray(b.items)||b.items.length<1||b.items.length>100)throw invalid();
  const items=b.items.map(item=>{if(!uuid.test(item.productId)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>1000||!Number.isSafeInteger(item.priceCents)||item.priceCents<0||item.priceCents>1000000000||!Number.isSafeInteger(item.discountCents)||item.discountCents<0||item.discountCents>item.quantity*item.priceCents)throw invalid();return {productId:item.productId,quantity:item.quantity,priceCents:item.priceCents,discountCents:item.discountCents};});
  const id=await db(req,'rpc/create_sale',{method:'POST',body:{p_id:b.id,p_client:b.clientId,p_date:b.soldAt,p_items:items}});res.status(201).json({id});
 }));
 router.post('/sales/:id/cancel',guarded(async(req,res)=>{if(!uuid.test(req.params.id)||!Number.isSafeInteger(req.body?.revision)||typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>500)throw invalid();await db(req,'rpc/cancel_sale',{method:'POST',body:{p_id:req.params.id,p_revision:req.body.revision,p_reason:req.body.reason}});res.json({ok:true});}));
 router.post('/sale-items/:id/plate',guarded(async(req,res)=>{if(!uuid.test(req.params.id)||!Number.isInteger(req.body?.unit)||req.body.unit<1||req.body.unit>1000)throw invalid();let destination;try{destination=require('./plates').validateDestination(req.body.destinationUrl,req.get('host'));}catch(e){throw invalid(e.message);}const code=await db(req,'rpc/generate_sale_plate',{method:'POST',body:{p_item:req.params.id,p_unit:req.body.unit,p_destination:destination}});res.status(201).json({code});}));
 router.get('/clients/:id/profile',guarded(async(req,res)=>{
  if(!uuid.test(req.params.id))throw invalid();const rows=await db(req,`clients?${new URLSearchParams({select:'*,contacts(*),plates(code,status,productId),sales(id,soldAt,status,items:sale_items(*)),client_tags(tagId,tag:tags(id,name))',id:`eq.${req.params.id}`,limit:'1'})}`);if(!rows.length)return res.status(404).json({error:'Cliente não encontrado.'});res.json(rows[0]);
 }));
 api.use('/workspace',router);
}
module.exports={registerWorkspace,validate,catalogs,fields};
