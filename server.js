require('dotenv').config();

const express = require('express');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('App online');
});

app.get('/health/database', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('health_check')
      .select('status, checked_at')
      .eq('id', 1)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      app: 'online',
      database: data?.status || 'online',
      checked_at: data?.checked_at || null
    });
  } catch (error) {
    console.error('Erro Supabase:', error.message);

    res.status(500).json({
      app: 'online',
      database: 'offline'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App online na porta ${PORT}`);
});
