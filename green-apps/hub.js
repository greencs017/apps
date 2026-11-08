/* Green Apps: portal que reúne las aplicaciones.
 * - Cada persona ve solo las aplicaciones en que está autorizada (lo decide cada aplicación).
 * - Ingreso único: el correo (o Google, para el administrador) vincula este dispositivo en todas.
 * - Cada aplicación se abre con su propio lanzador, que sigue funcionando igual por separado.
 * Todo el texto recibido se muestra con textContent. */
(() => {
  'use strict';
  const APPS = [
    { id: 'escalafon', name: 'Escalafón Online', desc: 'Escalafón, ascensos y retiros', path: '../escalafon-online/',
      icon: '../escalafon-online/icons-v3/icon-192.png', api: 'https://escalafon-online.vercel.app/api/green-apps' },
    { id: 'simulador', name: 'Simulador de Remuneraciones', desc: 'Cálculo de remuneraciones', path: '../simulador-remuneraciones/',
      icon: '../simulador-remuneraciones/icono-simulador-v6.png', api: 'https://simulador-remuneraciones-delta.vercel.app/api/green-apps', tablet: true },
    { id: 'licencias', name: 'Revisor de Licencias Médicas', desc: 'Revisión y cotejo de licencias', path: '../revisor-licencias-medicas/',
      icon: '../revisor-licencias-medicas/icono-licencias-192.png', api: 'https://revisor-licencias-medicas.vercel.app/api/green-apps' },
    { id: 'revisor', name: 'Revisor de Cargo Fiscal', desc: 'Revista técnica L5', path: '../revisor-cargo-fiscal/',
      icon: '../revisor-cargo-fiscal/icons-v6/icon-192.png', api: 'https://revisor-cargo-l5.vercel.app/api/green-apps' }
  ];
  const CLIENT_ID = '892491045559-mt2b7iabv71djbu6icf6rpl2a2fa90e8.apps.googleusercontent.com';
  const EMAIL_KEY = 'greenapps.email.v1', KNOWN_KEY = 'greenapps.authorized.v1', GOOGLE_KEY = 'greenapps.google.v1';
  const DEVICE_STORAGE_KEY = 'apps.admin.device.v1', DEVICE_COOKIE_KEY = 'apps_admin_device_v1';
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} }
  };

  // ---------- Dispositivo: el mismo identificador que usan los lanzadores de cada aplicación ----------
  function hex() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join(''); }
  function deviceKey() {
    let key = store.get(DEVICE_STORAGE_KEY);
    if (!/^[a-f0-9]{64}$/.test(key)) {
      const c = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(DEVICE_COOKIE_KEY + '='));
      try { key = c ? decodeURIComponent(c.slice(DEVICE_COOKIE_KEY.length + 1)) : ''; } catch (_) { key = ''; }
    }
    if (!/^[a-f0-9]{64}$/.test(key)) key = hex();
    store.set(DEVICE_STORAGE_KEY, key);
    document.cookie = DEVICE_COOKIE_KEY + '=' + encodeURIComponent(key) + '; Path=/apps/; Max-Age=315360000; SameSite=Lax; Secure';
    return key;
  }
  const ua = navigator.userAgent || '';
  const ipad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const ios = ipad || /iPhone|iPod/i.test(ua);
  const deviceFor = app => (app.tablet && ipad ? 'tablet' : (ipad || /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop')) + ':' + deviceKey();

  // ---------- Servicio de acceso de cada aplicación ----------
  async function ask(app, body) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(app.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, device: deviceFor(app) }),
        signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw Error(j.error || 'No respondió.');
      return j.data;
    } finally { clearTimeout(timer); }
  }
  async function askAll(body) {
    const out = await Promise.all(APPS.map(app => ask(app, body).then(data => ({ app, data }), error => ({ app, error: error.name === 'AbortError' ? 'No respondió a tiempo.' : 'Sin conexión con el servicio.' }))));
    const known = new Set(store.get(KNOWN_KEY).split(',').filter(Boolean));
    out.forEach(r => { if (r.data) r.data.acceso === 'AUTORIZADO' ? known.add(r.app.id) : known.delete(r.app.id); });
    store.set(KNOWN_KEY, [...known].join(','));
    return out;
  }

  // ---------- Vista ----------
  const status = (text, error = false) => { $('status').textContent = text || ''; $('status').classList.toggle('error', !!error); };
  function open(app) {
    try { sessionStorage.setItem('greenapps.via', '1'); } catch (_) {}
    location.href = app.path + '?via=green-apps';
  }
  function card(app, stateText, warn) {
    const b = el('button', 'app'); b.type = 'button';
    const img = el('img'); img.src = app.icon; img.alt = ''; img.width = 56; img.height = 56;
    b.append(img, el('span', 'name', app.name), el('span', 'desc', app.desc), el('span', 'state' + (warn ? ' warn' : ''), stateText));
    b.onclick = () => open(app);
    return b;
  }
  const LABEL = { PENDIENTE: 'Solicitud pendiente de aprobación', RECHAZADO: 'Solicitud rechazada', SIN_ACCESO: 'Sin acceso · Solicitar' };
  function render(results) {
    const grid = $('apps'), others = $('othersList');
    grid.textContent = ''; others.textContent = '';
    const known = new Set(store.get(KNOWN_KEY).split(',').filter(Boolean));
    let name = '', mine = 0, pendingLink = 0, recognized = 0, otherCount = 0, failed = 0;
    for (const { app, data, error } of results) {
      if (error) {
        failed++;
        if (known.has(app.id)) { grid.appendChild(card(app, error + ' Puedes intentar abrirla.', true)); mine++; }
        continue;
      }
      if (data.reconocido && data.nombre && !name) name = data.nombre;
      if (data.acceso === 'AUTORIZADO') {
        mine++;
        if (data.reconocido) recognized++; else pendingLink++;
        grid.appendChild(card(app, data.reconocido ? 'Listo para entrar' : (data.mensaje || 'Primera vez en este dispositivo: confirma tu ingreso en la aplicación.'), !data.reconocido));
      } else {
        otherCount++;
        const b = el('button', 'other'); b.type = 'button';
        const img = el('img'); img.src = app.icon; img.alt = '';
        const t = el('span', '', app.name); t.appendChild(el('small', '', LABEL[data.acceso] || LABEL.SIN_ACCESO));
        b.append(img, t); b.onclick = () => open(app);
        others.appendChild(b);
      }
    }
    $('greeting').textContent = name ? 'Hola, ' + (name === 'Administrador' ? 'administrador' : name.split(' ')[0]) : 'Tus aplicaciones en un solo lugar';
    $('otherApps').hidden = !otherCount;
    $('login').hidden = !(recognized === 0 || pendingLink > 0 || showLogin);
    if (!mine) status(failed === APPS.length ? 'No fue posible revisar tus accesos. Revisa tu conexión y pulsa Actualizar.' : 'Aún no tienes aplicaciones vinculadas en este dispositivo. Ingresa tu correo para continuar.', failed === APPS.length);
    else status(mine === 1 ? 'Tienes 1 aplicación.' : 'Tienes ' + mine + ' aplicaciones.');
  }

  let showLogin = false, busy = false;
  async function refresh() {
    if (busy) return; busy = true;
    status('Revisando tus accesos…');
    try { render(await askAll({ op: 'estado', email: store.get(EMAIL_KEY) })); } finally { busy = false; }
  }

  $('emailForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status('Escribe un correo válido.', true); return; }
    const btn = e.submitter || $('emailForm').querySelector('button'); btn.disabled = true;
    status('Vinculando este dispositivo en tus aplicaciones…');
    try {
      store.set(EMAIL_KEY, email); showLogin = false;
      render(await askAll({ op: 'vincularCorreo', email }));
    } finally { btn.disabled = false; }
  };

  // ---------- Administrador: Google una sola vez para todas las aplicaciones ----------
  let googleLoaded = null;
  function loadGoogle() {
    if (googleLoaded) return googleLoaded;
    googleLoaded = new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => window.google && google.accounts && google.accounts.id ? resolve() : reject(Error('Google no pudo iniciarse.'));
      s.onerror = () => reject(Error('No fue posible cargar Google.'));
      document.head.appendChild(s);
    });
    return googleLoaded;
  }
  function credentialExp(jwt) {
    try { return Number(JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp) || 0; } catch (_) { return 0; }
  }
  document.querySelector('details.owner').addEventListener('toggle', async ev => {
    if (!ev.target.open || $('googleButton').childElementCount) return;
    $('googleStatus').textContent = 'Preparando Google…';
    try {
      await loadGoogle();
      google.accounts.id.initialize({ client_id: CLIENT_ID, auto_select: false, cancel_on_tap_outside: false, callback: async r => {
        if (!r.credential) { $('googleStatus').textContent = 'Google no entregó una credencial.'; return; }
        // Queda solo en esta sesión del navegador: si una aplicación vuelve a pedir Google, su lanzador la reutiliza.
        try { sessionStorage.setItem(GOOGLE_KEY, JSON.stringify({ credential: r.credential, exp: credentialExp(r.credential) })); } catch (_) {}
        $('googleStatus').textContent = 'Vinculando este dispositivo en las aplicaciones…';
        status('Vinculando este dispositivo en las aplicaciones…');
        const results = await askAll({ op: 'vincularGoogle', credential: r.credential });
        const linked = results.filter(x => x.data && x.data.reconocido).length;
        $('googleStatus').textContent = linked ? 'Listo: vinculado en ' + linked + ' de ' + APPS.length + ' aplicaciones.' : 'No se pudo vincular. ' + ((results.find(x => x.data && x.data.mensaje) || {}).data || {}).mensaje;
        showLogin = false; render(results);
      } });
      google.accounts.id.renderButton($('googleButton'), { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'es',
        width: Math.min(320, window.innerWidth - 80) });
      $('googleStatus').textContent = '';
    } catch (error) { $('googleStatus').textContent = error.message; }
  });

  $('refresh').onclick = () => refresh();
  $('forget').onclick = () => { store.set(EMAIL_KEY, ''); $('email').value = ''; showLogin = true; $('login').hidden = false; $('email').focus(); };
  $('email').value = store.get(EMAIL_KEY);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  $('installHint').hidden = !(ios && !standalone);
  try { sessionStorage.removeItem('greenapps.via'); } catch (_) {}
  window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
  refresh();
})();
