/* Green Apps: portal que reúne las aplicaciones.
 * - Cada persona ve solo las aplicaciones en que está autorizada (lo decide cada aplicación).
 * - Ingreso único: el correo (o Google, para el administrador) vincula este dispositivo en todas.
 * - Cada aplicación se abre con su propio lanzador, que sigue funcionando igual por separado.
 * Todo el texto recibido se muestra con textContent. */
(() => {
  'use strict';
  const APPS = [
    { id: 'escalafon', short: 'Escalafón', name: 'Escalafón Online', desc: 'Escalafón, ascensos y retiros', path: '../escalafon-online/',
      icon: '../escalafon-online/icons-v3/icon-192.png', api: 'https://escalafon-online.vercel.app/api/green-apps' },
    { id: 'simulador', short: 'Simulador', name: 'Simulador de Remuneraciones', desc: 'Cálculo de remuneraciones', path: '../simulador-remuneraciones/',
      icon: '../simulador-remuneraciones/icono-simulador-v6.png', api: 'https://simulador-remuneraciones-delta.vercel.app/api/green-apps' },
    { id: 'licencias', short: 'Licencias', name: 'Revisor de Licencias Médicas', desc: 'Revisión y cotejo de licencias', path: '../revisor-licencias-medicas/',
      icon: '../revisor-licencias-medicas/icono-licencias-192.png', api: 'https://revisor-licencias-medicas.vercel.app/api/green-apps' },
    { id: 'revisor', short: 'Cargo Fiscal', name: 'Revisor de Cargo Fiscal', desc: 'Revista técnica L5', path: '../revisor-cargo-fiscal/',
      icon: '../revisor-cargo-fiscal/icons-v6/icon-192.png', api: 'https://revisor-cargo-l5.vercel.app/api/green-apps' }
  ];
  // Aplicaciones de libre acceso: se muestran a todos, sin revisar autorización ni pedir correo.
  const FREE_APPS = [
    { id: 'academia-fight', name: 'Academia Fight', desc: 'Juego de peleas', path: '../academia-fight/', icon: '../academia-fight/icon-192.png?v=1' },
    { id: 'green-english', name: 'Green English', desc: 'Inglés para niños', path: '../green-english/', icon: '../green-english/icon-192.png?v=1' }
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
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  // Estructura común: el iPad ocupa el cupo «móvil/tablet» en todas las aplicaciones.
  const deviceFor = () => (ipad || /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop') + ':' + deviceKey();

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
  let lastResults = [];
  function render(results) {
    lastResults = results;
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
    const adminApps = results.filter(r => r.data && r.data.owner && r.data.reconocido).map(r => r.app);
    // Confirmación periódica con Google (cada 30 días): se abre directamente la opción del administrador.
    if (results.some(r => r.data && r.data.owner && !r.data.reconocido)) { $('login').hidden = false; document.querySelector('details.owner').open = true; }
    $('openPanel').hidden = !adminApps.length;
    if (adminApps.length) loadPanel(adminApps, true);
    // Desde un aviso (…/green-apps/?panel=1) se abre directamente el panel.
    if (adminApps.length && !panelOpenedFromLink && new URLSearchParams(location.search).get('panel') === '1') {
      panelOpenedFromLink = true; $('openPanel').click();
    }
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

  // ---------- Panel único de autorizaciones (solo el administrador) ----------
  // Cada aplicación valida en su servidor que este dispositivo sea del administrador y aplica sus propias reglas.
  let panelOpenedFromLink = false;
  let panelApps = [], people = new Map(), panelErrors = [];
  const STATE_TEXT = { AUTORIZADO: 'Autorizado', PENDIENTE: 'Pendiente', RECHAZADO: 'Rechazado', SIN: 'Sin acceso' };
  const DEVICE_TEXT = { mobile: 'móvil', tablet: 'tablet', desktop: 'computador' };
  const pstatus = (t, e = false) => { $('panelStatus').textContent = t || ''; $('panelStatus').classList.toggle('error', !!e); };
  async function loadPanel(apps, quiet = false) {
    panelApps = apps;
    if (!quiet) pstatus('Cargando autorizaciones…');
    const lists = await Promise.all(apps.map(app => ask(app, { op: 'admin', accion: 'listar' }).then(d => ({ app, usuarios: d.usuarios }), e => ({ app, error: e.message }))));
    people = new Map(); panelErrors = lists.filter(l => l.error);
    for (const l of lists) for (const u of l.usuarios || []) {
      const key = String(u.email).toLowerCase();
      const p = people.get(key) || { email: key, nombre: '', apps: {} };
      if (!p.nombre && u.nombre) p.nombre = u.nombre;
      p.apps[l.app.id] = u; people.set(key, p);
    }
    const pending = [...people.values()].filter(needsAttention).length;
    $('panelBadge').hidden = !pending; $('panelBadge').textContent = pending;
    if (!$('panel').hidden) renderPanel();
    if (!quiet) pstatus(panelErrors.length ? 'No respondió: ' + panelErrors.map(l => l.app.short).join(', ') + '.' : people.size + ' persona(s) registradas.', !!panelErrors.length);
  }
  const needsAttention = p => Object.values(p.apps).some(u => u.estado === 'PENDIENTE' || (u.pendientes || []).length);
  function action(label, cls, fn, confirmText) {
    const b = el('button', 'act' + (cls ? ' ' + cls : ''), label); b.type = 'button';
    b.onclick = async () => {
      if (confirmText && !confirm(confirmText)) return;
      document.querySelectorAll('#panel .act').forEach(x => { x.disabled = true; });
      pstatus('Guardando…');
      try { await fn(); await loadPanel(panelApps); pstatus('Listo.'); }
      catch (e) { pstatus(e.message, true); renderPanel(); }
    };
    return b;
  }
  async function adminDo(app, accion, extra) { await ask(app, { op: 'admin', accion, ...extra }); }
  function personCard(p) {
    const box = el('div', 'person' + (needsAttention(p) ? ' attention' : ''));
    const head = el('div', 'person-head');
    head.append(el('strong', '', p.nombre || p.email), el('small', '', p.email));
    box.appendChild(head);
    for (const app of panelApps) {
      const u = p.apps[app.id], estado = u ? u.estado : 'SIN';
      const row = el('div', 'app-row');
      row.append(el('span', 'app-name', app.short), el('span', 'chip ' + estado, STATE_TEXT[estado] || estado));
      if (u && estado === 'AUTORIZADO') {
        const bound = Object.entries(u.dispositivos || {}).filter(([, v]) => v).map(([k]) => DEVICE_TEXT[k] || k);
        row.appendChild(el('span', 'devices', bound.length ? 'Vinculado: ' + bound.join(', ') : 'Sin dispositivo vinculado'));
      }
      const nombre = p.nombre;
      if (estado !== 'AUTORIZADO') row.appendChild(action('Autorizar', 'ok', () => adminDo(app, 'autorizar', { email: p.email, nombre })));
      if (estado === 'PENDIENTE') row.appendChild(action('Rechazar', 'bad', () => adminDo(app, 'rechazar', { email: p.email })));
      if (estado === 'AUTORIZADO') {
        for (const tipo of u.pendientes || []) {
          row.appendChild(action('Aprobar ' + (DEVICE_TEXT[tipo] || tipo) + ' nuevo', 'ok', () => adminDo(app, 'aprobarDispositivo', { email: p.email, tipo })));
          row.appendChild(action('No aprobar', 'bad', () => adminDo(app, 'rechazarDispositivo', { email: p.email, tipo })));
        }
        if (Object.values(u.dispositivos || {}).some(Boolean))
          row.appendChild(action('Restablecer dispositivos', '', () => adminDo(app, 'restablecer', { email: p.email }),
            'Se desvincularán los dispositivos de ' + (p.nombre || p.email) + ' en ' + app.short + '. Deberá volver a ingresar. ¿Continuar?'));
        row.appendChild(action('Quitar acceso', 'bad', () => adminDo(app, 'rechazar', { email: p.email }),
          '¿Quitar el acceso de ' + (p.nombre || p.email) + ' a ' + app.short + '?'));
      }
      box.appendChild(row);
    }
    const foot = el('div', 'person-foot');
    foot.appendChild(action('Eliminar de todas', 'bad', async () => {
      for (const app of panelApps) if (p.apps[app.id]) await adminDo(app, 'eliminar', { email: p.email });
    }, '¿Eliminar a ' + (p.nombre || p.email) + ' de todas las aplicaciones? Deberá solicitar acceso de nuevo.'));
    box.appendChild(foot);
    return box;
  }
  function renderPanel() {
    const all = [...people.values()].sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email, 'es'));
    const pend = all.filter(needsAttention);
    const pbox = $('pending'); pbox.textContent = '';
    if (pend.length) { pbox.appendChild(el('h3', '', 'Solicitudes por revisar (' + pend.length + ')')); pend.forEach(p => pbox.appendChild(personCard(p))); }
    const q = $('search').value.trim().toLowerCase();
    const list = $('people'); list.textContent = '';
    const shown = all.filter(p => !needsAttention(p) && (!q || (p.nombre + ' ' + p.email).toLowerCase().includes(q)));
    shown.forEach(p => list.appendChild(personCard(p)));
    if (!shown.length) list.appendChild(el('p', 'note', q ? 'Nadie coincide con la búsqueda.' : 'No hay más personas registradas.'));
    const fs = $('addApps');
    fs.querySelectorAll('label').forEach(x => x.remove());
    for (const app of panelApps) {
      const l = el('label'), c = el('input'); c.type = 'checkbox'; c.value = app.id; c.checked = true;
      l.append(c, document.createTextNode(app.name)); fs.appendChild(l);
    }
  }
  $('openPanel').onclick = () => {
    $('panel').hidden = false; ['apps', 'login', 'otherApps', 'openPanel', 'status'].forEach(id => { $(id).hidden = true; });
    renderPanel(); loadPanel(panelApps); preparePush(); window.scrollTo(0, 0);
  };
  $('closePanel').onclick = () => { $('panel').hidden = true; $('apps').hidden = false; $('status').hidden = false; refresh(); };
  $('search').oninput = () => renderPanel();
  $('addForm').onsubmit = async e => {
    e.preventDefault();
    const nombre = $('addName').value.trim(), email = $('addEmail').value.trim().toLowerCase();
    const ids = [...$('addApps').querySelectorAll('input:checked')].map(c => c.value);
    if (!ids.length) { pstatus('Elige al menos una aplicación.', true); return; }
    pstatus('Autorizando…');
    const fails = [];
    for (const app of panelApps.filter(a => ids.includes(a.id)))
      try { await adminDo(app, 'autorizar', { email, nombre }); } catch (err) { fails.push(app.short + ': ' + err.message); }
    await loadPanel(panelApps);
    if (fails.length) pstatus(fails.join(' · '), true);
    else { pstatus(nombre + ' quedó autorizado. Puede ingresar en Green Apps con su correo.'); $('addForm').reset(); $('addPerson').open = false; }
  };

  // ---------- Notificaciones del administrador (OneSignal, un solo permiso para las cuatro aplicaciones) ----------
  // El permiso se pide en esta página principal y desde una pulsación real (requisito de iPhone/iPad).
  const ONESIGNAL_APP_ID = '0956c8db-37fb-4a11-98bd-397d121ae8fa';
  let oneSignal = null, pushPromise = null;
  const pushStatus = t => { $('pushStatus').textContent = t || ''; };
  function loadPush() {
    if (pushPromise) return pushPromise;
    pushPromise = new Promise((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async sdk => {
        try { await sdk.init({ appId: ONESIGNAL_APP_ID, serviceWorkerParam: { scope: '/apps/' }, serviceWorkerPath: '/apps/OneSignalSDKWorker.js' }); oneSignal = sdk; resolve(sdk); }
        catch (e) { reject(e); }
      });
      const sc = document.createElement('script'); sc.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; sc.defer = true;
      sc.onerror = () => reject(Error('No cargaron las notificaciones. Revisa tu conexión.'));
      document.head.appendChild(sc);
    });
    return pushPromise;
  }
  async function preparePush() {
    const btn = $('pushOn');
    if (ios && !standalone) { pushStatus('En iPhone o iPad, abre Green Apps desde su ícono en la pantalla de inicio para activar notificaciones.'); return; }
    try {
      const sdk = await Promise.race([loadPush(), new Promise((_, rej) => setTimeout(() => rej(Error('Las notificaciones no respondieron. Cierra y vuelve a abrir Green Apps.')), 15000))]);
      if (!sdk.Notifications.isPushSupported()) { pushStatus('Este navegador no admite notificaciones.'); return; }
      const on = sdk.Notifications.permission && sdk.User.PushSubscription.optedIn && sdk.User.PushSubscription.id;
      btn.textContent = on ? 'Volver a registrar este dispositivo' : 'Activar notificaciones';
      btn.disabled = false;
      if (on && !$('pushStatus').textContent) pushStatus('Las notificaciones están activas en este dispositivo.');
    } catch (e) { pushStatus(e.message); }
  }
  async function registerEverywhere(id) {
    const list = $('pushList'); list.textContent = '';
    let ok = 0;
    for (const app of panelApps) {
      let text;
      try {
        const r = await ask(app, { op: 'admin', accion: 'registrarPush', subscriptionId: id });
        if (r.hecho && r.apiConfigurada) { ok++; text = 'activas'; }
        else if (r.hecho) text = 'registrado, pero falta la clave de OneSignal (guárdala más abajo)';
        else text = 'falta la clave de OneSignal (guárdala más abajo)';
      } catch (e) { text = e.message; }
      list.appendChild(el('li', '', app.short + ': ' + text));
    }
    pushStatus(ok === panelApps.length ? 'Listo: recibirás los avisos de las ' + ok + ' aplicaciones.' : 'Avisos activos en ' + ok + ' de ' + panelApps.length + ' aplicaciones.');
  }
  $('pushOn').onclick = () => {
    if (!oneSignal) return;
    $('pushOn').disabled = true; pushStatus('Solicitando permiso al dispositivo…');
    let req;
    try { req = oneSignal.Notifications.requestPermission(); } catch (e) { pushStatus(e.message); $('pushOn').disabled = false; return; }
    Promise.resolve(req).then(async () => {
      if (!oneSignal.Notifications.permission) throw Error('El dispositivo no concedió el permiso. Revisa Ajustes › Notificaciones.');
      await oneSignal.User.PushSubscription.optIn();
      let id = oneSignal.User.PushSubscription.id;
      for (let i = 0; !id && i < 20; i++) { await new Promise(r => setTimeout(r, 500)); id = oneSignal.User.PushSubscription.id; }
      if (!id) throw Error('No se obtuvo el registro del dispositivo. Reintenta.');
      pushStatus('Registrando este dispositivo en las aplicaciones…');
      await registerEverywhere(id);
    }).catch(e => pushStatus(e.message || 'No fue posible activar las notificaciones.')).finally(() => { $('pushOn').disabled = false; });
  };
  $('pushTest').onclick = async () => {
    pushStatus('Enviando prueba…');
    const out = [];
    for (const app of panelApps) {
      try { const r = await ask(app, { op: 'admin', accion: 'probarPush' }); out.push(app.short + ': ' + (r.hecho ? 'enviada' : 'no enviada')); }
      catch (e) { out.push(app.short + ': ' + e.message); }
    }
    const list = $('pushList'); list.textContent = '';
    out.forEach(t => list.appendChild(el('li', '', t)));
    pushStatus('Resultado de la prueba:');
  };

  $('pushKeyForm').onsubmit = async e => {
    e.preventDefault();
    const apiKey = $('pushKey').value.trim();
    const btn = e.submitter || $('pushKeyForm').querySelector('button'); btn.disabled = true;
    pushStatus('Guardando la clave…');
    const list = $('pushList'); list.textContent = '';
    let ok = 0;
    for (const app of panelApps) {
      try { await ask(app, { op: 'admin', accion: 'configurarClavePush', apiKey }); ok++; list.appendChild(el('li', '', app.short + ': clave guardada')); }
      catch (err) { list.appendChild(el('li', '', app.short + ': ' + err.message)); }
    }
    $('pushKey').value = ''; btn.disabled = false;
    pushStatus(ok === panelApps.length ? 'Clave guardada en las ' + ok + ' aplicaciones. Ahora pulsa «Activar notificaciones» y luego «Enviar una prueba».' : 'Clave guardada en ' + ok + ' de ' + panelApps.length + ' aplicaciones.');
  };

  function renderFree() {
    const list = $('freeList');
    list.textContent = '';
    FREE_APPS.forEach(app => list.appendChild(card(app, 'Libre acceso', false)));
    $('freeApps').hidden = !FREE_APPS.length;
  }

  $('refresh').onclick = () => refresh();
  $('forget').onclick = () => { store.set(EMAIL_KEY, ''); $('email').value = ''; showLogin = true; $('login').hidden = false; $('email').focus(); };
  $('email').value = store.get(EMAIL_KEY);
  $('installHint').hidden = !(ios && !standalone);
  try { sessionStorage.removeItem('greenapps.via'); } catch (_) {}
  window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
  renderFree();
  refresh();
})();
