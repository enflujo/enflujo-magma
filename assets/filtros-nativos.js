/**
 * Filtros nativos de Shopify con AJAX y scroll infinito
 * Reutilizable para cualquier sección que muestre productos con filtros
 */
(function () {
  window.FiltrosNativos = {
    init: function (config) {
      var root = document.getElementById(config.rootId);
      if (!root) return;

      var filtrosContainer = config.filtrosContainer || root.querySelector('.contenedorFiltros');
      var productosContainer = config.productosContainer;
      var sentinel = config.sentinel;
      var form = root.querySelector('#formFiltros');
      var cargando = false;
      var obs;

      function buildURL(params, page) {
        var url = new URL(config.collectionUrl, window.location.origin);
        if (params) {
          params.forEach(function (value, key) {
            if (value !== '') url.searchParams.append(key, value);
          });
        }
        if (page && Number(page) > 1) url.searchParams.set('page', String(page));
        url.searchParams.set('section_id', config.sectionId);
        return url.toString();
      }

      function parseHTML(html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = html;
        return tpl.content;
      }

      function extract(content) {
        return {
          filtros: content.querySelector('.contenedorFiltros')?.innerHTML || null,
          productos: content.querySelector(config.productosSelector)?.innerHTML || null,
        };
      }

      async function fetchSection(params, page) {
        var url = buildURL(params, page);
        var res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Error ' + res.status);
        var html = await res.text();
        return extract(parseHTML(html));
      }

      function onFormChange(e) {
        if (form) {
          actualizarSeccion(new FormData(form), /*replace*/ true);
          e && e.preventDefault();
        }
      }

      function updateHistory(params) {
        var url = new URL(window.location.href);
        url.search = '';
        params.forEach(function (value, key) {
          if (value !== '') url.searchParams.append(key, value);
        });
        history.replaceState({}, '', url.toString());
      }

      async function actualizarSeccion(formData, replace, page) {
        if (cargando) return;
        cargando = true;
        try {
          var data = await fetchSection(formData, page);
          if (data.filtros && filtrosContainer) {
            filtrosContainer.innerHTML = data.filtros;
            form = root.querySelector('#formFiltros');
            bindFilterEvents();
          }
          if (data.productos) {
            if (replace) {
              // Fade out antes de reemplazar
              productosContainer.style.opacity = '0';
              productosContainer.style.transform = 'translateY(6px)';
              setTimeout(function () {
                productosContainer.innerHTML = data.productos;
                addEnteringClass();
                // Fade in
                requestAnimationFrame(function () {
                  requestAnimationFrame(function () {
                    productosContainer.style.opacity = '1';
                    productosContainer.style.transform = '';
                  });
                });
              }, 200);
            } else {
              var wrapper = document.createElement('div');
              wrapper.innerHTML = data.productos;
              var tarjetas = wrapper.querySelectorAll('.tarjetaProducto');
              tarjetas.forEach(function (t) {
                t.classList.add('entrando');
              });
              productosContainer.insertAdjacentHTML('beforeend', wrapper.innerHTML);
            }
            prepareObserver();
          }
          if (formData) updateHistory(formData);
        } catch (err) {
          // Error crítico: fallo al cargar productos
          if (window.console && console.error) {
            console.error('Error al actualizar productos:', err);
          }
        } finally {
          cargando = false;
        }
      }

      function addEnteringClass() {
        var tarjetas = productosContainer.querySelectorAll('.tarjetaProducto');
        tarjetas.forEach(function (t) {
          t.classList.add('entrando');
        });
      }

      function bindFilterEvents() {
        if (!form) return;
        var inputs = form.querySelectorAll('input, select');
        inputs.forEach(function (el) {
          el.addEventListener('change', onFormChange);
        });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          onFormChange(e);
        });

        // Configurar menú de ordenamiento custom
        configurarMenuOrdenar();
      }

      function configurarMenuOrdenar() {
        var btnOrdenar = root.querySelector('button[id*="btn-ordenar"]');
        var menuOrdenar = root.querySelector('div[id*="menu-ordenar"]');
        var selectOrden = root.querySelector('select[name="sort_by"]');

        if (!btnOrdenar || !menuOrdenar || !selectOrden) return;

        // Evitar duplicar event listeners
        if (btnOrdenar.dataset.configured) return;
        btnOrdenar.dataset.configured = 'true';

        // Toggle menu al hacer clic en el botón
        btnOrdenar.addEventListener('click', function (e) {
          e.stopPropagation();
          var isOpen = menuOrdenar.classList.contains('abierto');
          if (isOpen) {
            menuOrdenar.classList.remove('abierto');
            btnOrdenar.setAttribute('aria-expanded', 'false');
          } else {
            menuOrdenar.classList.add('abierto');
            btnOrdenar.setAttribute('aria-expanded', 'true');
          }
        });

        // Manejar clic en opciones
        menuOrdenar.querySelectorAll('.opcionOrden').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var valor = this.getAttribute('data-value');
            selectOrden.value = valor;

            // Actualizar estado visual
            menuOrdenar.querySelectorAll('.opcionOrden').forEach(function (b) {
              b.removeAttribute('data-selected');
            });
            this.setAttribute('data-selected', 'true');

            // Cerrar menú
            menuOrdenar.classList.remove('abierto');
            btnOrdenar.setAttribute('aria-expanded', 'false');

            // Aplicar ordenamiento
            var formData = new FormData(form);
            formData.set('sort_by', valor);
            actualizarSeccion(formData, /*replace*/ true);
          });
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', function (e) {
          if (!btnOrdenar.contains(e.target) && !menuOrdenar.contains(e.target)) {
            menuOrdenar.classList.remove('abierto');
            btnOrdenar.setAttribute('aria-expanded', 'false');
          }
        });
      }

      function nextPageURL() {
        var el = productosContainer.querySelector('#pagination-data');
        var next = el ? el.getAttribute('data-next') : '';
        return next || '';
      }

      function prepareObserver() {
        if (!('IntersectionObserver' in window) || !sentinel) return;
        if (obs) {
          try {
            obs.unobserve(sentinel);
          } catch (e) {}
        }
        var next = nextPageURL();
        if (!next) return;
        obs = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting || cargando) return;
              var params = new URLSearchParams(window.location.search);
              var page = new URL(next, window.location.origin).searchParams.get('page');
              actualizarSeccion(params, /*replace*/ false, page);
            });
          },
          { rootMargin: '300px 0px', threshold: 0 }
        );
        obs.observe(sentinel);
      }

      // Inicializar
      if (config.fetchOnInit) {
        // Cargar vía AJAX (para cuadricula-productos)
        actualizarSeccion(null, true).then(function () {
          bindFilterEvents();
          prepareObserver();
        });
      } else {
        // Ya está renderizado (para collection)
        bindFilterEvents();
        prepareObserver();
      }
    },
  };
})();
