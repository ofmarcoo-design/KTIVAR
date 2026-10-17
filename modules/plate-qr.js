const QRCode = require('qrcode');

// The serial is print artwork only. The encoded payload remains the permanent URL.
async function plateQrSvg(permanentUrl, serialNumber) {
  if (!Number.isInteger(serialNumber) || serialNumber < 1000 || serialNumber > 9999) {
    throw Object.assign(new Error('Identificador da placa indisponível. Confira a migration de números de série.'), { status: 503 });
  }
  const svg = await QRCode.toString(permanentUrl, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 4,
    color: { dark: '#000000', light: '#ffffff' }
  });
  const size = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  // Preserve all four quiet-zone modules; add a three-module white footer.
  const footer = `<path fill="#ffffff" d="M0 ${size}h${size}v3H0z"/><text x="${size - 1.5}" y="${size + 2}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="1.9" font-weight="400" fill="#64748b" shape-rendering="auto">${serialNumber}</text>`;
  return svg.replace(`viewBox="0 0 ${size} ${size}"`, `viewBox="0 0 ${size} ${size + 3}"`)
    .replace('</svg>', footer + '</svg>');
}

module.exports = { plateQrSvg };
