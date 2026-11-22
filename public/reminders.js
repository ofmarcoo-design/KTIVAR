(()=>{
 const $=id=>document.getElementById(id), form=$('reminder-form'),list=$('reminder-list');
 if(!form||!list)return;
 const msg=$('reminder-feedback'),pushMsg=$('push-state'),pushBtn=$('push-enable'),testBtn=$('push-test'),importBtn=$('import-local');
 let userEmail=null,subscribed=false,loading=false;
 const say=(el,s)=>{if(el)el.textContent=s;};
 const request=async(path,opts={})=>{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts,headers:{...(opts.body?{'Content-Type':'application/json'}:{}),...opts.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||('Erro HTTP '+response.status));
  return data;
 };
 const fmt=s=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(s));
 const decode=v=>{const s=v.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s.padEnd(Math.ceil(s.length/4)*4,'='));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
 function render(rows){
  const items=rows.filter(x=>x.status==='pending'||x.status==='processing'||x.status==='failed').sort((a,b)=>a.due_at.localeCompare(b.due_at));
  say($('reminder-count'),String(items.length));list.replaceChildren();
  if(!items.length){const li=document.createElement('li');li.className='empty-placeholder';li.textContent='Nenhum lembrete pendente.';list.append(li);return;}
  for(const r of items){
   const li=document.createElement('li'),info=document.createElement('div'),title=document.createElement('div'),date=document.createElement('div'),del=document.createElement('button');
   title.className='reminder-name';title.textContent=r.title;
   date.className='reminder-time';date.textContent=fmt(r.due_at)+(r.status==='failed'?' · Falha no envio':r.status==='processing'?' · Enviando…':'');
   del.type='button';del.className='secondary';del.textContent='Excluir';
   del.addEventListener('click',async()=>{del.disabled=true;try{await request('/api/reminders/'+encodeURIComponent(r.id),{method:'DELETE'});await load();say(msg,'Lembrete excluído.');}catch(e){say(msg,e.message);del.disabled=false;}});
   info.append(title,date);li.append(info,del);list.append(li);
  }
 }
 async function load(){
  try{render(await request('/api/reminders'));}catch(e){say(msg,'Não foi possível carregar os lembretes: '+e.message);}
 }
 async function create(title,due){
  return request('/api/reminders',{method:'POST',body:JSON.stringify({title,due_at:new Date(due).toISOString()})});
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();const title=$('reminder-title').value.trim(),due=new Date($('reminder-date').value);
  if(!title||!Number.isFinite(due.getTime())||due.getTime()<Date.now()+20000){say(msg,'Informe título e horário futuro válido.');return;}
  const btn=$('reminder-add');btn.disabled=true;
  try{await create(title,due);form.reset();say(msg,'Lembrete salvo na sua conta.'+(subscribed?' O iPhone pode recebê-lo mesmo fechado.':' Ative o push no iPhone para receber fora do aplicativo.'));await load();}
  catch(err){say(msg,err.message);}finally{btn.disabled=false;}
 });
 const installed=window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
 async function updateStatus(){
  try{
   const d=await request('/api/push/status');
   subscribed=Boolean(d.subscribed);
   say(pushMsg,subscribed?'Dispositivo registrado: '+d.deviceCount+' inscrição(ões) na conta.':'Nenhum dispositivo habilitado nesta conta.');
   if(subscribed)pushBtn.textContent='Registrar este dispositivo novamente';
  }catch(e){say(pushMsg,'Status indisponível: '+e.message);}
 }
 pushBtn.addEventListener('click',async()=>{
  if(!window.isSecureContext||!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
    say(pushMsg,'Este navegador não oferece Web Push. Abra o KTIVAR instalado na Tela de Início do iPhone.');return;
  }
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!installed){
    say(pushMsg,'No iPhone, abra pelo ícone instalado na Tela de Início (não pela aba do Safari).');return;
  }
  pushBtn.disabled=true;
  try{
   const perm=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
   if(perm!=='granted')throw new Error('Permissão não concedida. Verifique Ajustes → Notificações → KTIVAR.');
   const config=await request('/api/push/config'),sw=await navigator.serviceWorker.ready;
   let subscription=await sw.pushManager.getSubscription();
   if(!subscription)subscription=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(config.publicKey)});
   try{await request('/api/push/subscribe',{method:'POST',body:JSON.stringify(subscription.toJSON())});}
   catch(error){await subscription.unsubscribe().catch(()=>{});throw error;}
   subscribed=true;say(pushMsg,'Push habilitado neste dispositivo. Agora programe um teste e feche o KTIVAR.');await updateStatus();
  }catch(err){say(pushMsg,'Não foi possível ativar: '+err.message);}finally{pushBtn.disabled=false;}
 });
 testBtn.addEventListener('click',async()=>{
  testBtn.disabled=true;
  try{
   if(!subscribed)throw new Error('Ative as notificações push neste dispositivo primeiro.');
   const due=new Date(Date.now()+120000);
   await create('Teste remoto: KTIVAR funcionando em segundo plano',due);
   say(pushMsg,'Teste agendado para '+fmt(due)+'. Feche o KTIVAR e bloqueie o iPhone. A entrega pode atrasar.');
   await load();
  }catch(err){say(pushMsg,err.message);}finally{testBtn.disabled=false;}
 });
 importBtn.addEventListener('click',async()=>{
  if(!userEmail){say(msg,'Sua sessão precisa estar ativa.');return;}
  importBtn.disabled=true;
  try{
   const key='ktivar.reminders.v1.'+encodeURIComponent(userEmail.toLowerCase());
   let items;
   try{items=JSON.parse(localStorage.getItem(key)||'[]');}catch{items=[];}
   if(!Array.isArray(items))items=[];
   const valid=items.filter(x=>x&&x.done===false&&typeof x.title==='string'&&Number.isFinite(Date.parse(x.when))&&Date.parse(x.when)>Date.now()+20000).slice(0,50);
   let imported=0;
   for(const r of valid){try{await create(r.title,new Date(r.when));imported++;r.done=true;}catch{/* Keep unsuccessful local reminders intact. */}}
   try{localStorage.setItem(key,JSON.stringify(items));}catch{/* Existing local data remains untouched. */}
   say(msg,imported+' lembrete(s) importado(s) para sua conta.');await load();
  }finally{importBtn.disabled=false;}
 });
 (async()=>{
  try{
   const session=await request('/api/session');userEmail=typeof session.email==='string'?session.email:null;
   await Promise.all([load(),updateStatus()]);
  }catch(e){say(msg,'Sessão indisponível: '+e.message);}
 })();
})();