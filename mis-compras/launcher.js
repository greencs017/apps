/* Lanzador de Mis Compras: app de libre acceso (sin correo ni Google).
 * Abre el despliegue de Vercel dentro del marco. Si llega un "#import=…" (puente de Lider/Tottus),
 * se lo pasa a la app y lo borra de la dirección para que no se repita al recargar.
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
  let pendingHash = /^#import=[A-Za-z0-9%+/=_-]{1,20000}$/.test(location.hash) ? location.hash : '';
  if (pendingHash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} }
  let timer;
  function open() {
    const url = new URL(app.dataset.src);
    if (fromHub) url.searchParams.set('via', 'green-apps');
    if (pendingHash) { url.hash = pendingHash; pendingHash = ''; }
    shell.classList.remove('ready'); retry.hidden = true; text.textContent = 'Abriendo Mis Compras…';
    clearTimeout(timer);
    timer = setTimeout(() => { text.textContent = 'Mis Compras está tardando en abrir. Revisa tu conexión.'; retry.hidden = false; }, 20000);
    app.src = url.href;
  }
  app.addEventListener('load', () => { clearTimeout(timer); shell.classList.add('ready'); });
  retry.addEventListener('click', open);
  // Si el puente vuelve con la app ya abierta (misma pestaña), se recarga el marco con los productos.
  window.addEventListener('hashchange', () => {
    if (/^#import=/.test(location.hash)) { pendingHash = location.hash; try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} open(); }
  });
  open();
})();
