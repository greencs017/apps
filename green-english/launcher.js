/* Lanzador de Green English: app de libre acceso (sin correo ni Google).
 * Abre el despliegue de Vercel dentro del marco, con permiso de micrófono para el paso «Habla».
 * Si se abrió desde Green Apps, la app muestra el botón para volver. */
(() => {
  'use strict';
  const app = document.getElementById('app'), shell = document.getElementById('shell');
  const text = document.getElementById('loadingText'), retry = document.getElementById('retry');
  let fromHub = false;
  try {
    if (new URLSearchParams(location.search).get('via') === 'green-apps') sessionStorage.setItem('greenapps.via', '1');
    fromHub = sessionStorage.getItem('greenapps.via') === '1';
  } catch (_) {}
  let timer;
  function open() {
    const url = new URL(app.dataset.src);
    if (fromHub) url.searchParams.set('via', 'green-apps');
    shell.classList.remove('ready'); retry.hidden = true; text.textContent = 'Abriendo Green English…';
    clearTimeout(timer);
    timer = setTimeout(() => { text.textContent = 'Green English está tardando en abrir. Revisa tu conexión.'; retry.hidden = false; }, 20000);
    app.src = url.href;
  }
  app.addEventListener('load', () => { clearTimeout(timer); shell.classList.add('ready'); });
  retry.addEventListener('click', open);
  open();
})();
