const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '32kb' }));
require('./modules/plates').registerPlates(app);

app.get('/r/:code', async (req, res) => {
  // The printed QR always uses this route; never cache a mutable destination.
  res.set('Cache-Control', 'no-store');

  if (!/^PL-\d{6}$/.test(req.params.code)) {
    return res.status(404).send('Placa não encontrada.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).send('Redirecionamento temporariamente indisponível.');
  }

  try {
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/resolve_plate_access`);
    const headers = { apikey: supabaseKey };
    // Legacy anon JWTs need Bearer; modern publishable keys are not JWTs.
    if (!supabaseKey.startsWith('sb_publishable_')) {
      headers.Authorization = `Bearer ${supabaseKey}`;
    }

    const response = await fetch(url, {
      method:'POST',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({p_code:req.params.code,p_record:req.method==='GET'}),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);

    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid plate lookup response');
    const plate = rows[0];
    if (!plate) return res.status(404).send('Placa não encontrada.');
    if (plate.active !== true) return res.status(410).send('Placa inativa.');

    let destination;
    try {
      destination = new URL(plate.destinationUrl);
    } catch {
      return res.status(503).send('Destino da placa indisponível.');
    }
    if (!['http:', 'https:'].includes(destination.protocol)) {
      return res.status(503).send('Destino da placa indisponível.');
    }

    if (req.method==='GET' && plate.recorded===false) console.warn('Plate access analytics unavailable');
    return res.redirect(302, destination.href);
  } catch (error) {
    console.error('Plate redirect lookup failed:', error.message);
    return res.status(503).send('Redirecionamento temporariamente indisponível.');
  }
});

app.get('/', (req, res) => {
  res.redirect('/plates');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    app: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/database', async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      app: 'online',
      database: 'not_configured',
      message: 'Supabase environment variables are missing.'
    });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/health_check?id=eq.1&select=status,checked_at`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Supabase HTTP ${response.status}: ${details}`);
    }

    const rows = await response.json();
    const row = rows[0] || null;

    return res.status(200).json({
      app: 'online',
      database: row?.status || 'online',
      checked_at: row?.checked_at || null
    });
  } catch (error) {
    console.error('Supabase health check failed:', error.message);

    return res.status(503).json({
      app: 'online',
      database: 'offline'
    });
  }
});


// Keep the public redirect's existing responses; handle other unknown routes and failures.
app.use((req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.path.startsWith('/api/'))return res.status(404).json({error:'Recurso não encontrado.'});
 res.status(404).type('text/plain').send('Página não encontrada. Volte para a página principal.');
});
app.use((error,req,res,next)=>{
 if(res.headersSent)return next(error);
 console.error('Request failed:',error.type||error.code||'unexpected');
 res.set('Cache-Control','no-store');
 if(req.path.startsWith('/api/'))return res.status(500).json({error:'Operação temporariamente indisponível.'});
 res.status(500).type('text/plain').send('Página temporariamente indisponível. Tente novamente.');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`KTIVAR online on port ${server.address().port}`);
});
