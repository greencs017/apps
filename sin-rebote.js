/* Sin rebote (Green Apps): la pantalla no se corre ni deja un espacio vacío al deslizar más allá del borde. */
(function () {
  if (typeof window === 'undefined' || window.__sinRebote) return;
  window.__sinRebote = true;
  var root = document.documentElement;
  function css() {
    try {
      root.style.overscrollBehavior = 'none';
      if (document.body) document.body.style.overscrollBehavior = 'none';
    } catch (e) {}
  }
  css();
  document.addEventListener('DOMContentLoaded', css);
  var lastX = 0, lastY = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) { lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
  }, { passive: true });
  function canScroll(el, dy) {
    return dy > 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  function scrollable(el) {
    if (el === document.body) return false;
    var oy = getComputedStyle(el).overflowY;
    return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
  }
  function docScrollable() {
    var se = document.scrollingElement || root;
    if (getComputedStyle(root).overflowY === 'hidden' || (document.body && getComputedStyle(document.body).overflowY === 'hidden')) return false;
    return se.scrollHeight > se.clientHeight + 1;
  }
  document.addEventListener('touchmove', function (e) {
    if (!e.cancelable || e.touches.length !== 1) return;
    var t = e.touches[0], dx = t.clientX - lastX, dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;
    if (dy === 0 || Math.abs(dx) > Math.abs(dy)) return;      // deslizamiento horizontal: se respeta
    var target = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    if (target && target.closest && target.closest('input[type=range],textarea,select,canvas,[data-permitir-rebote]')) return;
    for (var el = target; el && el.nodeType === 1; el = el.parentElement) {
      if (el === root) break;
      if (scrollable(el) && canScroll(el, dy)) return;          // algo puede seguir desplazándose: normal
    }
    if (docScrollable() && canScroll(document.scrollingElement || root, dy)) return;
    e.preventDefault();                                          // en el borde: sin rebote
  }, { passive: false });
})();
