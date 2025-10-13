(function () {
  var umbral = 10;

  function obtenerScrollTop() {
    return (
      window.scrollY ||
      window.pageYOffset ||
      (document.documentElement && document.documentElement.scrollTop) ||
      (document.body && document.body.scrollTop) ||
      0
    );
  }

  function bindMenu(encabezado) {
    // Delegación de eventos: maneja clicks en el botón hamburguesa
    document.addEventListener('click', function (e) {
      var boton = e.target.closest && e.target.closest('#botonHamburguesa');
      if (!boton) return;
      e.stopPropagation();
      var abierto = encabezado.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });

    // Cerrar si se hace click fuera
    document.addEventListener('click', function (e) {
      if (!encabezado.classList.contains('abierto')) return;
      var within = encabezado.contains(e.target);
      if (!within) {
        encabezado.classList.remove('abierto');
        var boton = document.getElementById('botonHamburguesa');
        if (boton) boton.setAttribute('aria-expanded', 'false');
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && encabezado.classList.contains('abierto')) {
        encabezado.classList.remove('abierto');
        var boton = document.getElementById('botonHamburguesa');
        if (boton) boton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function actualizarFondo(encabezado) {
    var top = obtenerScrollTop();
    if (top > umbral) encabezado.classList.add('conFondo');
    else encabezado.classList.remove('conFondo');
  }

  function bindScroll(encabezado) {
    var handler = function () {
      actualizarFondo(encabezado);
    };
    window.addEventListener('scroll', handler, { passive: true });
    document.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    handler();
    setTimeout(handler, 0);
  }

  function init(root) {
    var encabezado =
      root && root.querySelector ? root.querySelector('#encabezado') : document.getElementById('encabezado');
    if (!encabezado || encabezado.dataset.inicializado === '1') return;
    encabezado.dataset.inicializado = '1';
    bindMenu(encabezado);
    bindScroll(encabezado);
  }

  // Intentos de inicialización
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
    setTimeout(function () {
      init();
    }, 0);
  }

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });
  document.addEventListener('shopify:section:select', function (e) {
    init(e.target);
  });
})();
