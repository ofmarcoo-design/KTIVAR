// Installation-only worker. Increment when changing this layer's behavior.
const PWA_VERSION = 'ktivar-install-v1';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Explicit network pass-through for compatibility with browsers requiring a fetch handler.
// Never respondWith or cache: auth, private data, QR downloads and /r/:code stay network-only.
self.addEventListener('fetch', () => {});
