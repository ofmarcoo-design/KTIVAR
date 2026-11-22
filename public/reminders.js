(()=>{
  const byId=id=>document.getElementById(id);
  const form=byId('reminder-form'), list=byId('reminder-list');
  if(!form||!list)return;
  const title=byId('reminder-title'),when=byId('reminder-date'),message=byId('reminder-feedback'),count=byId('reminder-count');
  const monitor=byId('monitor-state'),last=byId('monitor-last'),database=byId('database-state'),refresh=byId('automation-refresh'),automationFeedback=byId('automation-feedback');
  let storageKey=null,reminders=[],scanBusy=false;
  const maxReminders=50;
  const setText=(el,value)=>{if(el)el.textContent=value;};
  const fmt=iso=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
  const escapeKey=email=>'ktivar.reminders.v1.'+encodeURIComponent(email.toLowerCase());
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.when==='string'&&typeof x.done==='boolean').slice(0,maxReminders):[];}catch{return [];}};
  const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(reminders));return true;}catch{setText(message,'Não foi possível salvar neste aparelho. Verifique o armazenamento do navegador.');return false;}};
  const button=(label,onClick)=>{const node=document.createElement('button');node.type='button';node.className='secondary';node.textContent=label;node.addEventListener('click',onClick);return node;};
  const render=()=>{
    list.replaceChildren();
    const pending=reminders.filter(x=>!x.done).sort((a,b)=>a.when.localeCompare(b.when));
    setText(count,String(pending.length));
    if(!pending.length){const li=document.createElement('li');li.className='empty-placeholder';li.textContent='Nenhum lembrete programado.';list.append(li);return;}
    for(const item of pending){
      const li=document.createElement('li'),content=document.createElement('div'),name=document.createElement('div'),date=document.createElement('div');
      name.className='reminder-name';name.textContent=item.title;date.className='reminder-time';
      date.textContent=fmt(item.when)+(Date.parse(item.when)<Date.now()?' · Vencido':'');
      content.append(name,date);
      li.append(content,button('Excluir',()=>{reminders=reminders.filter(x=>x.id!==item.id);persist();render();setText(message,'Lembrete excluído.');}));
      list.append(li);
    }
  };
  const notify=async item=>{
    if(!window.isSecureContext||!('Notification' in window)||Notification.permission!=='granted'||!('serviceWorker' in navigator))return false;
    try{
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification('KTIVAR · Lembrete',{body:item.title,icon:'/assets/pwa/icon-192.png',tag:'ktivar-reminder-'+item.id,data:{url:'/notifications'}});
      return true;
    }catch{return false;}
  };
  const scan=async()=>{
    if(scanBusy||!storageKey||document.visibilityState==='hidden')return;
    scanBusy=true;
    try{
      const due=reminders.filter(x=>!x.done&&Date.parse(x.when)<=Date.now());
      if(due.length){
        for(const item of due){item.done=true;const shown=await notify(item);setText(message,shown?'Lembrete disparado: '+item.title:'Lembrete vencido: '+item.title+' (aviso somente nesta tela).');}
        persist();render();
      }
    }finally{scanBusy=false;}
  };
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(!storageKey){setText(message,'É necessário estar conectado para salvar lembretes.');return;}
    const label=title.value.trim(),at=new Date(when.value),now=Date.now();
    if(label.length<1||label.length>120||!Number.isFinite(at.getTime())||at.getTime()<=now+5000){setText(message,'Informe um título e um horário futuro válido.');return;}
    if(reminders.filter(x=>!x.done).length>=maxReminders){setText(message,'Limite de 50 lembretes ativos neste dispositivo.');return;}
    reminders.push({id:crypto.randomUUID(),title:label,when:at.toISOString(),done:false});
    if(persist()){form.reset();render();setText(message,'Lembrete salvo neste dispositivo. O aviso funciona enquanto o KTIVAR estiver aberto.');}
  });
  const state=(el,label,kind)=>{if(!el)return;el.className='state-pill '+(kind==='ok'?'state-good':kind==='bad'?'state-bad':'muted-pill');setText(el,label);};
  async function refreshStatus(){
    refresh.disabled=true;setText(automationFeedback,'Consultando informações públicas do monitor e a API do KTIVAR…');
    const [a,b]=await Promise.allSettled([
      fetch('/api/automations/status',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}),
      fetch('/health/database?status='+Date.now(),{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();})
    ]);
    if(a.status==='fulfilled'&&a.value.monitor){
      const run=a.value.monitor;
      state(monitor,run.state==='success'?'Última execução aprovada':run.state==='running'?'Em execução':'Última execução falhou',run.state==='success'?'ok':run.state==='failed'?'bad':'neutral');
      setText(last,run.completedAt?'Último registro do GitHub: '+fmt(run.completedAt)+'.':'Histórico disponível no GitHub.');
    }else{state(monitor,'Sem confirmação recente','neutral');setText(last,'Consulte o histórico para confirmar a última execução.');}
    if(b.status==='fulfilled'&&b.value.database==='online')state(database,'Banco respondeu agora','ok');
    else state(database,'Banco indisponível ou sem verificação','bad');
    setText(automationFeedback,'O monitor externo e o cron interno são processos distintos; esta página não dispara nem modifica nenhum deles.');
    refresh.disabled=false;
  }
  refresh?.addEventListener('click',refreshStatus);
  (async()=>{
    try{
      const response=await fetch('/api/session',{cache:'no-store'});
      if(!response.ok)throw Error();
      const user=await response.json();
      if(!user.email||typeof user.email!=='string')throw Error();
      storageKey=escapeKey(user.email);
      reminders=read();render();scan();setInterval(scan,15000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan();});
    }catch{
      setText(message,'Não foi possível confirmar sua sessão. Entre novamente no KTIVAR.');
      byId('reminder-add').disabled=true;
      list.replaceChildren();const li=document.createElement('li');li.textContent='Lembretes indisponíveis sem sessão.';list.append(li);
    }
  })();
  refreshStatus();
})();