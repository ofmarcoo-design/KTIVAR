const {randomUUID}=require('node:crypto');
function registerStatuses(api,supabase) {
 api.get('/plate-statuses',async(req,res,next)=>{
  try {res.json(await supabase('/rest/v1/plate_statuses?select=*&order=position.asc,name.asc',{token:req.supabaseToken}));} catch(e){next(e);}
 });
 for(const method of ['post','patch']) api[method](method==='post'?'/plate-statuses':'/plate-statuses/:id',async(req,res,next)=>{
  if(method==='patch'&&!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(400).json({error:'Status inválido.'});
  const b=req.body||{};
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!/^#[0-9a-f]{6}$/i.test(b.color)||!Number.isInteger(b.position)||b.position<0||b.position>100000||typeof b.enabled!=='boolean')return res.status(400).json({error:'Confira nome, cor, ordem e disponibilidade.'});
  const values={name:b.name.trim(),color:b.color,position:b.position,enabled:b.enabled};
  if(method==='post'){values.key=`s_${randomUUID().replaceAll('-','')}`;values.redirects=b.redirects===true;}
  else if(b.redirects!==undefined)return res.status(400).json({error:'Use a ação específica para habilitar o redirect.'});
  const query=new URLSearchParams({select:'*'});if(method==='patch')query.set('id',`eq.${req.params.id}`);
  try{const rows=await supabase(`/rest/v1/plate_statuses?${query}`,{token:req.supabaseToken,method:method.toUpperCase(),body:values,prefer:'return=representation'});if(!rows.length)return res.status(404).json({error:'Status não encontrado.'});res.status(method==='post'?201:200).json(rows[0]);}catch(e){next(e);}
 });
 api.patch('/plate-statuses/:id/redirect',async(req,res,next)=>{
  if(!/^[0-9a-f-]{36}$/i.test(req.params.id)||typeof req.body?.redirects!=='boolean'||req.body?.confirmed!==true)return res.status(400).json({error:'Confirme a mudança que afeta todas as placas deste status.'});
  try{const rows=await supabase(`/rest/v1/plate_statuses?${new URLSearchParams({id:`eq.${req.params.id}`,select:'*'})}`,{token:req.supabaseToken,method:'PATCH',body:{redirects:req.body.redirects},prefer:'return=representation'});if(!rows.length)return res.status(404).json({error:'Status não encontrado.'});res.json(rows[0]);}catch(e){next(e);}
 });
}
module.exports={registerStatuses};
