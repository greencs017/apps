/* Ajusta el marco de Mis Calorías al alto VISIBLE de la pantalla.
 * Con la barra de estado normal (status-bar-style "default"), el contenido empieza bajo la hora:
 * usar el alto completo de la pantalla dejaba unos 59 pt del marco fuera de la pantalla, abajo,
 * y las ventanas que suben desde abajo se veían cortadas. innerHeight es justo el área visible
 * (sin teclado) y cambia cuando Safari muestra u oculta sus barras. */
(() => {
  'use strict';
  const app = document.getElementById('app'), shell = document.getElementById('shell');
  let last = 0;
  function fit() {
    const h = Math.round(innerHeight);
    if (h === last) return;
    last = h;
    app.style.height = h + 'px'; shell.style.height = h + 'px';
  }
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 300));
  addEventListener('pageshow', fit);
})();
