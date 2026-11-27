/* Lanzador de Green Language: app de libre acceso (sin correo ni Google).
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
    shell.classList.remove('ready'); retry.hidden = true; text.textContent = 'Abriendo Green Language…';
    clearTimeout(timer);
    timer = setTimeout(() => { text.textContent = 'Green Language está tardando en abrir. Revisa tu conexión.'; retry.hidden = false; }, 20000);
    app.src = url.href;
  }

  /* Bóveda de Green Language: en iPhone, Safari puede borrar los datos del marco (vercel.app) al cerrar
   * la app instalada. Este lanzador sí conserva los suyos, así que guarda aquí la vinculación
   * adulto–niño y una copia del avance, y se las devuelve a la app cada vez que abre.
   * Solo acepta mensajes del marco de Green Language. */
  const APP_ORIGIN = 'https://green-english.vercel.app';
  const VK = { sync: 'gl.vault.sync.v1', state: 'gl.vault.state.v1', ar: 'gl.vault.ar.v1' };
  const get = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (_) {}
  window.addEventListener('message', e => {
    if (e.origin !== APP_ORIGIN || e.source !== app.contentWindow || !e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (d.type === 'gl:hello') {
      app.contentWindow.postMessage({ type: 'gl:vault', sync: get(VK.sync), state: get(VK.state), ar: get(VK.ar) }, APP_ORIGIN);
    } else if (d.type === 'gl:save') {
      // sync: null = el adulto desvinculó con el botón; se borra solo en ese caso.
      if ('sync' in d && (d.sync === null || (typeof d.sync === 'string' && d.sync.length < 2000))) put(VK.sync, d.sync || '');
      if (typeof d.state === 'string' && d.state.length < 900000) put(VK.state, d.state);
      if (typeof d.ar === 'string' && d.ar.length < 900000) put(VK.ar, d.ar);
    }
  });
  app.addEventListener('load', () => { clearTimeout(timer); shell.classList.add('ready'); });
  retry.addEventListener('click', open);
  open();
})();
