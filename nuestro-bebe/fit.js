/* Ajusta el marco de Nuestro Bebé al alto real visible.
 * Abierta desde Green Apps (barra de estado translúcida), iOS informa un alto menor en el tamaño de la
 * barra de estado y quedaba una franja vacía abajo. Si el contenido empieza bajo la barra (margen
 * seguro superior > 0) y el alto informado no llega a la pantalla, se suma ese margen.
 * Abierta por su propio ícono (barra normal), el margen superior es 0 y se usa el alto visible tal cual.
 * También le pasa a la app el margen inferior (zona de la barra de inicio), que dentro del marco no se ve. */
(() => {
  'use strict';
  const app = document.getElementById('app'), shell = document.getElementById('shell');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.documentElement.appendChild(probe);
  const inset = () => { const cs = getComputedStyle(probe); return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }; };
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let last = 0;
  function fit() {
    const { top } = inset(), portrait = innerHeight >= innerWidth, sh = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
    let h = Math.round(innerHeight);
    if (standalone() && top > 0 && innerHeight + top <= sh + 1) h = Math.round(innerHeight + top);
    if (h === last) return; last = h;
    app.style.height = h + 'px'; shell.style.height = h + 'px';
  }
  try { const u = new URL(app.dataset.src); u.searchParams.set('sab', String(Math.round(inset().bottom))); app.dataset.src = u.href; } catch (_) {}
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 300));
  addEventListener('pageshow', fit);
})();
