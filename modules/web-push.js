const {randomUUID}=require('node:crypto');
const VAPID_PUBLIC='BEKowWjpo3FCCH_V5mNXV2wvXS2MqU39LSVXy2iyd3pw1tMKW7q7HbrMH_z-oUBGuK61apiLc2iyBNXSkPKuqu4';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function safeEndpoint(value){
 if(typeof value!=='string'||value.length<25||value.length>1800)return false;
 try{
  const url=new URL(value),h=url.hostname.toLowerCase();
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.port&&
   (h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.notify.windows.com'));
 }catch{return false;}
}
function registerWebPush(api,supabase){
 const wrap=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(error){next(error);}};
 const db=(req,path,options={})=>supabase('/rest/v1/'+path,{token:req.supabaseToken,...options});
 api.get('/push/config',(req,res)=>res.json({publicKey:VAPID_PUBLIC}));
 api.get('/push/status',wrap(async(req,res)=>{
   const rows=await db(req,'ktivar_push_subscriptions?'+new URLSearchParams({user_id:'eq.'+req.authUser.id,select:'id,endpoint,created_at',limit:'20'}));
   res.json({deviceCount:rows.length,endpoints:rows.map(x=>x.endpoint)});
 }));
 api.post('/push/subscribe',wrap(async(req,res)=>{
   const sub=req.body||{},endpoint=sub.endpoint,p256dh=sub.keys?.p256dh,authKey=sub.keys?.auth;
   if(!safeEndpoint(endpoint)||typeof p256dh!=='string'||p256dh.length<60||p256dh.length>300||
       typeof authKey!=='string'||authKey.length<12||authKey.length>300)
      return res.status(400).json({error:'Assinatura de notificações inválida.'});
   const existing=await db(req,'ktivar_push_subscriptions?'+new URLSearchParams({user_id:'eq.'+req.authUser.id,endpoint:'eq.'+endpoint,select:'id'}));
   if(existing.length)return res.json({ok:true,id:existing[0].id});
   const rows=await db(req,'ktivar_push_subscriptions?select=id',{method:'POST',body:{user_id:req.authUser.id,endpoint,p256dh,auth_key:authKey},prefer:'return=representation'});
   res.status(201).json({ok:true,id:rows[0]?.id||null});
 }));
 api.delete('/push/subscribe',wrap(async(req,res)=>{
   const endpoint=req.body?.endpoint;
   if(!safeEndpoint(endpoint))return res.status(400).json({error:'Assinatura inválida.'});
   await db(req,'ktivar_push_subscriptions?'+new URLSearchParams({endpoint:'eq.'+endpoint,user_id:'eq.'+req.authUser.id}),{method:'DELETE'});
   res.json({ok:true});
 }));
 api.get('/reminders',wrap(async(req,res)=>{
   const rows=await db(req,'ktivar_reminders?'+new URLSearchParams({user_id:'eq.'+req.authUser.id,select:'id,title,due_at,status,created_at,sent_at',order:'due_at.asc',limit:'100'}));
   res.json(rows);
 }));
 api.post('/reminders',wrap(async(req,res)=>{
   const title=typeof req.body?.title==='string'?req.body.title.trim():'',date=req.body?.due_at;
   const when=typeof date==='string'?Date.parse(date):NaN;
   if(!title||title.length>120||!Number.isFinite(when)||when<Date.now()+20000||when>Date.now()+366*86400000)
       return res.status(400).json({error:'Informe um título e uma data futura válida (até um ano).'});
   const rows=await db(req,'ktivar_reminders?select=id,title,due_at,status',{method:'POST',body:{user_id:req.authUser.id,title,due_at:new Date(when).toISOString()},prefer:'return=representation'});
   res.status(201).json(rows[0]);
 }));
 api.delete('/reminders/:id',wrap(async(req,res)=>{
   if(!uuid.test(req.params.id))return res.status(400).json({error:'Identificador inválido.'});
   await db(req,'ktivar_reminders?'+new URLSearchParams({id:'eq.'+req.params.id,user_id:'eq.'+req.authUser.id}),{method:'DELETE'});
   res.json({ok:true});
 }));
}
module.exports={registerWebPush,safeEndpoint,VAPID_PUBLIC};
