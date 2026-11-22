
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL');
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const push=(webpush as any).default??webpush;
const encoder=new TextEncoder();
const maxAttempts=8;
function allowedEndpoint(value:string){
 try {const u=new URL(value);const h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.port===''&&
 (h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.notify.windows.com'));}
 catch{return false;}
}
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!SUPABASE_URL||!SERVICE_KEY)return new Response('Missing server configuration',{status:503});
 const client=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get('x-ktivar-cron-token')||'';
 if(token.length<30||token.length>140)return new Response('Unauthorized',{status:401});
 const {data:cfg,error:cfgError}=await client.from('ktivar_push_dispatch_config').select('name,value').in('name',['dispatch_token_sha256','vapid_public','vapid_private']);
 if(cfgError||!cfg||cfg.length!==3)return new Response('Dispatch not configured',{status:503});
 const config=Object.fromEntries(cfg.map(x=>[x.name,x.value]));
 const hash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(token)));
 if(hash!==config.dispatch_token_sha256)return new Response('Unauthorized',{status:401});
 push.setVapidDetails('https://ktivar.kimzan.com.br',config.vapid_public,config.vapid_private);
 const {data:rows,error:claimError}=await client.rpc('ktivar_claim_due_reminders',{p_limit:20});
 if(claimError)return new Response(JSON.stringify({error:'Unable to claim reminders'}),{status:503,headers:{'content-type':'application/json'}});
 let processed=0,sent=0,retried=0;
 for(const item of rows||[]){
   const {data:subs,error:subsError}=await client.from('ktivar_push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id',item.user_id).limit(12);
   let successes=0;
   if(!subsError&&Array.isArray(subs)){
    for(const sub of subs){
     if(!allowedEndpoint(sub.endpoint))continue;
     try {
      await push.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify({title:'KTIVAR · Lembrete',body:item.title,url:'/notifications'}),{TTL:86400,urgency:'normal'});
      successes++;
     }catch(error){
      const status=Number((error as {statusCode?:number})?.statusCode||0);
      if(status===404||status===410)await client.from('ktivar_push_subscriptions').delete().eq('id',sub.id);
     }
    }
   }
   const done=successes>0;
   const terminal=Number(item.attempts)>=maxAttempts;
   const next=done?'sent':terminal?'failed':'pending';
   const update:any={status:next,claimed_at:null};
   if(done)update.sent_at=new Date().toISOString();
   else if(!terminal)update.next_attempt_at=new Date(Date.now()+Math.min(60,Math.max(2,item.attempts*5))*60000).toISOString();
   const {error:updateError}=await client.from('ktivar_reminders').update(update).eq('id',item.id).eq('status','processing');
   if(updateError)console.error('Reminder status update failed',item.id);
   processed++;if(done)sent++;else retried++;
 }
 return Response.json({ok:true,processed,sent,retried});
});
