const actions = new Set(['archive', 'restore', 'activate', 'deactivate']);

function validateBulk(body) {
  if (!body || !actions.has(body.action) || !Array.isArray(body.plates) || body.plates.length < 1 || body.plates.length > 50) return false;
  return new Set(body.plates.map(p => p?.code)).size === body.plates.length && body.plates.every(p => typeof p?.code === 'string' && /^PL-\d{6}$/.test(p.code) && Number.isSafeInteger(p.revision) && p.revision >= 0);
}

function registerPlateBulk(api, supabase) {
  api.post('/plates/bulk', async (req, res, next) => {
    if (!validateBulk(req.body)) return res.status(400).json({ error: 'Selecione de 1 a 50 placas da página e uma ação válida. Atualize a listagem antes de tentar novamente.' });
    try {
      const result = await supabase('/rest/v1/rpc/bulk_plate_action', { token: req.supabaseToken, method: 'POST', body: { p_action: req.body.action, p_plates: req.body.plates } });
      res.json(result);
    } catch (error) {
      if (error.status === 400) error.message = 'Nenhuma placa foi alterada. Para ativar ou desativar, restaure as arquivadas e confira se todas possuem cliente e destino.';
      if (error.status === 409) error.message = 'Nenhuma placa foi alterada. A seleção ou o status mudou. Atualize a listagem e selecione novamente.';
      next(error);
    }
  });
}

module.exports = { registerPlateBulk, validateBulk };
