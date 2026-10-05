const $ = selector => document.querySelector(selector);
const form = $('#plate-form');
const editor = $('#editor');
const statusLabels = { pending: 'Pendente', active: 'Ativa', inactive: 'Inativa' };
const purposeLabels = { google_review: 'Avaliação Google', pix: 'Pix', wifi: 'Wi-Fi', link_bio: 'Link na bio', other: 'Outra' };
let page = 0;
let editing = null;
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
function action(label, handler) { const button = document.createElement('button'); button.textContent = label; button.className = 'secondary'; button.addEventListener('click', handler); return button; }
function debounce(fn) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), 250); }; }
function showError(error) { $('#message').textContent = error.message; }
async function load() {
  const id = ++listRequest;
  $('#message').textContent = 'Carregando placas…';
  try {
    const data = await api(`/plates?page=${page}&search=${encodeURIComponent($('#search').value)}`);
    if (id !== listRequest) return;
    $('#rows').replaceChildren();
    for (const plate of data.items) {
      const row = document.createElement('tr');
      cell(row, plate.code, 'Código');
      const client = cell(row, plate.client?.name, 'Cliente');
      if (plate.client?.company) { const small = document.createElement('small'); small.textContent = plate.client.company; client.append(small); }
      cell(row, purposeLabels[plate.purpose], 'Finalidade');
      const badge = document.createElement('span'); badge.className = `badge ${plate.status}`; badge.textContent = statusLabels[plate.status]; cell(row, '', 'Status').replaceChildren(badge);
      cell(row, plate.installationLocation, 'Instalação');
      cell(row, '', 'Ações').replaceChildren(action('Ver', () => view(plate.code)), action('Editar', () => openEditor(plate.code)));
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
async function openEditor(code = null) {
  try {
    const plate = code ? await api(`/plates/${code}`) : null;
    editing = code;
    form.reset();
    $('#client-search').value = ''; $('#product-search').value = '';
    $('#form-message').textContent = ''; $('#dates').textContent = '';
    $('#editor-title').textContent = code ? `Editar ${code}` : 'Nova placa';
    if (plate) {
      for (const [key, value] of Object.entries(plate)) if (form.elements[key] && !['clientId', 'productId'].includes(key)) form.elements[key].value = value ?? '';
      $('#dates').textContent = `Criada em ${date(plate.createdAt)} · Atualizada em ${date(plate.updatedAt)}`;
    }
    await Promise.all([references('clients', plate?.client), references('products', plate?.product)]);
    editor.showModal();
  } catch (error) { showError(error); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#save'); button.disabled = true; $('#form-message').textContent = '';
  try {
    const values = Object.fromEntries(new FormData(form)); delete values.code;
    const result = await api(editing ? `/plates/${editing}` : '/plates', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(values) });
    editor.close();
    page = 0; $('#search').value = '';
    await load();
    $('#message').textContent = `${result.code} salva.`;
  } catch (error) { $('#form-message').textContent = error.message; }
  finally { button.disabled = false; }
});
async function view(code) {
  try {
    const plate = await api(`/plates/${code}`); viewed = code;
    $('#view-title').textContent = plate.code; $('#details').replaceChildren();
    $('#qr-code').textContent = plate.code;
    $('#qr-image').alt = `QR da placa ${plate.code}`;
    $('#qr-message').textContent = 'Carregando QR…';
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
  } catch (error) { showError(error); }
}
$('#qr-image').addEventListener('load', () => { $('#qr-message').textContent = ''; });
$('#qr-image').addEventListener('error', () => { $('#qr-message').textContent = 'Não foi possível carregar o QR. Reabra a placa para tentar novamente.'; });
$('#view-close').addEventListener('click', () => $('#viewer').close());
$('#view-edit').addEventListener('click', () => { $('#viewer').close(); openEditor(viewed); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => editor.close());
$('#new').addEventListener('click', () => openEditor());
$('#reload').addEventListener('click', load);
$('#previous').addEventListener('click', () => { page--; load(); });
$('#next').addEventListener('click', () => { page++; load(); });
$('#search').addEventListener('input', debounce(() => { page = 0; load(); }));
for (const type of ['clients', 'products']) {
  const singular = type === 'clients' ? 'client' : 'product';
  $(`#${singular}-search`).addEventListener('input', debounce(() => references(type).catch(error => { $('#form-message').textContent = error.message; })));
  $(`#add-${singular}`).addEventListener('click', () => {
    referenceType = type; $('#reference-form').reset(); $('#reference-message').textContent = '';
    $('#reference-title').textContent = type === 'clients' ? 'Cadastrar cliente' : 'Cadastrar produto';
    $('#client-fields').hidden = type !== 'clients'; $('#reference-dialog').showModal();
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
load();
