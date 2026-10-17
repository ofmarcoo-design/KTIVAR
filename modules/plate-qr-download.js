const { zipSync } = require('fflate');
const { plateQrSvg } = require('./plate-qr');

function validCodes(codes) {
  return Array.isArray(codes) && codes.length > 0 && codes.length <= 50 &&
    codes.every(code => typeof code === 'string' && /^PL-\d{6}$/.test(code)) && new Set(codes).size === codes.length;
}

async function plateQrZip(plates, permanentUrl) {
  const files = Object.create(null);
  for (const plate of plates) {
    const svg = await plateQrSvg(permanentUrl(plate.code), plate.serialNumber);
    files[`${plate.code}-${plate.serialNumber}.svg`] = Buffer.from(svg, 'utf8');
  }
  return Buffer.from(zipSync(files, { level: 6 }));
}

function registerPlateQrDownload(api, supabase, permanentPlateUrl) {
  api.post('/plates/qr.zip', async (req, res, next) => {
    const codes = req.body?.codes;
    if (!validCodes(codes)) return res.status(400).json({ error: 'Selecione de 1 a 50 placas diferentes para baixar os QRs.' });
    try {
      const query = new URLSearchParams({ select: 'code,serialNumber', code: `in.(${codes.join(',')})`, order: 'code.asc', limit: '50' });
      const plates = await supabase(`/rest/v1/plates?${query}`, { token: req.supabaseToken });
      const found = new Set(plates.map(plate => plate.code));
      if (plates.length !== codes.length || found.size !== codes.length || codes.some(code => !found.has(code))) {
        return res.status(404).json({ error: 'Uma placa selecionada não está disponível. Atualize a listagem e tente novamente.' });
      }
      // Generate everything before sending headers: a missing/invalid QR never yields a partial ZIP.
      const zip = await plateQrZip(plates, code => permanentPlateUrl(req, code));
      res.set('Cache-Control', 'no-store').attachment('ktivar-qrs.zip').type('application/zip').send(zip);
    } catch (error) { next(error); }
  });
}

module.exports = { registerPlateQrDownload, plateQrZip, validCodes };
