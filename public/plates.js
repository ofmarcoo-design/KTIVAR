const $ = selector => document.querySelector(selector);
const form = $('#plate-form');
const editor = $('#editor');
let statusLabels = {};
let plateStatuses = [];
let editingStatus = null;
const purposeLabels = { google_review: 'Avaliação Google', pix: 'Pix', wifi: 'Wi-Fi', link_bio: 'Link na bio', other: 'Outra' };
let page = 0;
let editing = null;
let editingRevision = null;
let viewedPlate = null;
let historyPage = 0;
let viewed = null;
let referenceType = null;
let listRequest = 0;
const referenceRequests = { clients: 0, products: 0 };

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, cache: 'no-store' });
  const data = await response.json();
  if ([401, 403].includes(response.status)) { window.location.assign('/login'); throw new Error('Entre novamente para continuar.'); }
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const delivery = value => value ? value.split('-').reverse().join('/') : '—';
function cell(row, text, label) { const td = document.createElement('td'); td.textContent = text || '—'; td.dataset.label = label; row.append(td); return td; }
function action(label, handler) { const button = document.createElement('button'); button.textContent = label; button.className = label==='Desabilitar redirect'?'danger':'secondary'; button.addEventListener('click', handler); return button; }
function debounce(fn) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), 250); }; }
function showError(error) { $('#message').dataset.tone='danger';$('#message').textContent = error.message; }
async function load() {
  const id = ++listRequest;
  $('#message').dataset.tone='info';$('#message').textContent = 'Carregando placas…';
  try {
    const params=new URLSearchParams(location.search);
    const filters = new URLSearchParams({page,search:$('#search').value,status:$('#filter-status').value,clientId:$('#filter-client').value,productId:$('#filter-product').value});
    for(const key of ['from','to','active'])if(params.get(key))filters.set(key,params.get(key));
    const data = await api(`/plates?${filters}`);
    if (id !== listRequest) return;
    $('#rows').replaceChildren();
    for (const plate of data.items) {
      const row = document.createElement('tr');
      cell(row, plate.code, 'Código');
      const client = cell(row, plate.client?.name, 'Cliente');
      if (plate.client?.company) { const small = document.createElement('small'); small.textContent = plate.client.company; client.append(small); }
      cell(row, plate.product?.name, 'Produto');
      const badge = document.createElement('span'); badge.className = `badge ${plate.status} ${plateStatuses.find(s=>s.key===plate.status)?.redirects?'success':''}`; badge.textContent = statusLabels[plate.status];const color=plateStatuses.find(s=>s.key===plate.status)?.color;if(/^#[0-9a-f]{6}$/i.test(color||'')){const dot=document.createElement('span');dot.className='status-color';dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');badge.prepend(dot);} cell(row, '', 'Status').replaceChildren(badge);
      const destination=cell(row, plate.destinationUrl || 'Sem destino · estoque', 'Destino atual');destination.classList.add('url-cell');const urlText=document.createElement('span');urlText.className='truncate-url';urlText.textContent=destination.textContent;urlText.title=plate.destinationUrl||'Sem destino';destination.replaceChildren(urlText);cell(row, plate.accesses===undefined?'—':new Intl.NumberFormat('pt-BR').format(plate.accesses), 'Acessos');
      cell(row, '', 'Ações').replaceChildren(action('Ver', () => view(plate.code)), action(plate.status==='stock'?'Vincular':'Editar', () => openEditor(plate.code,plate.status==='stock')));
      $('#rows').append(row);
    }
    $('#empty').hidden = data.items.length > 0;
    $('#empty').textContent = $('#search').value ? 'Nenhuma placa encontrada para este código.' : 'Nenhuma placa cadastrada. Comece em “Nova placa”.';
    $('#page').textContent = `Página ${page + 1}`;
    $('#previous').disabled = page === 0;
    $('#next').disabled = !data.hasMore;
    $('#message').textContent = '';
  } catch (error) { if (id === listRequest) showError(error); }
}
async function references(type, selected) {
  const id = ++referenceRequests[type];
  const search = $(`#${type === 'clients' ? 'client' : 'product'}-search`).value;
  const rows = await api(`/${type}?search=${encodeURIComponent(search)}`);
  if (id !== referenceRequests[type]) return;
  const select = form.elements[type === 'clients' ? 'clientId' : 'productId'];
  const previous = selected || (select.value ? { id: select.value, name: select.selectedOptions[0].textContent } : null);
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = type === 'clients' ? 'Selecione um cliente' : 'Sem produto vinculado';
  select.replaceChildren(empty);
  if (previous && !rows.some(row => row.id === previous.id)) rows.unshift(previous);
  for (const item of rows) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.company ? `${item.name} · ${item.company}` : item.name; select.append(option); }
  if (previous) select.value = previous.id;
}
async function openEditor(code = null, bind = false) {
  try {
    const plate = code ? await api(`/plates/${code}`) : null;
    editing = code; editingRevision = plate?.revision;
    form.reset();
    $('#client-search').value = ''; $('#product-search').value = '';
    $('#form-message').textContent = ''; $('#dates').textContent = '';
    $('#editor-title').textContent = code ? `Editar ${code}` : 'Nova placa';
    if (plate) {
      for (const [key, value] of Object.entries(plate)) if (form.elements[key] && !['clientId', 'productId'].includes(key)) form.elements[key].value = value ?? '';
      $('#dates').textContent = `Criada em ${date(plate.createdAt)} · Atualizada em ${date(plate.updatedAt)}`;
    }
    await Promise.all([references('clients', plate?.client), references('products', plate?.product)]);
    fillStatusSelect(form.elements.status, plate?.status);if(!plate){const initial=plateStatuses.find(s=>s.enabled&&s.key==='pending')||plateStatuses.find(s=>s.enabled&&s.key!=='stock'&&!s.redirects);if(initial)form.elements.status.value=initial.key;}syncStockFields();if(bind&&plate?.status==='stock')beginStockBinding();
    editor.showModal();
  } catch (error) { showError(error); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#save'); button.disabled = true; $('#form-message').textContent = '';
  try {
    const values = Object.fromEntries(new FormData(form)); delete values.code; if(editing) values.revision=editingRevision;
    const result = await api(editing ? `/plates/${editing}` : '/plates', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(values) });
    editor.close();
    page = 0; $('#search').value = '';
    await load();
    $('#message').dataset.tone='success';$('#message').textContent = `${result.code} salva.`;
  } catch (error) { $('#form-message').textContent = error.message; }
  finally { button.disabled = false; }
});
async function view(code) {
  try {
    const plate = await api(`/plates/${code}`); viewed = code; viewedPlate=plate; historyPage=0;
    $('#view-title').textContent = plate.code; $('#details').replaceChildren();$('#view-destination').hidden=plate.status==='stock';$('#view-edit').textContent=plate.status==='stock'?'Vincular placa':'Editar placa';
    $('#qr-code').textContent = plate.code;
    $('.nfc-url').hidden = true;
    $('#nfc-url').value = plate.permanentUrl;
    $('#qr-image').alt = `QR da placa ${plate.code}`;
    $('#qr-message').dataset.tone='info';$('#qr-message').textContent = 'Carregando QR…';
    const qrPath = `/api/plates/${encodeURIComponent(plate.code)}/qr.svg`;
    $('#qr-image').src = qrPath;
    $('#qr-download').href = `${qrPath}?download=1`;
    $('#qr-download').download = `${plate.code}.svg`;
    const fields = [ ['Cliente', plate.client?.name], ['Empresa', plate.client?.company], ['Telefone', plate.client?.phone], ['Produto', plate.product?.name], ['Status', statusLabels[plate.status]], ['Finalidade', purposeLabels[plate.purpose]], ['Instalação', plate.installationLocation], ['URL permanente', plate.permanentUrl], ['Destino atual', plate.destinationUrl], ['Identificador QR', plate.code], ['Identificador NFC', plate.nfcIdentifier], ['Entrega', delivery(plate.deliveredAt)], ['Criada em', date(plate.createdAt)], ['Atualizada em', date(plate.updatedAt)] ];
    for (const [label, value] of fields) {
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value || '—';
      if (['URL permanente', 'Destino atual'].includes(label)) {
        try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol)) { const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = value; dd.replaceChildren(link); } } catch { /* Show invalid legacy destinations as text. */ }
      }
      $('#details').append(dt, dd);
    }
    $('#viewer').showModal();
    loadAnalytics(code);
    loadHistory().catch(error=>{ $('#history-message').textContent=error.message; });
  } catch (error) { showError(error); }
}
$('#qr-image').addEventListener('load', () => { if($('#qr-message').textContent==='Carregando QR…')$('#qr-message').textContent = ''; });
$('#qr-image').addEventListener('error', () => { $('#qr-message').dataset.tone='danger';$('#qr-message').textContent = 'Não foi possível carregar o QR. Reabra a placa para tentar novamente.'; });
$('#view-close').addEventListener('click', () => $('#viewer').close());
$('#view-edit').addEventListener('click', () => { $('#viewer').close(); openEditor(viewed,viewedPlate?.status==='stock'); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => editor.close());
$('#new').addEventListener('click', () => openEditor());
$('#reload').addEventListener('click', load);
$('#previous').addEventListener('click', () => { page--; load(); });
$('#next').addEventListener('click', () => { page++; load(); });
$('#search').addEventListener('input', debounce(() => { page = 0; load(); }));
for (const type of ['clients', 'products']) {
  const singular = type === 'clients' ? 'client' : 'product';
  $(`#${singular}-search`).addEventListener('input', debounce(() => references(type).catch(error => { $('#form-message').textContent = error.message; })));
  $(`#add-${singular}`).addEventListener('click', async () => {
    referenceType = type; $('#reference-form').reset(); $('#reference-message').textContent = '';
    $('#reference-title').textContent = type === 'clients' ? 'Cadastrar cliente' : 'Cadastrar produto';
    $('#client-fields').hidden = type !== 'clients';$('#reference-classifications').replaceChildren();$('#reference-dialog').showModal();
    const submit=$('#reference-form [type=submit]');submit.disabled=true;
    try{for(const [name,title,catalog] of type==='clients'?[['segmentId','Segmento','segments'],['sourceId','Origem','sources']]:[['categoryId','Categoria','categories'],['typeId','Tipo','types']]){
      const label=document.createElement('label');label.append(title);const select=document.createElement('select');select.name=name;select.required=true;const empty=new Option('Selecione uma opção','');empty.disabled=true;empty.selected=true;select.append(empty);const rows=await api('/workspace/catalogs/'+catalog);for(const row of rows)if(row.enabled)select.append(new Option(row.name,row.id));label.append(select);$('#reference-classifications').append(label);if(select.options.length===1)$('#reference-message').textContent='Não há opções disponíveis. Revise as configurações antes de cadastrar.';
    }}catch(error){$('#reference-message').textContent=error.message;}finally{submit.disabled=$('#reference-classifications').querySelectorAll('select').length!==2||[...$('#reference-classifications').querySelectorAll('select')].some(s=>s.options.length<2);}

  });
}
$('#reference-cancel').addEventListener('click', () => $('#reference-dialog').close());
$('#reference-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('[type=submit]'); button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(event.target));
    const saved = await api(`/${referenceType}`, { method: 'POST', body: JSON.stringify(values) });
    await references(referenceType, saved); $('#reference-dialog').close();
  } catch (error) { $('#reference-message').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/logout', { method: 'POST', body: '{}' }); window.location.assign('/login'); } catch (error) { showError(error); } });
api('/session').then(data => { $('#email').textContent = data.email; }).catch(showError);
loadStatuses().then(async()=>{const params=new URLSearchParams(location.search);if(params.has('active')){const info=document.createElement('p');info.className='muted';info.textContent=params.get('active')==='true'?'Redirecionamento habilitado · ': 'Redirecionamento desabilitado · ';const clear=document.createElement('a');clear.href='/plates';clear.textContent='Limpar filtro';info.append(clear);$('.toolbar').after(info);}if(params.has('status'))$('#filter-status').value=params.get('status');if(/^PL-\d{6}$/.test(params.get('code')||''))$('#search').value=params.get('code');if(params.has('from')&&params.has('to')){const p=document.createElement('p');p.className='muted';p.textContent=`Período: ${params.get('from')} a ${params.get('to')} · Brasília`;const a=document.createElement('a');a.href='/plates';a.textContent='Limpar período';p.append(document.createElement('br'),a);$('.toolbar').after(p);}await load();if(params.has('code'))await view(params.get('code'));if(params.get('statuses')==='1')$('#configure-statuses').click();}).catch(showError);

async function loadHistory() {
  $('#history-message').textContent='Carregando histórico…';
  const data=await api(`/plates/${viewed}/destination-history?page=${historyPage}`);
  $('#history').replaceChildren();
  for(const item of data.items) {
    const li=document.createElement('li');
    const heading=document.createElement('strong'); heading.textContent=`${date(item.createdAt)} · ${item.actorEmail || 'Manutenção do sistema'}`;
    const before=document.createElement('p'); before.textContent=`Anterior: ${item.previousUrl || 'Cadastro inicial'}`;
    const after=document.createElement('p'); after.textContent=`Novo: ${item.destinationUrl}`;
    li.append(heading,before,after); $('#history').append(li);
  }
  $('#history-message').textContent=data.items.length?'':'Ainda não há mudanças registradas.';
  $('#history-previous').disabled=historyPage===0; $('#history-next').disabled=!data.hasMore;
}
$('#history-previous').addEventListener('click',()=>{historyPage--;loadHistory().catch(showError);});
$('#history-next').addEventListener('click',()=>{historyPage++;loadHistory().catch(showError);});
$('#view-destination').addEventListener('click',()=>{
  $('#destination-form').elements.destinationUrl.value=viewedPlate.destinationUrl;
  $('#destination-message').textContent=''; $('#destination-editor').showModal();
});
$('#destination-cancel').addEventListener('click',()=>$('#destination-editor').close());
$('#destination-form').addEventListener('submit',async event=>{
  event.preventDefault(); const button=$('#destination-save'); button.disabled=true;
  try {
    await api(`/plates/${viewed}/destination`,{method:'PATCH',body:JSON.stringify({destinationUrl:event.target.elements.destinationUrl.value,revision:viewedPlate.revision})});
    $('#destination-editor').close(); $('#viewer').close(); await view(viewed); await load();
  } catch(error) { $('#destination-message').textContent=error.message; }
  finally {button.disabled=false;}
});

async function loadAnalytics(code) {
  for(const key of ['today','7','30','total']) $(`#scan-${key}`).textContent='—';
  $('#scan-message').textContent='Carregando acessos…';
  try {
    const data=await api(`/plates/${code}/analytics`);
    if(viewed!==code)return;
    for(const [key,value] of [['today',data.today],['7',data.days7],['30',data.days30],['total',data.total]]) $(`#scan-${key}`).textContent=new Intl.NumberFormat('pt-BR').format(value);
    $('#scan-message').textContent='Acessos registrados · horário de Brasília. Inclui acessos repetidos e automáticos; não são visitantes únicos.';
  } catch(error) {if(viewed===code)$('#scan-message').textContent=error.message;}
}

function fillStatusSelect(select,selected,all=false) {
 const previous=selected||select.value;
 select.replaceChildren();
 if(all){const option=new Option('Todos','');select.append(option);}
 for(const item of plateStatuses)if(all||item.enabled||item.key===previous)select.append(new Option(`${item.name}${item.enabled?'':' (indisponível)'}`,item.key));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
}
async function loadStatuses(){
 plateStatuses=await api('/plate-statuses');statusLabels=Object.fromEntries(plateStatuses.map(s=>[s.key,s.name]));
 fillStatusSelect($('#filter-status'),null,true);fillStatusSelect(form.elements.status);syncStockFields();
}
for(const id of ['status','client','product'])$('#filter-'+id).addEventListener('change',()=>{page=0;load();});
async function filterReferences(type){
 const singular=type==='clients'?'client':'product';const select=$('#filter-'+singular);const previous=select.value;
 const rows=await api(`/${type}?search=${encodeURIComponent($('#filter-'+singular+'-search').value)}`);
 select.replaceChildren(new Option('Todos',''));for(const row of rows)select.append(new Option(row.name,row.id));
 select.value=rows.some(row=>row.id===previous)?previous:'';
 page=0;load();
}
for(const type of ['clients','products'])$('#filter-'+(type==='clients'?'client':'product')+'-search').addEventListener('input',debounce(()=>filterReferences(type).catch(showError)));
$('#copy-nfc').addEventListener('click',async()=>{
 const url=viewedPlate.permanentUrl;
 try{await navigator.clipboard.writeText(url);$('#qr-message').dataset.tone='success';$('#qr-message').textContent='URL permanente copiada para NFC.';}
 catch{$('.nfc-url').hidden=false;$('#nfc-url').value=url;$('#nfc-url').focus();$('#nfc-url').select();$('#qr-message').textContent='Selecione a URL acima e copie para a tag NFC.';}
});
function newStatus(){editingStatus=null;$('#status-form').reset();$('#status-title').textContent='Novo status';$('#status-redirect-field').hidden=false;$('#status-message').textContent='';}
async function renderStatuses(){
 await loadStatuses();$('#status-list').replaceChildren();
 for(const item of plateStatuses){
  const row=document.createElement('div');row.className='status-row';const title=document.createElement('strong');title.textContent=`${item.position}. ${item.name} · ${item.enabled?'disponível':'indisponível'} · redirect ${item.redirects?'habilitado':'desabilitado'}`;
  row.append(title,action('Editar',()=>{editingStatus=item.id;$('#status-title').textContent='Editar status';for(const key of ['name','color','position','enabled'])$('#status-form').elements[key].value=String(item[key]);$('#status-redirect-field').hidden=true;$('#status-message').textContent='';}),action(item.redirects?'Desabilitar redirect':'Habilitar redirect',async()=>{
   if(item.key==='stock'){ $('#status-message').textContent='Vincule cliente e destino em cada placa para habilitar o redirect.';return;}
   if(!await window.KTIVAR.confirm(`${item.redirects?'Desabilitar':'Habilitar'} o redirect de TODAS as placas com o status “${item.name}”?`,{danger:item.redirects}))return;
   try{await api(`/plate-statuses/${item.id}/redirect`,{method:'PATCH',body:JSON.stringify({redirects:!item.redirects,confirmed:true})});await renderStatuses();await load();}catch(e){$('#status-message').dataset.tone='danger';$('#status-message').textContent=e.message;}
  }));$('#status-list').append(row);
 }
}
$('#configure-statuses').addEventListener('click',async()=>{newStatus();$('#status-manager').showModal();try{await renderStatuses();}catch(e){$('#status-message').dataset.tone='danger';$('#status-message').textContent=e.message;}});
$('#status-close').addEventListener('click',()=>$('#status-manager').close());$('#status-new').addEventListener('click',newStatus);
$('#status-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
 try{const data=Object.fromEntries(new FormData(event.target));data.position=Number(data.position);data.enabled=data.enabled==='true';if(editingStatus)delete data.redirects;else data.redirects=data.redirects==='true';await api(editingStatus?`/plate-statuses/${editingStatus}`:'/plate-statuses',{method:editingStatus?'PATCH':'POST',body:JSON.stringify(data)});await renderStatuses();await load();newStatus();$('#status-message').dataset.tone='success';$('#status-message').textContent='Status salvo.';}catch(e){$('#status-message').dataset.tone='danger';$('#status-message').textContent=e.message;}finally{button.disabled=false;}
});

function syncStockFields(){const stock=form.elements.status.value==='stock';$('#stock-binding').hidden=!stock;$('#client-search').disabled=stock;$('#add-client').disabled=stock;for(const name of ['clientId','destinationUrl']){form.elements[name].required=!stock;form.elements[name].disabled=stock;if(stock)form.elements[name].value='';}}
function beginStockBinding(){const status=plateStatuses.find(s=>s.enabled&&s.key==='pending')||plateStatuses.find(s=>s.enabled&&s.key!=='stock'&&!s.redirects)||plateStatuses.find(s=>s.enabled&&s.key!=='stock');if(!status){$('#form-message').textContent='Disponibilize um status fora de estoque em Configurar status para vincular esta placa.';return;}form.elements.status.value=status.key;syncStockFields();$('#dates').textContent+=' Vincule o cliente e informe o destino. Confira o status antes de salvar. O código e o QR permanecem iguais.';form.elements.clientId.focus();}
$('#bind-stock').addEventListener('click',beginStockBinding);
form.elements.status.addEventListener('change',syncStockFields);
let batchRequestId=null;$('#batch-open').addEventListener('click',()=>{batchRequestId=crypto.randomUUID();$('#batch-message').dataset.tone='info';$('#batch-message').textContent='';$('#batch-editor').showModal();});$('#batch-close').addEventListener('click',()=>$('#batch-editor').close());$('#batch-form').addEventListener('submit',async event=>{event.preventDefault();const b=$('#batch-save');b.disabled=true;try{const quantity=Number(event.target.elements.quantity.value);if(!await window.KTIVAR.confirm(`Gerar ${quantity} códigos permanentes em estoque?`))return;const d=await api('/plate-batches',{method:'POST',body:JSON.stringify({id:batchRequestId,quantity})});$('#batch-message').dataset.tone='success';$('#batch-message').textContent=`${d.quantity} placas geradas: ${d.codes[0]} a ${d.codes.at(-1)}. Exporte o estoque em CSV para impressão.`;$('#filter-status').value='stock';page=0;await load();}catch(e){$('#batch-message').dataset.tone='danger';$('#batch-message').textContent=e.message;}finally{b.disabled=false;}});
