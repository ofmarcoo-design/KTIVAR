const path = require('node:path');
const { Router } = require('express');
const QRCode = require('qrcode');

const statuses = ['pending', 'active', 'inactive'];
const purposes = ['google_review', 'pix', 'wifi', 'link_bio', 'other'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookies(req) {
  const values = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { values[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1)); } catch { /* Ignore malformed cookies. */ }
    }
  }
  return values;
}

function session(res, tokens, secure) {
  const options = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  if (!tokens) {
    res.clearCookie('ktivar_access', options);
    res.clearCookie('ktivar_refresh', options);
    return;
  }
  res.cookie('ktivar_access', tokens.access_token, { ...options, maxAge: tokens.expires_in * 1000 });
  res.cookie('ktivar_refresh', tokens.refresh_token, { ...options, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function secureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https';
}

function permanentPlateUrl(req, code) {
  // Public printed URLs always use HTTPS, including behind a TLS-terminating proxy.
  return new URL(`/r/${code}`, `https://${req.get('host')}`).href;
}

async function supabase(endpoint, { token, method = 'GET', body, prefer } = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw Object.assign(new Error('Banco não configurado.'), { status: 503 });
  const headers = { apikey: key };
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (!key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  let response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${endpoint}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw Object.assign(new Error('Conexão temporariamente indisponível.'), { status: 503 });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const status = ['23505','PT409','40001','40P01'].includes(data?.code) ? 409 : ['23503', '23514', '22P02', '22007', '22008', '23502'].includes(data?.code) ? 400 : response.status;
    const message = status === 409 ? (data?.code==='23505'?'Este identificador já está cadastrado.':'O registro mudou. Reabra antes de salvar.') : status === 400 ? 'Confira os dados e os vínculos informados.' : status === 401 ? 'E-mail ou senha inválidos, ou sessão expirada.' : status === 403 ? 'Acesso não autorizado.' : 'Não foi possível concluir a operação no banco.';
    throw Object.assign(new Error(message), { status: status >= 500 ? 503 : status });
  }
  return data;
}

async function member(token, userId) {
  const query = new URLSearchParams({ select: 'userId', userId: `eq.${userId}`, limit: '1' });
  const rows = await supabase(`/rest/v1/plate_access?${query}`, { token });
  return rows.length === 1;
}

async function authenticate(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const saved = cookies(req);
  let token = saved.ktivar_access;
  try {
    let user;
    if (token) {
      try { user = await supabase('/auth/v1/user', { token }); }
      catch (error) { if (![400, 401, 403, 422].includes(error.status)) throw error; }
    }
    if (!user && saved.ktivar_refresh) {
      let fresh;
      try {
        fresh = await supabase('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: saved.ktivar_refresh } });
      } catch (error) {
        if (error.status === 400 || error.status === 401) throw Object.assign(new Error('Sessão expirada.'), { status: 401 });
        throw error;
      }
      token = fresh.access_token;
      user = await supabase('/auth/v1/user', { token });
      session(res, fresh, secureRequest(req));
    }
    if (!user) throw Object.assign(new Error('Entre para continuar.'), { status: 401 });
    if (!await member(token, user.id)) throw Object.assign(new Error('Sua conta não tem acesso ao KTIVAR.'), { status: 403 });
    req.supabaseToken = token;
    req.authUser = user;
    next();
  } catch (error) {
    if ([401, 403].includes(error.status)) session(res, null, secureRequest(req));
    if (['/plates','/manage'].includes(req.originalUrl.split('?')[0]) && [401, 403].includes(error.status)) return res.redirect('/login');
    res.status(error.status || 503).json({ error: error.message });
  }
}

function validateDestination(value, host) {
  const text = typeof value === 'string' ? value.trim() : '';
  let url;
  try { url = new URL(text); } catch { throw new Error('Informe uma URL válida.'); }
  if (!['https:', 'http:'].includes(url.protocol) || /[\s\x00-\x1f\x7f]/.test(text) || text.length > 2048 || url.username || url.password) throw new Error('Use uma URL HTTP ou HTTPS válida, sem credenciais.');
  if (host && url.host === host && /^\/r\/PL-\d{6}\/?$/.test(url.pathname)) throw new Error('O destino não pode apontar para o redirecionamento de outra placa neste domínio.');
  return text;
}

function validatePlate(body, allowedStatuses = statuses) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dados inválidos.');
  const clientId = body.clientId;
  const productId = body.productId || null;
  if (!uuid.test(clientId || '')) throw new Error('Selecione um cliente.');
  if (productId && !uuid.test(productId)) throw new Error('Produto inválido.');
  if (!allowedStatuses.includes(body.status)) throw new Error('Selecione o status.');
  if (!purposes.includes(body.purpose)) throw new Error('Selecione a finalidade.');
  const destinationUrl = validateDestination(body.destinationUrl);
  const optionalText = (value, limit) => {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.length > limit) throw new Error('Texto inválido ou muito longo.');
    return value.trim() || null;
  };
  const deliveredAt = body.deliveredAt || null;
  if (deliveredAt) {
    if (typeof deliveredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deliveredAt)) throw new Error('Data de entrega inválida.');
    const parsed = new Date(`${deliveredAt}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deliveredAt) throw new Error('Data de entrega inválida.');
  }
  return { clientId, productId, status: body.status, purpose: body.purpose, destinationUrl, installationLocation: optionalText(body.installationLocation, 300), nfcIdentifier: optionalText(body.nfcIdentifier, 200), deliveredAt };
}

function registerPlates(app) {
  app.use(['/login', '/plates', '/manage', '/assets', '/api'], (req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use('/assets', require('express').static(path.join(__dirname, '../public')));
  app.get('/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, '../views/login.html'));
  });
  app.get('/plates', authenticate, (req, res) => res.sendFile(path.join(__dirname, '../views/plates.html')));
  app.get('/manage', authenticate, (req, res) => res.sendFile(path.join(__dirname, '../views/manage.html')));
  const api = Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      let origin;
      try { origin = new URL(req.get('origin')); } catch { return res.status(403).json({ error: 'Origem da requisição inválida.' }); }
      if (origin.host !== req.get('host') || !req.is('application/json')) return res.status(403).json({ error: 'Origem da requisição inválida.' });
    }
    next();
  });
  // Supabase also limits password attempts. Bound the in-process limiter's memory.
  const attempts = new Map();
  api.post('/login', async (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    if (!email || email.length > 254 || typeof password !== 'string' || !password || password.length > 256) return res.status(400).json({ error: 'Informe e-mail e senha.' });
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
    const key = `${req.ip}:${email}`;
    const attempt = attempts.get(key) || { count: 0, until: now + 10 * 60 * 1000 };
    if (attempt.count >= 10 || attempts.size >= 10000) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
    attempt.count++;
    attempts.set(key, attempt);
    try {
      const tokens = await supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      if (!await member(tokens.access_token, tokens.user.id)) return res.status(403).json({ error: 'Sua conta não tem acesso ao KTIVAR.' });
      session(res, tokens, secureRequest(req));
      attempts.delete(key);
      res.json({ email: tokens.user.email });
    } catch (error) {
      if ([400, 401, 422].includes(error.status)) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      next(error);
    }
  });
  api.use(authenticate);
  require('./statuses').registerStatuses(api, supabase);
  require('./workspace').registerWorkspace(api, supabase);
  require('./crm').registerCRM(api, supabase);
  api.get('/session', (req, res) => res.json({ email: req.authUser.email }));
  api.post('/logout', async (req, res, next) => {
    try {
      await supabase('/auth/v1/logout?scope=local', { token: req.supabaseToken, method: 'POST' });
      session(res, null, secureRequest(req));
      res.json({ ok: true });
    } catch (error) { session(res, null, secureRequest(req)); next(error); }
  });
  const selection = 'code,clientId,productId,status,purpose,installationLocation,destinationUrl,nfcIdentifier,deliveredAt,createdAt,updatedAt,revision,client:clients(id,name,company,phone),product:products(id,name)';
  api.get('/plates', async (req, res, next) => {
    const page = Math.max(0, Math.min(100000, Number.parseInt(req.query.page, 10) || 0));
    const query = new URLSearchParams({ select: selection, order: 'createdAt.desc,code.desc', limit: '51', offset: String(page * 50) });
    if (req.query.search) {
      const search = String(req.query.search).trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
      if (search) query.set('code', `ilike.*${search}*`);
    }
    for (const field of ['clientId', 'productId', 'status']) {
      if (!req.query[field]) continue;
      const value = String(req.query[field]);
      if (field === 'status' ? !/^[a-z][a-z0-9_-]{0,63}$/.test(value) : !uuid.test(value)) return res.status(400).json({ error: 'Filtro inválido.' });
      query.set(field, `eq.${value}`);
    }
    try {
      const rows = await supabase(`/rest/v1/plates?${query}`, { token: req.supabaseToken });
      res.json({ items: rows.slice(0, 50), hasMore: rows.length > 50, page });
    } catch (error) { next(error); }
  });
  api.get('/plates/:code', async (req, res, next) => {
    if (!/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({ error: 'Placa não encontrada.' });
    try {
      const query = new URLSearchParams({ select: selection, code: `eq.${req.params.code}`, limit: '1' });
      const rows = await supabase(`/rest/v1/plates?${query}`, { token: req.supabaseToken });
      if (!rows.length) return res.status(404).json({ error: 'Placa não encontrada.' });
      res.json({ ...rows[0], permanentUrl: permanentPlateUrl(req, rows[0].code) });
    } catch (error) { next(error); }
  });
  api.get('/plates/:code/qr.svg', async (req, res, next) => {
    if (!/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({ error: 'Placa não encontrada.' });
    try {
      const query = new URLSearchParams({ select: 'code', code: `eq.${req.params.code}`, limit: '1' });
      const rows = await supabase(`/rest/v1/plates?${query}`, { token: req.supabaseToken });
      if (!rows.length) return res.status(404).json({ error: 'Placa não encontrada.' });
      const svg = await QRCode.toString(permanentPlateUrl(req, rows[0].code), {
        type: 'svg', errorCorrectionLevel: 'M', margin: 4,
        color: { dark: '#000000', light: '#ffffff' }
      });
      res.type('image/svg+xml');
      if (req.query.download === '1') res.attachment(`${rows[0].code}.svg`);
      res.send(svg);
    } catch (error) { next(error); }
  });
  api.get('/plates/:code/analytics', async(req,res,next)=>{
    if(!/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({error:'Placa não encontrada.'});
    try {res.json(await supabase('/rest/v1/rpc/plate_scan_summary',{token:req.supabaseToken,method:'POST',body:{p_code:req.params.code}}));}
    catch(error){next(error);}
  });
  api.get('/plates/:code/destination-history', async (req, res, next) => {
    if (!/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({ error: 'Placa não encontrada.' });
    try {
      const query = new URLSearchParams({ select: '*', plateCode: `eq.${req.params.code}`, order: 'createdAt.desc,id.desc', limit: '51', offset: String(Math.max(0, Number.parseInt(req.query.page,10)||0)*50) });
      const rows = await supabase(`/rest/v1/plate_destination_history?${query}`, { token: req.supabaseToken });
      res.json({ items: rows.slice(0,50), hasMore: rows.length>50 });
    } catch (error) { next(error); }
  });
  api.patch('/plates/:code/destination', async (req, res, next) => {
    if (!/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({ error: 'Placa não encontrada.' });
    let destinationUrl;
    try { destinationUrl = validateDestination(req.body?.destinationUrl, req.get('host')); } catch(error) { return res.status(400).json({ error:error.message }); }
    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision<0) return res.status(428).json({error:'Reabra a placa para carregar a versão atual.'});
    try {
      const query = new URLSearchParams({ select:'code,destinationUrl,revision', code:`eq.${req.params.code}`, revision:`eq.${req.body.revision}` });
      const rows=await supabase(`/rest/v1/plates?${query}`,{token:req.supabaseToken,method:'PATCH',body:{destinationUrl},prefer:'return=representation'});
      if(!rows.length) return res.status(409).json({error:'A placa mudou. Reabra-a antes de salvar.'});
      res.json(rows[0]);
    } catch(error) { next(error); }
  });
  for (const method of ['post', 'patch']) api[method](method === 'post' ? '/plates' : '/plates/:code', async (req, res, next) => {
    if (method === 'patch' && !/^PL-\d{6}$/.test(req.params.code)) return res.status(404).json({ error: 'Placa não encontrada.' });
    let values;
    try {
      const available = await supabase('/rest/v1/plate_statuses?select=key', {token:req.supabaseToken});
      values = validatePlate(req.body, available.map(item=>item.key)); validateDestination(values.destinationUrl,req.get('host'));
    } catch (error) { if(error.status) return next(error); return res.status(400).json({ error: error.message }); }
    try {
      const query = new URLSearchParams({ select: 'code' });
      if (method === 'patch') {
        if (!Number.isSafeInteger(req.body?.revision) || req.body.revision<0) return res.status(428).json({error:'Reabra a placa para carregar a versão atual.'});
        query.set('code', `eq.${req.params.code}`); query.set('revision', `eq.${req.body.revision}`);
      }
      const rows = await supabase(`/rest/v1/plates?${query}`, { token: req.supabaseToken, method: method.toUpperCase(), body: values, prefer: 'return=representation' });
      if (!rows.length) return res.status(409).json({ error: 'A placa mudou. Reabra-a antes de salvar.' });
      res.status(method === 'post' ? 201 : 200).json(rows[0]);
    } catch (error) { next(error); }
  });
  for (const table of ['clients', 'products']) {
    api.get(`/${table}`, async (req, res, next) => {
      const search = String(req.query.search || '').replace(/[*,()%_]/g, '').slice(0, 120);
      const query = new URLSearchParams({ select: table === 'clients' ? 'id,name,company,phone' : 'id,name', order: 'name.asc', limit: '50' });
      if (search) query.set('name', `ilike.*${search}*`);
      try { res.json(await supabase(`/rest/v1/${table}?${query}`, { token: req.supabaseToken })); } catch (error) { next(error); }
    });
    api.post(`/${table}`, async (req, res, next) => {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 160) return res.status(400).json({ error: 'Informe um nome de até 160 caracteres.' });
      const values = { name };
      if (table === 'clients') for (const field of ['company', 'phone']) {
        const value = req.body[field];
        if (value != null && (typeof value !== 'string' || value.length > 160)) return res.status(400).json({ error: 'Dados do cliente inválidos.' });
        values[field] = value?.trim() || null;
      }
      try {
        const rows = await supabase(`/rest/v1/${table}?select=*`, { token: req.supabaseToken, method: 'POST', body: values, prefer: 'return=representation' });
        res.status(201).json(rows[0]);
      } catch (error) { next(error); }
    });
  }
  api.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 503).json({ error: error.message || 'Operação indisponível.' });
  });
  app.use('/api', api);
  app.use((error, req, res, next) => {
    if (req.originalUrl.startsWith('/api/') && ['entity.parse.failed', 'entity.too.large'].includes(error.type)) {
      return res.status(error.status).json({ error: 'Corpo da requisição inválido ou muito grande.' });
    }
    next(error);
  });
}

module.exports = { registerPlates, validatePlate, validateDestination, supabase, authenticate };
