(()=>{
 const $=id=>document.getElementById(id), form=$('reminder-form'),list=$('reminder-list'),history=$('reminder-history');
 if(!form||!list||!history)return;
 const msg=$('reminder-feedback'),pushMsg=$('push-state'),pushBtn=$('push-enable'),testBtn=$('push-test'),importBtn=$('import-local');
 let userEmail=null,subscribed=false,loading=false;
 const say=(el,s)=>{if(el)el.textContent=s;};
 const request=async(path,opts={})=>{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts,headers:{...(!['GET','HEAD'].includes((opts.method||'GET').toUpperCase())?{'Content-Type':'application/json'}:{}),...opts.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||('Erro HTTP '+response.status));
  return data;
 };
 const fmt=s=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(s));
 const decode=v=>{const s=v.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s.padEnd(Math.ceil(s.length/4)*4,'='));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
 function render(rows){
  const active=rows.filter(x=>x.status==='pending'||x.status==='processing').sort((a,b)=>a.due_at.localeCompare(b.due_at));
  const completed=rows.filter(x=>['sent','failed','cancelled'].includes(x.status)).sort((a,b)=>b.due_at.localeCompare(a.due_at));
  say($('reminder-count'),String(active.length));
  say($('reminder-history-count'),String(completed.length));
  list.replaceChildren();history.replaceChildren();
  const itemNode=r=>{
   const li=document.createElement('li'),info=document.createElement('div'),title=document.createElement('div'),date=document.createElement('div'),del=document.createElement('button');
   title.className='reminder-name';title.textContent=r.title;
   date.className='reminder-time';
   const labels={pending:'Programado',processing:'Enviando',sent:'Enviado',failed:'Falha no envio',cancelled:'Cancelado'};
   const overdue=r.status==='pending'&&Date.parse(r.due_at)<Date.now();
   date.textContent=fmt(r.due_at)+' · '+(overdue?'Aguardando envio':labels[r.status]||r.status);
   del.type='button';del.className='secondary';del.textContent='Excluir';
   del.setAttribute('aria-label','Excluir lembrete: '+r.title);
   del.addEventListener('click',async()=>{
    del.disabled=true;
    try{await request('/api/reminders/'+encodeURIComponent(r.id),{method:'DELETE',headers:{'X-KTIVAR-Request':'same-origin'}});await load();say(msg,'Lembrete excluído.');}
    catch(e){say(msg,'Não foi possível excluir: '+e.message);del.disabled=false;}
   });
   info.append(title,date);li.append(info,del);return li;
  };
  if(active.length)active.forEach(r=>list.append(itemNode(r)));
  else {const li=document.createElement('li');li.className='empty-placeholder';li.textContent='Nenhum lembrete programado.';list.append(li);}
  if(completed.length)completed.forEach(r=>history.append(itemNode(r)));
  else {const li=document.createElement('li');li.className='empty-placeholder';li.textContent='Nenhum lembrete encerrado.';history.append(li);}
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
 const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 let readyRegistration=null,publicKey=null,currentSubscription=null;
 pushBtn.disabled=true;
 testBtn.disabled=true;
 const unavailable=reason=>{
  subscribed=false;
  pushBtn.disabled=true;
  testBtn.disabled=true;
  say(pushMsg,reason);
 };
 async function updateStatus(){
  try{
   const d=await request('/api/push/status');
   const endpoints=Array.isArray(d.endpoints)?d.endpoints:[];
   subscribed=Boolean(currentSubscription&&endpoints.includes(currentSubscription.endpoint));
   testBtn.disabled=!subscribed;
   if(subscribed){
     pushBtn.textContent='Verificar registro deste iPhone';
     say(pushMsg,'Confirmado pelo servidor: este aparelho está registrado para push. Agora você pode agendar um teste remoto.');
   }else{
     pushBtn.textContent='Ativar notificações push';
     say(pushMsg,'NENHUM PUSH ATIVO NESTE APARELHO. Lembretes podem ser salvos, mas não vão aparecer fora do KTIVAR até ativar. '+(d.deviceCount?'Outros dispositivos registrados: '+d.deviceCount+'.':''));
   }
  }catch(e){
   subscribed=false;testBtn.disabled=true;
   say(pushMsg,'Não foi possível conferir o registro no servidor: '+e.message);
  }
 }
 async function preparePush(){
  if(!window.isSecureContext||!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
    unavailable('Web Push indisponível neste navegador. No iPhone, abra o KTIVAR instalado na Tela de Início.');
    return;
  }
  if(isIOS&&!installed){
    unavailable('O Safari em uma aba normal não pode habilitar este push. Abra o KTIVAR pelo ícone instalado na Tela de Início.');
    return;
  }
  try {
   // Preload configuration AND registration before the user tap.
   // Safari/iOS requires PushManager.subscribe() to run directly from a user gesture.
   const [config,registration]=await Promise.all([request('/api/push/config'),navigator.serviceWorker.ready]);
   if(!config.publicKey||!registration.pushManager)throw Error('Service Worker sem PushManager.');
   publicKey=decode(config.publicKey);
   readyRegistration=registration;
   currentSubscription=await registration.pushManager.getSubscription();
   pushBtn.disabled=false;
   await updateStatus();
   if(Notification.permission==='denied'&&!currentSubscription)
    say(pushMsg,'Notificações bloqueadas pelo iOS. Libere KTIVAR em Ajustes → Notificações e tente novamente.');
  }catch(e){unavailable('Falha ao preparar Web Push: '+e.message);}
 }
 pushBtn.addEventListener('click',()=>{
  if(!readyRegistration||!publicKey)return;
  pushBtn.disabled=true;
  // This MUST be invoked synchronously inside the tap callback, not after a fetch,
  // awaiting the current subscription, or triggering another permission flow.
  const operation=currentSubscription
    ? Promise.resolve(currentSubscription)
    : readyRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
  operation.then(async subscription=>{
    currentSubscription=subscription;
    await request('/api/push/subscribe',{method:'POST',body:JSON.stringify(subscription.toJSON())});
    await updateStatus();
  }).catch(error=>{
    subscribed=false;
    testBtn.disabled=true;
    say(pushMsg,'Falha na ativação: '+(error?.message||String(error))+'. Confira as permissões do KTIVAR no iPhone.');
  }).finally(()=>{pushBtn.disabled=false;});
 });
 testBtn.addEventListener('click',async()=>{
  testBtn.disabled=true;
  try{
   if(!subscribed)throw new Error('Primeiro ative as notificações push e confirme o registro neste aparelho.');
   const due=new Date(Date.now()+120000);
   await create('Teste remoto: KTIVAR funcionando em segundo plano',due);
   say(pushMsg,'Teste agendado para '+fmt(due)+'. Agora feche o KTIVAR e bloqueie o iPhone. Aguarde a entrega.');
   await load();
  }catch(err){say(pushMsg,err.message);}finally{testBtn.disabled=!subscribed;}
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
   await Promise.all([load(),preparePush()]);
  }catch(e){say(msg,'Sessão indisponível: '+e.message);}
 })();
})();