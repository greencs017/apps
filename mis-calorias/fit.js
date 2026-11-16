/* iPhone con la app instalada: el alto "100%" no incluye la zona de la isla/notch y queda una franja.
 * Se ajusta el marco al alto real de la pantalla (igual que Mis Compras). */
(() => {
  'use strict';
  const app = document.getElementById('app'), shell = document.getElementById('shell');
  function fit() {
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    const portrait = innerHeight >= innerWidth;
    const h = standalone ? Math.max(innerHeight, portrait ? screen.height : screen.width) : innerHeight;
    app.style.height = h + 'px'; shell.style.height = h + 'px';
  }
  fit(); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300));
})();
