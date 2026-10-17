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
  // Keep the four-module quiet zone intact. A compact two-module footer
  // holds the serial; equal canvas dimensions keep preview and print square.
  const side = size + 2;
  const serial = `<text x="${side - 1}" y="${size + 1.6}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="1.5" font-weight="400" fill="#64748b" shape-rendering="auto">${serialNumber}</text>`;
  return svg.replace(`viewBox="0 0 ${size} ${size}"`, `viewBox="0 0 ${side} ${side}"`)
    .replace(/(<svg[^>]*>)/, `$1<path fill="#ffffff" d="M0 0h${side}v${side}H0z"/><g transform="translate(1 0)">`)
    .replace('</svg>', '</g>' + serial + '</svg>');
}

module.exports = { plateQrSvg };
