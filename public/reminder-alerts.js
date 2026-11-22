// Checks device-local reminders while an authenticated KTIVAR page is visible.
// No remote scheduler, no background execution, and no external credentials.
(()=>{
 let key=null,busy=false;
 const read=()=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return [];}};
 const save=items=>{try{localStorage.setItem(key,JSON.stringify(items));return true;}catch{return false;}};
 async function show(item){
   if('Notification' in window&&Notification.permission==='granted'&&'serviceWorker' in navigator&&window.isSecureContext){
     try{const sw=await navigator.serviceWorker.ready;await sw.showNotification('KTIVAR · Lembrete',{body:item.title,tag:'ktivar-reminder-'+item.id,icon:'/assets/pwa/icon-192.png',data:{url:'/notifications'}});return;}
     catch{/* Show the in-app notice instead. */}
   }
   const node=document.createElement('aside');
   node.setAttribute('role','status');
   node.style.cssText='position:fixed;z-index:9999;bottom:84px;right:18px;left:auto;max-width:340px;padding:15px;background:#142e5f;color:white;border:1px solid #648ade;border-radius:14px;box-shadow:0 10px 28px #0004;';
   const msg=document.createElement('strong');msg.textContent='Lembrete: '+item.title;
   const a=document.createElement('a');a.href='/notifications';a.textContent='Ver notificações';a.style.cssText='display:block;color:#b5d2ff;margin-top:10px';
   const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.style.cssText='margin-top:8px;padding:6px 10px';
   close.addEventListener('click',()=>node.remove());node.append(msg,a,close);document.body.append(node);
 }
 async function scan(){
   if(busy||!key||document.visibilityState==='hidden')return;
   busy=true;
   try{
     const list=read(),due=list.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.when==='string'&&x.done===false&&Date.parse(x.when)<=Date.now());
     if(due.length){
       for(const item of due)item.done=true;
       if(save(list)){for(const item of due.slice(0,5))await show(item);}
     }
   }finally{busy=false;}
 }
 (async()=>{
  try{
    const response=await fetch('/api/session',{cache:'no-store'});
    if(!response.ok)return;
    const json=await response.json();if(typeof json.email!=='string'||!json.email)return;
    key='ktivar.reminders.v1.'+encodeURIComponent(json.email.toLowerCase());
    scan();setInterval(scan,15000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan();});
  }catch{/* A reminder checker must never disrupt the application's normal flow. */}
 })();
})();
