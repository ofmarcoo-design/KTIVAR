// Installation layer only. The existing application continues to use the network.
(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none'
    }).catch(error => console.warn('Registro do PWA indisponível:', error.message));
  }, { once: true });
})();
