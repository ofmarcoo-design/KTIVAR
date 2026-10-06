(()=>{
 const $=selector=>document.querySelector(selector);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const analytics=location.pathname==='/analytics';let sequence=0;
 const number=value=>new Intl.NumberFormat('pt-BR').format(value);
 const link=(label,href,className)=>{const node=el('a',label,className);node.href=href;return node;};
 $('#overview-title').textContent=analytics?'Analytics':'Dashboard';
 $('#overview-description').textContent=analytics?'Acessos registrados às URLs permanentes das placas.':'Indicadores, pendências e próximos passos da operação.';
 document.title=(analytics?'Analytics':'Dashboard')+' · KTIVAR';document.body.classList.toggle('analytics-page',analytics);
 $('#overview-metrics').hidden=analytics;$('#scan-section').hidden=!analytics;$('#attention').hidden=analytics;$('#shortcuts-section').hidden=analytics;
 async function api(route,options={}){
  const response=await fetch('/api'+route,{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});
  if([401,403].includes(response.status)){location.assign('/login');throw Error('Entre novamente para continuar.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'Dados indisponíveis. Tente atualizar novamente.');return data;
 }
 function metrics(data){
  $('#overview-metrics').replaceChildren();
  for(const [label,value,href,note] of [
   ['Clientes cadastrados',data.clients,'/manage?module=clients','Cadastros disponíveis para consulta'],
   ['Placas ativas',data.active,'/plates?active=true',`${number(data.plates)} placas cadastradas no total`],
   ['Acessos em 30 dias',data.scans.days30,'/analytics','Acessos registrados, incluindo repetições']
  ]){const card=el('article',undefined,'record-card metric-card');card.append(el('h2',label),el('p',number(value),'metric-value'),el('small',note));const anchor=link('',href);anchor.append(card);$('#overview-metrics').append(anchor);}
  $('#scan-metrics').replaceChildren();
  for(const [key,label] of [['today','Hoje'],['days7','Últimos 7 dias'],['days30','Últimos 30 dias'],['total','Total']]){
   const metric=el('div',undefined,key==='days30'?'featured-metric':'');metric.append(el('strong',number(data.scans[key])),el('span',label));$('#scan-metrics').append(metric);
  }
 }
 function attention(data,activities){
  const panel=$('#attention');panel.replaceChildren(el('h2','Precisa de atenção'));let count=0;
  const item=(title,description,label,href,tone)=>{const row=el('div',undefined,'attention-item');const detail=el('div');detail.append(el('span',title,'badge '+tone),el('small',description));row.append(detail,link(label,href));panel.append(row);count++;};
  if(data.stock)item(`${number(data.stock)} ${data.stock===1?'placa em estoque':'placas em estoque'}`,'Vincule cliente e destino antes de ativar.','Vincular placas','/plates?status=stock','warning');
  if(activities.status==='fulfilled'&&activities.value){const result=activities.value;if(result.items.length)item(`${number(result.items.length)}${result.hasMore?'+':''} ${result.items.length===1&&!result.hasMore?'atividade atrasada':'atividades atrasadas'}`,'Revise as próximas ações com data vencida.','Ver atividades','/manage?module=activities&mode=overdue','danger');}
  if(activities.status==='pending')panel.append(el('p','Consultando atividades atrasadas…','scan-note'));
  else if(activities.status==='rejected')panel.append(el('p','Não foi possível consultar atividades atrasadas. ', 'scan-note'),link('Consultar atividades','/manage?module=activities&mode=overdue'));
  else if(!count)panel.append(el('p','Nenhuma placa em estoque ou atividade atrasada encontrada.','muted'));
 }
 function recent(data){
  $('#recent').replaceChildren();
  const names={plates:'Placa',clients:'Cliente',products:'Produto',contacts:'Contato',sales:'Venda',deals:'Negociação',activities:'Atividade',plate_statuses:'Status',application_settings:'Configuração',plate_batches:'Lote'};
  const modules={clients:'clients',products:'products',sales:'sales',deals:'deals',activities:'activities'};
  for(const item of data.recent){
   const name=names[item.entity]||'Cadastro';const created=item.operation==='INSERT';const feminine=['Placa','Venda','Negociação','Atividade','Configuração'].includes(name);
   const title=`${name}${item.entity==='plates'?' '+item.entityId:''} ${created?(item.entity==='sales'?'registrada':feminine?'criada':'criado'):feminine?'atualizada':'atualizado'}`;
   let href;if(item.entity==='plates'&&/^PL-\d{6}$/.test(item.entityId))href='/plates?code='+item.entityId;
   else if(modules[item.entity]&&/^[0-9a-f-]{36}$/i.test(item.entityId))href='/manage?'+new URLSearchParams({module:modules[item.entity],id:item.entityId});
   const row=href?link('',href,'activity-row'):el('div',undefined,'activity-row');const detail=el('div');detail.append(el('p',title),el('small',KTIVAR.formatDateTime(item.createdAt)));row.append(el('span',undefined,'activity-dot'),detail);$('#recent').append(row);
  }
  if(!data.recent.length)$('#recent').append(el('p','Cadastros e alterações recentes aparecerão aqui.','empty-state'));
  $('#top-plates').replaceChildren();
  for(const plate of data.topPlates){const row=link('','/plates?code='+encodeURIComponent(plate.code),'activity-row');const detail=el('div');detail.append(el('p',plate.code),el('small',plate.name||'Sem cliente'));row.append(detail,el('strong',number(plate.count)));$('#top-plates').append(row);}
  if(!data.topPlates.length)$('#top-plates').append(el('p','Ainda não há acessos nos últimos 30 dias.','empty-state'));
 }
 async function load(){
  const id=++sequence;const done=KTIVAR.busy($('#reload'),'Atualizando…');$('#message').dataset.tone='info';$('#message').textContent='Consultando sua operação…';$('#overview-metrics').setAttribute('aria-busy','true');
  try{
   const activities=analytics?null:api('/workspace/activities?mode=overdue&page=0').then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
   const overview=await api('/overview');if(id!==sequence)return;
   metrics(overview);recent(overview);$('#message').textContent='';
   if(!analytics){attention(overview,{status:'pending'});$('#attention').setAttribute('aria-busy','true');activities.then(result=>{if(id===sequence){attention(overview,result);$('#attention').removeAttribute('aria-busy');}});}
  }catch(error){if(id===sequence){$('#message').dataset.tone='danger';$('#message').textContent=error.message;}}
  finally{done();$('#overview-metrics').removeAttribute('aria-busy');}
 }
 $('#reload').addEventListener('click',load);
 $('#logout').addEventListener('click',async()=>{const done=KTIVAR.busy($('#logout'),'Saindo…');try{await api('/logout',{method:'POST',body:'{}'});location.assign('/login');}catch(error){$('#message').dataset.tone='danger';$('#message').textContent=error.message;}finally{done();}});
 api('/session').then(data=>$('#email').textContent=data.email).catch(error=>$('#message').textContent=error.message);load();
})();
