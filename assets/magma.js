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

  // Select accesible personalizado
  function crearSelectAccesible(selectEl) {
    if (selectEl.dataset.enhanced === '1') return;
    selectEl.dataset.enhanced = '1';
    var wrapper = document.createElement('div');
    wrapper.className = 'selectWrap';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'selectBtn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var ariaLabel = selectEl.getAttribute('aria-label') || selectEl.getAttribute('name') || 'Seleccionar';
    btn.setAttribute('aria-label', ariaLabel);
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = selectEl.options[selectEl.selectedIndex] ? selectEl.options[selectEl.selectedIndex].text : '';
    var caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▾';
    btn.appendChild(label);
    btn.appendChild(caret);

    var list = document.createElement('ul');
    list.className = 'selectList';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    var uid = 'sel_' + Math.random().toString(36).slice(2);
    list.id = uid;
    btn.setAttribute('aria-controls', uid);

    Array.prototype.forEach.call(selectEl.options, function (opt, i) {
      var li = document.createElement('li');
      li.className = 'selectOption';
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', i);
      li.textContent = opt.text;
      if (opt.disabled) li.setAttribute('aria-disabled', 'true');
      if (i === selectEl.selectedIndex) li.setAttribute('aria-selected', 'true');
      list.appendChild(li);
    });

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(btn);
    wrapper.appendChild(list);
    selectEl.classList.add('selectNativo');
    wrapper.appendChild(selectEl);

    function abrir() {
      wrapper.classList.add('abierto');
      btn.setAttribute('aria-expanded', 'true');
      list.focus();
      marcarActiva(selectEl.selectedIndex);
    }
    function cerrar() {
      wrapper.classList.remove('abierto');
      btn.setAttribute('aria-expanded', 'false');
    }
    function marcarActiva(idx) {
      var items = list.querySelectorAll('.selectOption');
      items.forEach(function (el, j) {
        el.classList.toggle('activa', j === idx);
      });
    }
    function seleccionar(idx) {
      var opts = selectEl.options;
      if (idx < 0 || idx >= opts.length) return;
      if (opts[idx].disabled) return;
      selectEl.selectedIndex = idx;
      label.textContent = opts[idx].text;
      list.querySelectorAll('.selectOption').forEach(function (el, j) {
        el.setAttribute('aria-selected', j === idx ? 'true' : 'false');
      });
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      cerrar();
      btn.focus();
    }

    btn.addEventListener('click', function () {
      if (wrapper.classList.contains('abierto')) cerrar();
      else abrir();
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.selectOption');
      if (!li) return;
      if (li.getAttribute('aria-disabled') === 'true') return;
      seleccionar(parseInt(li.getAttribute('data-index'), 10));
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.selectOption');
      if (!li) return;
      marcarActiva(parseInt(li.getAttribute('data-index'), 10));
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) cerrar();
    });
    list.addEventListener('keydown', function (e) {
      var idx = selectEl.selectedIndex;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        seleccionar(Math.min(idx + 1, selectEl.options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        seleccionar(Math.max(idx - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        seleccionar(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        seleccionar(selectEl.options.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cerrar();
        btn.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cerrar();
        btn.focus();
      }
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        abrir();
      }
    });

    // Sync if native select changes externally
    selectEl.addEventListener('change', function () {
      var idx = selectEl.selectedIndex;
      label.textContent = selectEl.options[idx] ? selectEl.options[idx].text : '';
      list.querySelectorAll('.selectOption').forEach(function (el, j) {
        el.setAttribute('aria-selected', j === idx ? 'true' : 'false');
      });
    });
  }

  function initSelects(root) {
    var scope = root || document;
    var selects = scope.querySelectorAll('select.selectPersonalizado');
    selects.forEach(crearSelectAccesible);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initSelects();
    });
  } else {
    initSelects();
  }
  document.addEventListener('shopify:section:load', function (e) {
    initSelects(e.target);
  });
  document.addEventListener('shopify:section:select', function (e) {
    initSelects(e.target);
  });
})();
