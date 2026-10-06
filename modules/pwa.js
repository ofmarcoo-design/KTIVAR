const path = require('node:path');

// Public PWA metadata only; application routes and authentication remain unchanged.
function registerPwa(app) {
  app.get('/manifest.webmanifest', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('application/manifest+json');
    res.sendFile(path.join(__dirname, '../public/pwa/manifest.webmanifest'));
  });
  app.get('/service-worker.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, '../public/service-worker.js'));
  });
}
module.exports = { registerPwa };
