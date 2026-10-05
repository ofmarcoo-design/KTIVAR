const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('App online');
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KTVAR online on port ${PORT}`);
});
