const {date}=require('./crm');
function registerReports(api,supabase){
 api.get('/workspace/reports',async(req,res,next)=>{try{const from=date(req.query.from),to=date(req.query.to);if(to<from||Date.parse(to)-Date.parse(from)>3659*86400000)return res.status(400).json({error:'Escolha um período de até dez anos.'});res.json(await supabase('/rest/v1/rpc/workspace_report',{token:req.supabaseToken,method:'POST',body:{p_from:from,p_to:to}}));}catch(e){next(e);}});
 api.get('/workspace/backup',async(req,res,next)=>{try{const data=await supabase('/rest/v1/rpc/workspace_backup',{token:req.supabaseToken,method:'POST',body:{}});res.attachment(`ktivar-backup-${new Date().toISOString().slice(0,10)}.json`);res.json(data);}catch(e){next(e);}});
}
module.exports={registerReports};
