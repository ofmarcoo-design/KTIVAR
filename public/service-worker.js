// Installation-only worker. Increment when changing this layer's behavior.
const PWA_VERSION = 'ktivar-install-v1';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Explicit network pass-through for compatibility with browsers requiring a fetch handler.
// Never respondWith or cache: auth, private data, QR downloads and /r/:code stay network-only.
self.addEventListener('fetch', () => {});

// Presentation-only notification interaction; no push subscription or network interception.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url === '/notifications' ? '/notifications' : '/dashboard';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    const target=clients.find(c=>{try{return new URL(c.url).origin===self.location.origin;}catch{return false;}});
    if(target){await target.focus();return;}
    await self.clients.openWindow(url);
  }));
});
