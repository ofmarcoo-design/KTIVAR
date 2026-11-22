(() => {
  const button = document.getElementById('notify-test');
  const result = document.getElementById('notify-result');
  const support = document.getElementById('notify-support');
  if (!button || !result || !support) return;
  const report = message => { result.textContent = message; };
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    button.disabled = true;
    support.textContent = 'Este navegador ou modo de abertura não oferece notificações. No iPhone, adicione o KTIVAR à Tela de Início e abra pelo ícone.';
    return;
  }
  if (!installed && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    support.textContent = 'No iPhone, abra esta página pelo KTIVAR instalado na Tela de Início. O Safari em uma aba normal não recebe Web Push.';
    button.disabled = true;
    return;
  }
  support.textContent = 'Permissão atual: ' + Notification.permission + '.';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      // The permission prompt is triggered by an explicit, user-initiated tap.
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      support.textContent = 'Permissão atual: ' + permission + '.';
      if (permission !== 'granted') {
        report('Notificações não autorizadas. Verifique os Ajustes do iPhone antes de tentar novamente.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('KTIVAR · Teste aprovado', {
        body: 'Este é um teste local das notificações do KTIVAR no seu dispositivo.',
        icon: '/assets/pwa/icon-192.png',
        badge: '/assets/pwa/icon-192.png',
        tag: 'ktivar-device-smoke-test',
        data: { url: '/notifications' }
      });
      report('Solicitação de notificação enviada ao dispositivo. Verifique a Central de Notificações; a exibição depende das configurações do iOS.');
    } catch {
      report('Não foi possível apresentar a notificação. Nenhum dado foi modificado. Consulte permissões e compatibilidade do iPhone.');
    } finally {
      button.disabled = false;
    }
  });
})();