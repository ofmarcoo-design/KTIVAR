(()=>{
 const $=selector=>document.querySelector(selector);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const analytics=location.pathname==='/analytics';let sequence=0;
 const number=value=>new Intl.NumberFormat('pt-BR').format(value);
 const link=(label,href,className)=>{const node=el('a',label,className);node.href=href;return node;};
 $('#overview-title').textContent=analytics?'Analytics':'Dashboard';
 $('#overview-description').textContent=analytics?'Acessos registrados às URLs permanentes das placas.':'Acompanhe os indicadores, o desempenho e as atividades da sua operação.';
 document.title=(analytics?'Analytics':'Dashboard')+' · KTIVAR';document.body.classList.toggle('analytics-page',analytics);
 for(const selector of ['#operations-section','#commercial-section','#attention','#shortcuts-section'])$(selector).hidden=analytics;
 async function api(route,options={}){
  const response=await fetch('/api'+route,{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});
  if([401,403].includes(response.status)){location.assign('/login');throw Error('Entre novamente para continuar.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'Dados indisponíveis. Tente atualizar novamente.');return data;
 }
 function metrics(data){
  $('#overview-metrics').replaceChildren();
  for(const [label,value,href,note,icon] of [
   ['Clientes cadastrados',data.clients,'/manage?module=clients','Cadastros disponíveis para consulta','clients'],
   ['Placas ativas',data.active,'/plates?active=true',`${number(data.plates)} placas cadastradas no total`,'active'],
   ['Placas em estoque',data.stock,'/plates?status=stock','Disponíveis para vincular cliente e destino','stock'],
   ['Acessos em 30 dias',data.scans.days30,'/analytics','Acessos registrados, incluindo repetições','access']
  ]){const card=el('article',undefined,'record-card metric-card');
   const head=el('div',undefined,'dashboard-kpi-top');
   const badge=el('span',undefined,'kpi-icon');badge.setAttribute('aria-hidden','true');
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
   const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',({clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',active:'m12 2 9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 17l9 5 9-5',stock:'M3 7l9-4 9 4v10l-9 4-9-4V7z M3 7l9 5 9-5 M12 12v9',access:'M4 4l6 17 3-7 7-3L4 4z'})[icon]||'M4 4h16v16H4z');svg.append(path);badge.append(svg);
   const text=el('div',undefined,'kpi-copy');text.append(el('h2',label),el('p',number(value),'metric-value'));
   head.append(badge,text);card.append(head,el('small',note));const anchor=link('',href);anchor.append(card);$('#overview-metrics').append(anchor);}
  $('#scan-metrics').replaceChildren();
  for(const [key,label] of [['today','Hoje'],['days7','Últimos 7 dias'],['days30','Últimos 30 dias'],['total','Total']]){
   const metric=el('div',undefined,key==='days30'?'featured-metric':'');metric.append(el('strong',number(data.scans[key])),el('span',label));$('#scan-metrics').append(metric);
  }
  const scale=$('#access-scale');
  if(scale){
   scale.replaceChildren();
   const maximum=Math.max(1,Number(data.scans.days30)||0,Number(data.scans.days7)||0,Number(data.scans.today)||0);
   for(const [key,label] of [['today','Hoje'],['days7','Últimos 7 dias'],['days30','Últimos 30 dias']]){
    const row=el('div',undefined,'access-scale-row');
    const head=el('div',undefined,'access-scale-label');
    head.append(el('span',label),el('strong',number(data.scans[key])));
    const track=el('div',undefined,'access-scale-track');track.setAttribute('role','img');track.setAttribute('aria-label',label+': '+number(data.scans[key])+' acessos registrados');
    const fill=el('span',undefined,'access-scale-fill');fill.style.width=(Math.max(0,Number(data.scans[key])||0)/maximum*100)+'%';
    track.append(fill);row.append(head,track);scale.append(row);
   }
  }
 }
 function attention(data,activities){
  const panel=$('#attention');panel.replaceChildren(el('h2','Precisa de atenção'));let count=0;
  const item=(title,description,label,href,tone)=>{const row=el('div',undefined,'attention-item');const detail=el('div');detail.append(el('span',title,'badge '+tone),el('small',description));row.append(detail,link(label,href));panel.append(row);count++;};
  if(activities.status==='fulfilled'&&activities.value){const result=activities.value;if(result.items.length)item(`${number(result.items.length)}${result.hasMore?'+':''} ${result.items.length===1&&!result.hasMore?'atividade atrasada':'atividades atrasadas'}`,'Revise as próximas ações com data vencida.','Ver atividades','/manage?module=activities&mode=overdue','danger');}
  if(activities.status==='fulfilled'&&activities.value)for(const activity of activities.value.items.slice(0,4)){const row=link('', '/manage?'+new URLSearchParams({module:'activities',id:activity.id}), 'activity-row');const detail=el('div');row.title=activity.name;detail.append(el('p',activity.name),el('small',activity.client?.name||'Cliente'),el('small',`Venceu em ${activity.dueDate.split('-').reverse().join('/')}`));row.append(detail);panel.append(row);}
  if(activities.status==='pending')panel.append(el('p','Consultando atividades atrasadas…','scan-note'));
  else if(activities.status==='rejected')panel.append(el('p','Não foi possível consultar atividades atrasadas. ', 'scan-note'),link('Consultar atividades','/manage?module=activities&mode=overdue'));
  else if(!count)panel.append(el('p','Nenhuma atividade atrasada encontrada.','muted'));
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
  const maxCount=Math.max(1,...data.topPlates.map(plate=>Number(plate.count)||0));
  for(const [index,plate] of data.topPlates.entries()){
   const row=link('','/plates?code='+encodeURIComponent(plate.code),'ranked-plate');
   const top=el('div',undefined,'ranked-plate-main');
   const position=el('span',String(index+1).padStart(2,'0'),'ranked-plate-index');
   const detail=el('div',undefined,'ranked-plate-detail');
   detail.append(el('strong',plate.code),el('span',plate.name||'Sem cliente'));
   const count=el('strong',number(plate.count),'ranked-plate-count');count.title=number(plate.count)+' acessos';
   top.append(position,detail,count);
   const track=el('div',undefined,'ranked-plate-track');
   track.setAttribute('role','img');
   track.setAttribute('aria-label',plate.code+': '+number(plate.count)+' acessos nos últimos 30 dias');
   const fill=el('span',undefined,'ranked-plate-fill');
   fill.style.width=(Math.max(0,Number(plate.count)||0)/maxCount*100)+'%';
   track.append(fill);
   row.append(top,track);
   $('#top-plates').append(row);
  }
  if(!data.topPlates.length)$('#top-plates').append(el('p','Ainda não há acessos nos últimos 30 dias.','empty-state'));
 }
 const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
 function commercial(data){
  const panel=$('#commercial');panel.replaceChildren(el('p',`Mês até hoje · ${data.from.split('-').reverse().join('/')} a ${data.to.split('-').reverse().join('/')}`,'scan-note'));
  const stats=el('div',undefined,'summary-stats');
  for(const [label,value,href] of [['Vendas confirmadas',number(data.current.confirmedSales),'/manage?module=sales'],['Valor confirmado',money(data.current.salesCents),'/reports'],['Clientes compradores',number(data.current.purchasingClients),'/manage?module=clients']]){const card=link('',href,'metric-card');card.append(el('small',label),el('p',value,'metric-value'));stats.append(card);}panel.append(stats);
  panel.append(el('p',`Intervalo anterior (${data.previousFrom.split('-').reverse().join('/')} a ${data.previousTo.split('-').reverse().join('/')}): ${money(data.previous.salesCents)} em ${number(data.previous.confirmedSales)} vendas. Canceladas não entram nos resultados.`,'scan-note'),el('h3','Produtos com vendas no período'));
  for(const product of data.products.slice(0,3)){const row=link('', '/manage?'+new URLSearchParams({module:'products',id:product.id}),'activity-row');const detail=el('div');row.title=product.name;detail.append(el('p',product.name),el('small',`${number(product.quantity)} unidades vendidas`));row.append(detail,el('strong',money(product.salesCents)));panel.append(row);}
  if(!data.products.length)panel.append(el('p','Nenhum produto vendido neste período.','empty-state'));
 }
 function opportunities(data){
  const panel=$('#opportunities');panel.replaceChildren(el('p',data.hasMore?'5 das negociações abertas mais recentes · existem mais registros no CRM.':'Negociações abertas mais recentes · exibindo até 5.','scan-note'));
  for(const deal of data.items.slice(0,5)){const row=link('', '/manage?'+new URLSearchParams({module:'deals',id:deal.id}),'activity-row');const detail=el('div');row.title=deal.name;detail.append(el('p',deal.name),el('small',deal.client?.name||'Cliente'),el('span',deal.stage?.name||'Etapa não informada','badge info'));row.append(detail,el('strong',money(deal.estimatedCents||0)));panel.append(row);}
  if(!data.items.length)panel.append(el('p','Nenhuma negociação aberta. Cadastre uma oportunidade no CRM.','empty-state'));
  else panel.append(el('p','Valores estimados do CRM; não representam vendas confirmadas.','scan-note'));
 }
 function period(){const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());return new URLSearchParams({from:date.slice(0,7)+'-01',to:date});}
 function optional(selector,route,render,id){const panel=$(selector);panel.replaceChildren(el('p','Consultando dados…','scan-note'));panel.setAttribute('aria-busy','true');return api(route).then(data=>{if(id===sequence)render(data);},()=>{if(id===sequence)panel.replaceChildren(el('p','Não foi possível consultar este resumo. Use o módulo correspondente ou tente atualizar.','scan-note'));}).finally(()=>{if(id===sequence)panel.removeAttribute('aria-busy');});}
 function showInitialSkeletons(){
  const make=(kind)=>{const node=el('div',undefined,'ui-skeleton '+kind);node.setAttribute('aria-hidden','true');return node;};
  if(!$('#overview-metrics').children.length){
   $('#overview-metrics').replaceChildren(...Array.from({length:4},()=>make('ui-skeleton-kpi')));
   $('#scan-metrics').replaceChildren(...Array.from({length:4},()=>make('ui-skeleton-scan')));
   $('#top-plates').replaceChildren(...Array.from({length:3},()=>make('ui-skeleton-row')));
   return true;
  }
  return false;
 }
 async function load(){
  const id=++sequence;const initial=showInitialSkeletons();const done=KTIVAR.busy($('#reload'),'Atualizando…');$('#message').dataset.tone='info';$('#message').textContent='Consultando sua operação…';$('#overview-metrics').setAttribute('aria-busy','true');
  try{
   const activities=analytics?null:api('/workspace/activities?mode=overdue&page=0').then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
   if(!analytics){optional('#commercial','/workspace/reports?'+period(),commercial,id);optional('#opportunities','/workspace/deals?result=open&page=0',opportunities,id);}
   const overview=await api('/overview');if(id!==sequence)return;
   metrics(overview);recent(overview);$('#message').textContent='';
   if(!analytics){attention(overview,{status:'pending'});$('#attention').setAttribute('aria-busy','true');activities.then(result=>{if(id===sequence){attention(overview,result);$('#attention').removeAttribute('aria-busy');}});}
  }catch(error){if(id===sequence){$('#message').dataset.tone='danger';$('#message').textContent=error.message;if(initial){for(const target of ['#overview-metrics','#scan-metrics','#top-plates'])$(target).replaceChildren(el('p','Não foi possível carregar estes indicadores. Tente atualizar.','empty-state'));}}}
  finally{done();$('#overview-metrics').removeAttribute('aria-busy');}
 }
 $('#reload').addEventListener('click',load);
 $('#logout').addEventListener('click',async()=>{const done=KTIVAR.busy($('#logout'),'Saindo…');try{await api('/logout',{method:'POST',body:'{}'});location.assign('/login');}catch(error){$('#message').dataset.tone='danger';$('#message').textContent=error.message;}finally{done();}});
 api('/session').then(data=>$('#email').textContent=data.email).catch(error=>$('#message').textContent=error.message);load();
})();
