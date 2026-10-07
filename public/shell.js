(()=>{
 const nav=document.querySelector('.module-nav');
 if(nav){
  const paths=['M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87','M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3 M21 15v6h-6 M15 18v3','M4 19V9 M12 19V3 M20 19v-6','M3 7h18v14H3z M8 7V3h8v4','M4 6h16 M4 12h16 M4 18h16','M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h4','M9 3h6v3h3v3h3v6h-3v3h-3v3H9v-3H6v-3H3V9h3V6h3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6','M4 4h5v16H4z M10 4h5v10h-5z M16 4h5v6h-5z','M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5'];
  const iconIndexes={Dashboard:0,Clientes:1,Placas:2,Analytics:3,Produtos:4,Vendas:5,CRM:8,Atividades:6,Relatórios:9,Configurações:7};
  for(const a of nav.querySelectorAll('a:not(.brand)')){const name=a.textContent;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('nav-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[iconIndexes[name]??0]);svg.append(path);const label=document.createElement('span');label.className='nav-label';label.textContent=name;a.replaceChildren(svg,label);a.setAttribute('aria-label',name);a.title=name;const url=new URL(a.href);if(url.pathname===location.pathname&&(url.pathname!=='/manage'||url.searchParams.get('module')===(new URLSearchParams(location.search).get('module')||'clients')))a.setAttribute('aria-current','page');}
  const header=document.querySelector('header');const workspace=document.querySelector('main.workspace');
  document.body.classList.add('app-shell');header.hidden=true;
  nav.id='main-navigation';
  const bottom=document.createElement('nav');bottom.className='bottom-nav';bottom.setAttribute('aria-label','Navegação principal');
  for(const label of ['Clientes','Placas','Analytics']){
   const original=[...nav.querySelectorAll('a:not(.brand)')].find(a=>a.getAttribute('aria-label')===label);
   const item=original.cloneNode(true);item.removeAttribute('title');bottom.append(item);
  }
  const toggle=document.createElement('button');toggle.type='button';toggle.className='menu-toggle';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Menu completo');
  const menuIcon=nav.querySelector('.nav-icon').cloneNode(true);menuIcon.querySelector('path').setAttribute('d','M4 6h16 M4 12h16 M4 18h16');
  const menuLabel=document.createElement('span');menuLabel.textContent='Menu';toggle.append(menuIcon,menuLabel);bottom.append(toggle);document.body.append(bottom);
  if(!bottom.querySelector('[aria-current="page"]'))toggle.classList.add('current-section');
  const overlay=document.createElement('button');overlay.type='button';overlay.className='nav-overlay';overlay.setAttribute('aria-label','Fechar menu');document.body.append(overlay);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='nav-close';closeButton.textContent='Fechar menu ×';nav.prepend(closeButton);
  const mobile=matchMedia('(max-width: 900px)');
  const close=(restoreFocus=true)=>{document.body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');nav.inert=mobile.matches;if(workspace)workspace.inert=false;bottom.inert=false;if(restoreFocus&&mobile.matches)toggle.focus();};
  const open=()=>{for(const details of document.querySelectorAll('.more-filters[open]'))details.open=false;document.body.classList.add('nav-open');toggle.setAttribute('aria-expanded','true');nav.inert=false;if(workspace)workspace.inert=true;bottom.inert=true;closeButton.focus();};
  toggle.addEventListener('click',open);closeButton.addEventListener('click',()=>close());overlay.addEventListener('click',()=>close());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){e.preventDefault();close();}});
  nav.addEventListener('keydown',e=>{if(e.key!=='Tab'||!document.body.classList.contains('nav-open'))return;const links=[...nav.querySelectorAll('a,button')].filter(n=>n.getClientRects().length);if(e.shiftKey&&document.activeElement===links[0]){e.preventDefault();links.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===links.at(-1)){e.preventDefault();links[0].focus();}});
  mobile.addEventListener('change',()=>close(false));close(false);
  const collapse=document.createElement('button');collapse.type='button';collapse.className='collapse-toggle';collapse.setAttribute('aria-controls',nav.id);nav.append(collapse);
  const setCollapsed=value=>{document.body.classList.toggle('nav-collapsed',value);collapse.setAttribute('aria-expanded',String(!value));collapse.textContent=value?'›':'‹ Recolher';collapse.setAttribute('aria-label',value?'Expandir navegação':'Recolher navegação');collapse.title=collapse.getAttribute('aria-label');};
  try{setCollapsed(localStorage.getItem('ktivar.nav.collapsed')==='true');}catch{setCollapsed(false);}
  collapse.addEventListener('click',()=>{const value=!document.body.classList.contains('nav-collapsed');setCollapsed(value);try{localStorage.setItem('ktivar.nav.collapsed',String(value));}catch{/* Navigation still works when storage is unavailable. */}});
  const account=header.querySelector('.account');if(account){
   const email=account.querySelector('#email'),logout=account.querySelector('#logout');
   account.classList.add('settings-account');account.setAttribute('aria-label','Sua conta');
   const avatar=document.createElement('span');avatar.className='user-avatar';avatar.setAttribute('aria-hidden','true');
   const identity=document.createElement('div');identity.className='user-identity';
   const name=document.createElement('strong');name.className='user-name';identity.append(name,email);
   account.replaceChildren(avatar,identity,logout);
   const isSettings=location.pathname==='/manage'&&new URLSearchParams(location.search).get('module')==='config';
   account.hidden=!isSettings;if(isSettings)workspace.querySelector('.title-row').after(account);else document.body.append(account);
   // Preserve the actual session nodes and logout handler; only their presentation moves.
   const updateIdentity=()=>{const value=email.textContent.trim();const known=value.toLowerCase()==='ofmarcoo@gmail.com';const label=known?'Marco Ferratti':value||'Conta';name.textContent=label;name.title=label;email.title=value;avatar.textContent=known?'MF':value?value.slice(0,2).toUpperCase():'?';};
   updateIdentity();new MutationObserver(updateIdentity).observe(email,{childList:true,characterData:true,subtree:true});
  }
  document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.user-menu[open],.more-filters[open]'))if(!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){for(const menu of document.querySelectorAll('.user-menu[open],.more-filters[open]')){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}}});
 }
 window.KTIVAR={confirm(message,{danger=false,title="Confirmar ação",confirmLabel="Confirmar"}={}){return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.id='confirmation';const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=message;const footer=document.createElement('div');footer.className='form-footer';const cancel=document.createElement('button');cancel.className='secondary';cancel.textContent='Cancelar';const ok=document.createElement('button');ok.textContent=confirmLabel;if(danger)ok.className='danger';const finish=value=>{dialog.close();dialog.remove();resolve(value);};cancel.addEventListener('click',()=>finish(false));ok.addEventListener('click',()=>finish(true));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});footer.append(cancel,ok);dialog.append(h,p,footer);document.body.append(dialog);dialog.showModal();cancel.focus();});}};
 Object.assign(window.KTIVAR,{
  busy(button,label='Salvando…'){
   const text=button.textContent;button.disabled=true;button.textContent=label;button.setAttribute('aria-busy','true');
   return ()=>{button.textContent=text;button.disabled=false;button.removeAttribute('aria-busy');};
  },
  async copy(value,feedback,label='Texto'){
   try{await navigator.clipboard.writeText(value);feedback.dataset.tone='success';feedback.textContent=label+(label.startsWith('URL')?' copiada.':' copiado.');}
   catch{feedback.dataset.tone='warning';feedback.replaceChildren(document.createTextNode('Selecione e copie: '));const input=document.createElement('input');input.readOnly=true;input.value=value;input.setAttribute('aria-label',label+' para copiar');feedback.append(input);input.focus();input.select();}
  },
  formatDateTime(value){
   if(!value)return '—';const date=new Date(value);const timeZone='America/Sao_Paulo';return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone}).format(date)+' · '+new Intl.DateTimeFormat('pt-BR',{timeStyle:'short',timeZone}).format(date);
  },
  formatPhone(value){
   if(!value)return '—';let digits=String(value).replace(/\D/g,'');const country=digits.startsWith('55')&&[12,13].includes(digits.length);if(country)digits=digits.slice(2);
   if(![10,11].includes(digits.length))return String(value);return (country?'+55 ':'')+`(${digits.slice(0,2)}) ${digits.slice(2,-4)}-${digits.slice(-4)}`;
  },
  context(dialog,label,record){
   let nav=dialog.querySelector(':scope > .dialog-context');if(!nav){nav=document.createElement('nav');nav.className='dialog-context';nav.setAttribute('aria-label','Contexto do registro');dialog.prepend(nav);}
   nav.replaceChildren();const base=document.createElement('span');base.textContent=label;nav.append(base);if(record){const sep=document.createElement('span');sep.textContent='/';sep.setAttribute('aria-hidden','true');const detail=document.createElement('span');detail.textContent=record;detail.title=record;nav.append(sep,detail);}
  },
  compactToolbar(toolbar,panel){toolbar.classList.add('filters-toolbar');if(panel){panel.classList.add('filter-controls');toolbar.insertBefore(panel,toolbar.querySelector('button'));}},
  moreFilters(panel,keep=1){
   const fields=[...panel.children];if(fields.length<=keep)return;
   const details=document.createElement('details');details.className='more-filters';const summary=document.createElement('summary');summary.textContent='Mais filtros';const grid=document.createElement('div');grid.className='plate-filters';grid.append(...fields.slice(keep));details.append(summary,grid);panel.append(details);
  },
  filterSummary(target,controls,count,hasMore,clear,extra=[]){
   const active=controls.filter(n=>n.value&&!(n.name==='mode'&&n.value==='all'));const labels=active.map(n=>n.tagName==='SELECT'?n.parentElement.firstChild.textContent.trim()+': '+n.selectedOptions[0].textContent:'Busca: '+n.value);
   target.replaceChildren();const text=document.createElement('span');text.className='result-count';text.textContent=`${count} ${count===1?'registro nesta página':'registros nesta página'}${hasMore?' · há mais resultados':''}`;target.append(text);
   active.forEach((control,i)=>{const chip=document.createElement('button');chip.type='button';chip.className='filter-chip';chip.textContent=labels[i]+' ×';chip.setAttribute('aria-label','Remover filtro '+labels[i]);chip.addEventListener('click',()=>{control.value=control.name==='mode'?'all':'';control.dispatchEvent(new Event(control.tagName==='SELECT'?'change':'input',{bubbles:true}));});target.append(chip);});
   for(const item of extra){const label=typeof item==='string'?item:item.label;labels.push(label);const chip=document.createElement(item.onRemove?'button':'span');chip.className='filter-chip';chip.textContent=label+(item.onRemove?' ×':'');if(item.onRemove){chip.type='button';chip.setAttribute('aria-label','Remover filtro '+label);chip.addEventListener('click',item.onRemove);}target.append(chip);}
   if(labels.length){const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent='Limpar filtros';button.addEventListener('click',clear);target.append(button);}
   for(const details of document.querySelectorAll('.more-filters')){const active=[...details.querySelectorAll('select')].filter(n=>n.value).length;details.querySelector('summary').textContent='Mais filtros'+(active?` (${active} aplicados)`:'');}
   return labels.length>0;
  }
 });
})();
