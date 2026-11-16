/* Lanzador de Mis Calorías: app de libre acceso (sin correo ni Google).
 * Abre el despliegue de Vercel dentro del marco. Si se abrió desde Green Apps, la app muestra el botón para volver. */
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
    shell.classList.remove('ready'); retry.hidden = true; text.textContent = 'Abriendo Mis Calorías…';
    clearTimeout(timer);
    timer = setTimeout(() => { text.textContent = 'Mis Calorías está tardando en abrir. Revisa tu conexión.'; retry.hidden = false; }, 20000);
    app.src = url.href;
  }
  app.addEventListener('load', () => { clearTimeout(timer); shell.classList.add('ready'); });
  // iPhone con la app instalada: el alto "100%" no incluye la zona de la isla/notch y queda una franja abajo.
  function fit() {
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    const portrait = innerHeight >= innerWidth;
    const h = standalone ? Math.max(innerHeight, portrait ? screen.height : screen.width) : innerHeight;
    app.style.height = h + 'px'; shell.style.height = h + 'px';
  }
  fit(); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300));
  retry.addEventListener('click', open);
  open();
})();
