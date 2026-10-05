const {Router}=require('express');const {validate}=require('./workspace');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=message=>Object.assign(new Error(message||'Confira os dados.'),{status:400});
const dealSchema={clientId:['uuid',null,true],name:['text',160,true],estimatedCents:['integer',100000000000],ownerId:['uuid'],stageId:['uuid',null,true],lossReasonId:['uuid']};
const activitySchema={clientId:['uuid',null,true],dealId:['uuid'],typeId:['uuid',null,true],ownerId:['uuid'],name:['text',300,true],note:['text',3000],enabled:['boolean']};
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw invalid('Informe uma data válida.');return value;}
function registerCRM(api,supabase){
 const router=Router();const db=(req,path,options={})=>supabase('/rest/v1/'+path,{token:req.supabaseToken,...options});const guarded=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
 const selections={deals:'*,client:clients(id,name,sales(id,status)),stage:crm_stages(id,name,requiresFollowup),activities(id,name,dueDate,typeId,completedAt,isNextAction,enabled,revision),deal_tags(tagId)',activities:'*,client:clients(id,name),deal:deals(id,name),type:activity_types(id,name)'};
 for(const type of ['deals','activities']){
  router.get('/'+type,guarded(async(req,res)=>{
   const page=Math.max(0,Math.min(100000,parseInt(req.query.page,10)||0));const q=new URLSearchParams({select:selections[type],order:type==='deals'?'createdAt.desc,id.desc':'dueDate.asc,id.asc',limit:'51',offset:String(page*50)});const search=String(req.query.search||'').replace(/[*,()%_]/g,'').slice(0,120);if(search)q.set('name',`ilike.*${search}*`);
   for(const field of ['clientId','ownerId',type==='deals'?'stageId':'dealId'])if(req.query[field]){if(!uuid.test(req.query[field]))throw invalid();q.set(field,`eq.${req.query[field]}`);}
   if(type==='deals'&&req.query.result){if(!['open','won','lost'].includes(req.query.result))throw invalid();q.set('result',`eq.${req.query.result}`);}
   if(req.query.from||req.query.to){const from=date(req.query.from),to=date(req.query.to);if(to<from)throw invalid();const column=type==='activities'?'dueDate':['won','lost'].includes(req.query.result)?'closedDay':'createdDay';q.set('and',`(${column}.gte.${from},${column}.lte.${to})`);}
   if(type==='activities'){
    const mode=req.query.mode||'pending';if(!['pending','overdue','today','future','completed','all'].includes(mode))throw invalid();const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
    if(mode!=='all')q.set('enabled','eq.true');if(mode==='completed')q.set('completedAt','not.is.null');else if(mode!=='all')q.set('completedAt','is.null');
    if(['overdue','today','future'].includes(mode))q.set('dueDate',`${mode==='overdue'?'lt':mode==='today'?'eq':'gt'}.${today}`);
   }
   const rows=await db(req,`${type}?${q}`);res.json({items:rows.slice(0,50),hasMore:rows.length>50,page});
  }));
  router.get('/'+type+'/:id',guarded(async(req,res)=>{if(!uuid.test(req.params.id))throw invalid();const rows=await db(req,`${type}?${new URLSearchParams({select:selections[type],id:`eq.${req.params.id}`,limit:'1'})}`);if(!rows.length)return res.status(404).json({error:'Registro não encontrado.'});res.json(rows[0]);}));
  for(const method of ['post','patch'])router[method](method==='post'?'/'+type:'/'+type+'/:id',guarded(async(req,res)=>{
   const id=method==='post'?req.body?.id:req.params.id;if(!uuid.test(id))throw invalid();const revision=method==='post'?null:req.body?.revision;if(method==='patch'&&(!Number.isSafeInteger(revision)||revision<0))return res.status(428).json({error:'Reabra o registro antes de salvar.'});
   const data=validate(req.body,type==='deals'?dealSchema:activitySchema);let args={p_id:id,p_revision:revision,p_data:data};
   if(type==='deals'){
    if(!['open','won','lost'].includes(req.body.result))throw invalid();data.result=req.body.result;
    if(data.result==='lost'&&!data.lossReasonId)throw invalid('Selecione o motivo da perda.');
    const next=req.body.nextAction;let nextAction=null;if(next?.name){if(typeof next.name!=='string'||!next.name.trim()||next.name.length>300||next.typeId&&!uuid.test(next.typeId))throw invalid();nextAction={name:next.name.trim(),dueDate:date(next.dueDate),typeId:next.typeId||null};}
    const tags=req.body.tags||[];if(!Array.isArray(tags)||tags.length>50||tags.some(t=>!uuid.test(t)))throw invalid();args={...args,p_next:nextAction,p_tags:tags};
   }else data.dueDate=date(req.body.dueDate);
   const saved=await db(req,`rpc/${type==='deals'?'save_deal':'save_activity'}`,{method:'POST',body:args});res.status(method==='post'?201:200).json({id:saved});
  }));
 }
 router.post('/activities/:id/complete',guarded(async(req,res)=>{if(!uuid.test(req.params.id)||!Number.isSafeInteger(req.body?.revision)||req.body.revision<0)throw invalid();await db(req,'rpc/complete_activity',{method:'POST',body:{p_id:req.params.id,p_revision:req.body.revision}});res.json({ok:true});}));
 router.get('/clients/:id/timeline',guarded(async(req,res)=>{if(!uuid.test(req.params.id))throw invalid();const page=Math.max(0,Math.min(20000,parseInt(req.query.page,10)||0));const rows=await db(req,'rpc/client_timeline',{method:'POST',body:{p_client:req.params.id,p_offset:page*50}});res.json({items:rows.slice(0,50),hasMore:rows.length>50,page});}));
 router.post('/sales/:id/deal',guarded(async(req,res)=>{if(!uuid.test(req.params.id)||req.body?.dealId&&!uuid.test(req.body.dealId)||!Number.isSafeInteger(req.body?.revision))throw invalid();await db(req,'rpc/link_sale_deal',{method:'POST',body:{p_sale:req.params.id,p_deal:req.body.dealId||null,p_revision:req.body.revision}});res.json({ok:true});}));
 api.use('/workspace',router);
}
module.exports={registerCRM,date};
