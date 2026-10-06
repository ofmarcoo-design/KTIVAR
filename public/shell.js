(()=>{
 const nav=document.querySelector('.module-nav');
 if(nav){
  const paths=['M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87','M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3 M21 15v6h-6 M15 18v3','M4 19V9 M12 19V3 M20 19v-6','M3 7h18v14H3z M8 7V3h8v4','M4 6h16 M4 12h16 M4 18h16','M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h4','M9 3h6v3h3v3h3v6h-3v3h-3v3H9v-3H6v-3H3V9h3V6h3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6','M4 4h5v16H4z M10 4h5v10h-5z M16 4h5v6h-5z','M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5'];
  const iconIndexes={Dashboard:0,Clientes:1,Placas:2,Analytics:3,Produtos:4,Vendas:5,CRM:8,Atividades:6,Relatórios:9,Configurações:7};
  for(const a of nav.querySelectorAll('a:not(.brand)')){const name=a.textContent;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.classList.add('nav-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[iconIndexes[name]??0]);svg.append(path);a.prepend(svg);const url=new URL(a.href);if(url.pathname===location.pathname&&(url.pathname!=='/manage'||url.searchParams.get('module')===(new URLSearchParams(location.search).get('module')||'clients')))a.setAttribute('aria-current','page');}
  const header=document.querySelector('header');const toggle=document.createElement('button');toggle.className='secondary menu-toggle';toggle.textContent='Menu';toggle.setAttribute('aria-controls','main-navigation');toggle.setAttribute('aria-expanded','false');nav.id='main-navigation';header.prepend(toggle);const overlay=document.createElement('button');overlay.className='nav-overlay';overlay.setAttribute('aria-label','Fechar menu');document.body.append(overlay);const close=()=>{document.body.classList.remove('nav-open');toggle.setAttribute('aria-expanded','false');};toggle.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open));if(open)nav.querySelector('a:not(.brand)')?.focus();});overlay.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open')){close();toggle.focus();}});nav.addEventListener('keydown',e=>{if(e.key!=='Tab'||!document.body.classList.contains('nav-open'))return;const links=[...nav.querySelectorAll('a')];if(e.shiftKey&&document.activeElement===links[0]){e.preventDefault();links.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===links.at(-1)){e.preventDefault();links[0].focus();}});
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
  moreFilters(panel,keep=1){
   const fields=[...panel.children];if(fields.length<=keep)return;
   const details=document.createElement('details');details.className='more-filters';const summary=document.createElement('summary');summary.textContent='Mais filtros';const grid=document.createElement('div');grid.className='plate-filters';grid.append(...fields.slice(keep));details.append(summary,grid);panel.append(details);
  },
  filterSummary(target,controls,count,hasMore,clear,extra=[]){
   const labels=controls.filter(n=>n.value).map(n=>n.tagName==='SELECT'?n.parentElement.firstChild.textContent.trim()+': '+n.selectedOptions[0].textContent:'Busca: '+n.value);
   labels.push(...extra);target.replaceChildren();const text=document.createElement('span');text.textContent=`${count} ${count===1?'registro nesta página':'registros nesta página'}${hasMore?' · há mais resultados':''}`+(labels.length?' · '+labels.join(' · '):' · sem filtros adicionais');target.append(text);
   if(labels.length){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Limpar filtros';button.addEventListener('click',clear);target.append(button);}
   for(const details of document.querySelectorAll('.more-filters')){const active=[...details.querySelectorAll('input,select')].filter(n=>n.value).length;details.querySelector('summary').textContent='Mais filtros'+(active?` (${active} aplicados)`:'');}
   return labels.length>0;
  }
 });
})();
