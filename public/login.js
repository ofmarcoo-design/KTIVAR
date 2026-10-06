const form = document.querySelector('#login');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  const message = document.querySelector('#message');
  const label=button.textContent;button.disabled = true;button.textContent='Entrando…';
  message.textContent = '';
  try {
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
    window.location.assign(data.redirect || '/plates');
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false;button.textContent=label; }
});
