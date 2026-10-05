const $=s=>document.querySelector(s);
const moduleName=new URLSearchParams(location.search).get('module')||'clients';
const titles={clients:'Clientes',products:'Produtos e serviços',sales:'Vendas',config:'Configurações'};
const descriptions={clients:'Clientes, contatos, compras e placas vinculadas.',products:'Catálogo com preços e indicação de placa inteligente.',sales:'Vendas confirmadas e seus itens. Valores não representam pagamentos recebidos.',config:'Crie, renomeie, ordene e desative opções sem perder os vínculos.'};
const catalogs={segments:'Segmentos',sources:'Origens',tags:'Tags',categories:'Categorias de produto',types:'Tipos de produto','activity-types':'Tipos de atividade','loss-reasons':'Motivos de perda',stages:'Etapas do funil'};
const schemas={
 clients:[['name','Nome','text',true,160],['company','Empresa','text',false,160],['phone','Telefone','tel',false,160],['segmentId','Segmento','ref:segments'],['sourceId','Origem','ref:sources'],['ownerId','Responsável comercial','ref:operators'],['city','Cidade','text',false,160],['state','UF','text',false,2],['address','Endereço','text',false,500],['cnpj','CNPJ','text',false,30],['enabled','Disponível','boolean']],
 products:[['name','Nome','text',true,160],['categoryId','Categoria','ref:categories'],['typeId','Tipo','ref:types'],['priceCents','Preço padrão (R$)','money'],['generatesPlate','Gera placa inteligente','boolean'],['enabled','Disponível','boolean']],
 contacts:[['name','Nome','text',true,160],['whatsapp','WhatsApp','tel',false,160],['phone','Telefone','tel',false,160],['email','E-mail','email',false,254],['instagram','Instagram','text',false,300],['website','Site','url',false,2048],['enabled','Disponível','boolean']],
 config:[['name','Nome','text',true,100],['color','Cor','color',true],['position','Ordem','number',true],['enabled','Disponível','boolean']],
 sales:[['clientId','Cliente','ref:clients',true],['soldAt','Data da venda','date',true]]
};
let page=0,requestNumber=0,rows=[],catalogKind='segments',editing=null,editorType=null,context={},saleRequestId=null;
const cache={};
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents)/100);
const localDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
function cents(value){const text=String(value||'0').trim().replace(',','.');if(!/^\d{1,8}(\.\d{1,2})?$/.test(text))throw new Error('Informe o valor com até duas casas decimais.');const [whole,decimal='']=text.split('.');return Number(whole)*100+Number(decimal.padEnd(2,'0'));}
const currencyInput=value=>(Number(value||0)/100).toFixed(2).replace('.',',');
function referenceOption(item){const option=new Option(item.name||item.email,item.id);if(item.priceCents!==undefined)option.dataset.priceCents=String(item.priceCents);return option;}
async function api(route,options={}){const r=await fetch('/api'+route,{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});const data=await r.json();if([401,403].includes(r.status)){location.assign('/login');throw new Error('Entre novamente.');}if(!r.ok)throw new Error(data.error||'Operação indisponível.');return data;}
const call=(route,method,body)=>api(route,{method,body:JSON.stringify(body)});
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function button(text,fn){const b=el('button',text,'secondary');b.type='button';b.addEventListener('click',()=>Promise.resolve(fn()).catch(error=>$('#message').textContent=error.message));return b;}
function textLine(label,value){const p=el('p');p.append(el('strong',label+': '),document.createTextNode(value||'—'));return p;}
async function references(source,search=''){
 if(source==='operators')return api('/workspace/operators');
 if(['clients','products'].includes(source)){const data=await api(`/workspace/${source}?enabled=true&search=${encodeURIComponent(search)}`);return data.items;}
 if(!cache[source])cache[source]=await api(`/workspace/catalogs/${source}`);return cache[source];
}
async function field(def,value){
 const [name,label,type,required,max]=def;const wrapper=el('label',label);let input;
 if(type==='boolean'){input=document.createElement('select');input.append(new Option('Sim','true'),new Option('Não','false'));input.value=String(value??(name==='enabled'));}
 else if(type.startsWith('ref:')){
  const source=type.slice(4);input=document.createElement('select');input.append(new Option(required?'Selecione':'Sem vínculo',''));
  const options=await references(source);for(const option of options)if(option.enabled!==false||option.id===value)input.append(referenceOption(option));
  if(value&&!options.some(o=>o.id===value))input.append(new Option('Vínculo atual (indisponível)',value));input.value=value||'';
  if(['clients','products'].includes(source)){
   const search=document.createElement('input');search.type='search';search.placeholder='Buscar '+label.toLowerCase();let timer;
   search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{try{const current=input.value,selected=input.selectedOptions[0]?.cloneNode(true);const options=await references(source,search.value);input.replaceChildren(new Option(required?'Selecione':'Sem vínculo',''));if(current&&selected&&!options.some(o=>o.id===current))input.append(selected);for(const item of options)input.append(referenceOption(item));input.value=current;}catch(e){$('#form-message').textContent=e.message;}},250);});wrapper.append(search);
  }
 }else{input=document.createElement('input');input.type=type==='money'?'text':type;input.value=type==='money'?currencyInput(value):value??(type==='color'?'#667085':type==='number'?0:type==='date'?localDate():'');if(type==='money')input.inputMode='decimal';if(max)input.maxLength=max;if(type==='number'){input.min='0';input.max='100000';}}
 input.name=name;input.required=!!required;wrapper.append(input);return wrapper;
}
async function openEditor(type,record=null,extra={}){
 editing=record;editorType=type;context=extra;$('#record-form').reset();$('#record-fields').replaceChildren();$('#form-message').textContent='';$('#sale-items').hidden=type!=='sales';$('#form-title').textContent=record?'Editar cadastro':type==='sales'?'Nova venda':type==='contacts'?'Novo contato':'Novo cadastro';
 let defs=schemas[type];if(type==='config'&&catalogKind==='stages')defs=[...defs,['requiresFollowup','Exige próxima ação e data','boolean']];
 for(const def of defs)$('#record-fields').append(await field(def,record?.[def[0]]));
 if(type==='sales'){saleRequestId=crypto.randomUUID();$('#item-rows').replaceChildren();await addItem();}
 $('#record-editor').showModal();
}
function formValues(){const values=Object.fromEntries(new FormData($('#record-form')));for(const [name,,type] of schemas[editorType]){if(type==='boolean')values[name]=values[name]==='true';else if(type==='money')values[name]=cents(values[name]);else if(type==='number')values[name]=Number(values[name]);}if(values.state)values.state=values.state.toUpperCase();if(editorType==='config'&&catalogKind==='stages')values.requiresFollowup=values.requiresFollowup==='true';if(editing)values.revision=editing.revision;return values;}
async function load(){
 const id=++requestNumber;$('#message').textContent='Carregando…';try{
  const query=new URLSearchParams({page,search:$('#search').value});for(const select of document.querySelectorAll('#module-filters select'))if(select.value)query.set(select.name,select.value);const route=moduleName==='config'?`/workspace/catalogs/${catalogKind}`:`/workspace/${moduleName}?${query}`;const data=await api(route);if(id!==requestNumber)return;rows=Array.isArray(data)?data:data.items;$('#content').replaceChildren();
  for(const record of rows){
   const card=el('article',undefined,'record-card');const heading=el('h2',moduleName==='sales'?record.client?.name||'Venda':record.name);card.append(heading);
   if(moduleName==='clients')card.append(textLine('Empresa',record.company),textLine('Cidade',record.city));
   if(moduleName==='products')card.append(textLine('Preço padrão',money(record.priceCents)),textLine('Placa',record.generatesPlate?'Aplicável':'Não aplicável'));
   if(moduleName==='sales')card.append(textLine('Data',record.soldAt.split('-').reverse().join('/')),textLine('Situação',record.status==='confirmed'?'Confirmada':'Cancelada'),textLine('Valor',money(record.totalCents)));
   if(moduleName==='config')card.append(textLine('Ordem',String(record.position)));
   if(moduleName!=='sales')card.append(textLine('Disponível',record.enabled?'Sim':'Não'));
   const actions=el('div',undefined,'record-actions');if(['clients','sales'].includes(moduleName))actions.append(button('Ver',()=>moduleName==='clients'?clientProfile(record.id):saleProfile(record.id)));if(moduleName!=='sales')actions.append(button('Editar',()=>openEditor(moduleName,record)));card.append(actions);$('#content').append(card);
  }
  if(!rows.length)$('#content').append(el('p','Nenhum registro encontrado. Use o botão acima para cadastrar.','muted'));
  $('#pagination').hidden=moduleName==='config';$('#previous').disabled=page===0;$('#next').disabled=!data.hasMore;$('#page').textContent=`Página ${page+1}`;$('#message').textContent='';
 }catch(e){if(id===requestNumber)$('#message').textContent=e.message;}
}
$('#record-form').addEventListener('submit',async event=>{
 event.preventDefault();$('#save').disabled=true;$('#form-message').textContent='';try{
  const values=formValues();let saved;
  if(editorType==='sales'){values.id=saleRequestId;values.items=readItems();saved=await call('/workspace/sales','POST',values);}
  else{if(editorType==='contacts')values.clientId=context.clientId;const route=editorType==='config'?`/workspace/catalogs/${catalogKind}`:`/workspace/${editorType}`;saved=await call(route+(editing?'/'+editing.id:''),editing?'PATCH':'POST',values);}
  for(const key of Object.keys(cache))delete cache[key];$('#record-editor').close();await load();$('#message').textContent='Cadastro salvo.';if(editorType==='contacts')await clientProfile(context.clientId);if(editorType==='sales')await saleProfile(saved.id);
 }catch(e){$('#form-message').textContent=e.message;}finally{$('#save').disabled=false;}
});
async function addItem(){
 const row=el('div',undefined,'sale-item');const productField=await field(['productId','Produto','ref:products',true]);row.append(productField);
 for(const def of [['quantity','Quantidade','number',true],['priceCents','Preço unitário (R$)','money'],['discountCents','Desconto do item (R$)','money']])row.append(await field(def,def[0]==='quantity'?1:0));
 const select=row.querySelector('[name=productId]');select.addEventListener('change',()=>{const price=select.selectedOptions[0]?.dataset.priceCents;if(price!==undefined)row.querySelector('[name=priceCents]').value=currencyInput(price);updateTotal();});
 row.append(button('Remover item',()=>{row.remove();updateTotal();}));row.addEventListener('input',updateTotal);$('#item-rows').append(row);updateTotal();
}
function readItems(){return [...document.querySelectorAll('.sale-item')].map(row=>({productId:row.querySelector('[name=productId]').value,quantity:Number(row.querySelector('[name=quantity]').value),priceCents:cents(row.querySelector('[name=priceCents]').value),discountCents:cents(row.querySelector('[name=discountCents]').value)}));}
function updateTotal(){try{$('#sale-total').textContent='Total: '+money(readItems().reduce((sum,item)=>sum+item.quantity*item.priceCents-item.discountCents,0));}catch{$('#sale-total').textContent='Confira os valores dos itens.';}}
$('#add-item').addEventListener('click',()=>addItem().catch(e=>$('#form-message').textContent=e.message));
async function clientProfile(id){
 const data=await api(`/workspace/clients/${id}/profile`);$('#profile-title').textContent=data.name;const body=$('#profile-body');body.replaceChildren();body.append(textLine('Empresa',data.company),textLine('Telefone',data.phone),el('h2','Contatos'),button('Novo contato',()=>openEditor('contacts',null,{clientId:id})));
 for(const contact of data.contacts){const card=el('article',undefined,'record-card');card.append(el('h3',`${contact.name}${contact.isPrimary&&contact.enabled?' · Principal':''}${contact.enabled?'':' · Inativo'}`));for(const [label,value] of [['WhatsApp',contact.whatsapp],['Telefone',contact.phone],['E-mail',contact.email],['Instagram',contact.instagram],['Site',contact.website]])if(value)card.append(textLine(label,value));const actions=el('div',undefined,'record-actions');actions.append(button('Editar contato',()=>openEditor('contacts',contact,{clientId:id})));if(contact.enabled&&!contact.isPrimary)actions.append(button('Tornar principal',async()=>{await call(`/workspace/contacts/${contact.id}/primary`,'POST',{});await clientProfile(id);}));card.append(actions);body.append(card);}
 body.append(el('h2','Tags'));const tagForm=el('form');const select=document.createElement('select');select.multiple=true;select.name='tags';select.setAttribute('aria-label','Tags do cliente');const tags=await references('tags');const current=new Set(data.client_tags.map(t=>t.tagId));for(const tag of tags)if(tag.enabled||current.has(tag.id)){const option=new Option(tag.name,tag.id);option.selected=current.has(tag.id);select.append(option);}const saveTags=el('button','Salvar tags');saveTags.type='submit';tagForm.append(select,saveTags);tagForm.addEventListener('submit',async e=>{e.preventDefault();saveTags.disabled=true;try{await call(`/workspace/clients/${id}/tags`,'PUT',{tags:[...select.selectedOptions].map(o=>o.value)});await clientProfile(id);}catch(error){body.prepend(el('p',error.message));}finally{saveTags.disabled=false;}});body.append(tagForm);
 body.append(el('h2','Placas'));for(const plate of data.plates){const link=el('a',plate.code);link.href=`/plates?code=${encodeURIComponent(plate.code)}`;body.append(link,el('p',plate.status));}if(!data.plates.length)body.append(el('p','Nenhuma placa vinculada.','muted'));
 body.append(el('h2','Compras'));const bought=new Set();for(const sale of data.sales){const card=el('article',undefined,'record-card');card.append(textLine('Venda',`${sale.soldAt.split('-').reverse().join('/')} · ${sale.status==='confirmed'?'Confirmada':'Cancelada'}`));for(const item of sale.items){card.append(textLine(item.description,`${item.quantity} × ${money(item.priceCents)} · ${money(item.totalCents)}`));if(sale.status==='confirmed')bought.add(item.productId);}card.append(button('Ver venda',()=>saleProfile(sale.id)));body.append(card);}if(!data.sales.length)body.append(el('p','Ainda não há compras.','muted'));
 const products=await references('products');body.append(el('h2','Disponíveis para oferta'));const offers=products.filter(p=>!bought.has(p.id));for(const product of offers)body.append(textLine(product.name,money(product.priceCents)));if(!offers.length)body.append(el('p','Nenhum produto disponível nesta consulta.','muted'));if(!$('#profile').open)$('#profile').showModal();
}
async function saleProfile(id){
 const sale=await api(`/workspace/sales/${id}`);$('#profile-title').textContent='Venda · '+sale.client?.name;const body=$('#profile-body');body.replaceChildren(textLine('Data',sale.soldAt.split('-').reverse().join('/')),textLine('Situação',sale.status==='confirmed'?'Confirmada':'Cancelada'),textLine('Valor',money(sale.totalCents)));
 for(const item of sale.items){const card=el('article',undefined,'record-card');card.append(el('h3',item.description),textLine('Quantidade',String(item.quantity)),textLine('Preço unitário',money(item.priceCents)),textLine('Desconto',money(item.discountCents)),textLine('Total',money(item.totalCents)));for(const plate of item.plates){const link=el('a',`${plate.code} · Unidade ${plate.saleUnit}`);link.href=`/plates?code=${encodeURIComponent(plate.code)}`;card.append(link,el('br'));}
  if(item.generatesPlate&&sale.status==='confirmed'){
   const form=el('form');form.className='form-grid';const unit=await field(['unit','Unidade para gerar/vincular','number',true],1);unit.querySelector('input').min='1';unit.querySelector('input').max=String(item.quantity);const destination=await field(['destinationUrl','Destino inicial','url',true,2048]);const submit=el('button','Gerar placa');submit.type='submit';const feedback=el('p',undefined,'wide');feedback.setAttribute('role','status');form.append(unit,destination,submit,feedback);form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const result=await call(`/workspace/sale-items/${item.id}/plate`,'POST',{unit:Number(form.elements.unit.value),destinationUrl:form.elements.destinationUrl.value});feedback.textContent=`${result.code} vinculada. Repetir a ação mantém a mesma placa.`;await saleProfile(id);}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}});card.append(form);
  }body.append(card);
 }
 if(sale.status==='confirmed'){const form=el('form');const label=el('label','Motivo do cancelamento');const input=document.createElement('input');input.required=true;input.maxLength=500;label.append(input);const submit=el('button','Cancelar venda','secondary');submit.type='submit';const feedback=el('p');feedback.setAttribute('role','status');form.append(label,submit,feedback);form.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Cancelar esta venda? Os itens e placas serão preservados.'))return;submit.disabled=true;try{await call(`/workspace/sales/${id}/cancel`,'POST',{revision:sale.revision,reason:input.value});await saleProfile(id);await load();}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}});body.append(form);}else body.append(textLine('Motivo',sale.cancellationReason));if(!$('#profile').open)$('#profile').showModal();
}
$('#profile-close').addEventListener('click',()=>$('#profile').close());for(const id of ['editor-close','editor-cancel'])$('#'+id).addEventListener('click',()=>$('#record-editor').close());
$('#create').addEventListener('click',()=>openEditor(moduleName).catch(e=>$('#message').textContent=e.message));$('#reload').addEventListener('click',load);$('#previous').addEventListener('click',()=>{page--;load();});$('#next').addEventListener('click',()=>{page++;load();});let searchTimer;$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{page=0;load();},250);});$('#logout').addEventListener('click',async()=>{try{await call('/logout','POST',{});location.assign('/login');}catch(e){$('#message').textContent=e.message;}});
if(!Object.hasOwn(titles,moduleName))location.replace('/manage?module=clients');else{
 $('#module-title').textContent=titles[moduleName];$('#module-description').textContent=descriptions[moduleName];$('#create').textContent=moduleName==='sales'?'Nova venda':moduleName==='config'?'Nova opção':'Novo cadastro';
 if(['sales','config'].includes(moduleName))$('.search').hidden=true;
 if(moduleName==='config'){const label=el('label','Grupo');const select=document.createElement('select');for(const [key,name] of Object.entries(catalogs))select.append(new Option(name,key));select.addEventListener('change',()=>{catalogKind=select.value;load();});label.append(select);$('#filters').prepend(label);const link=el('a','Configurar status das placas','download-link');link.href='/plates?statuses=1';$('#filters').append(link);}
 api('/session').then(data=>$('#email').textContent=data.email).catch(e=>$('#message').textContent=e.message);initFilters().then(load).catch(e=>$('#message').textContent=e.message);
}

async function initFilters(){
 if(!['clients','products','sales'].includes(moduleName))return;
 const defs=moduleName==='clients'?schemas.clients.filter(d=>['segmentId','sourceId','ownerId'].includes(d[0])):moduleName==='products'?schemas.products.filter(d=>['categoryId','typeId'].includes(d[0])):[];
 const panel=el('section',undefined,'plate-filters');panel.id='module-filters';panel.setAttribute('aria-label','Filtros');$('#filters').after(panel);
 for(const def of defs){const label=await field(def,'');const select=label.querySelector('select');select.options[0].textContent='Todos';select.addEventListener('change',()=>{page=0;load();});panel.append(label);}
 const label=el('label',moduleName==='sales'?'Situação':'Disponibilidade');const select=document.createElement('select');select.name=moduleName==='sales'?'status':'enabled';select.append(new Option('Todas',''),new Option(moduleName==='sales'?'Confirmadas':'Disponíveis',moduleName==='sales'?'confirmed':'true'),new Option(moduleName==='sales'?'Canceladas':'Indisponíveis',moduleName==='sales'?'cancelled':'false'));select.addEventListener('change',()=>{page=0;load();});label.append(select);panel.append(label);
}
