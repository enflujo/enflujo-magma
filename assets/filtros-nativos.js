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
          // Guardar valores actuales de los inputs de precio antes de actualizar
          var valoresPrecio = {};
          var inputsPrecioActuales = form ? form.querySelectorAll('.inputPrecio') : [];
          inputsPrecioActuales.forEach(function (input) {
            var param = input.getAttribute('data-param');
            if (param) {
              valoresPrecio[param] = input.value;
            }
          });

          var data = await fetchSection(formData, page);
          if (data.filtros && filtrosContainer) {
            filtrosContainer.innerHTML = data.filtros;
            form = root.querySelector('#formFiltros');

            // Restaurar valores de precio en los nuevos inputs
            var inputsPrecioNuevos = form.querySelectorAll('.inputPrecio');
            inputsPrecioNuevos.forEach(function (input) {
              var param = input.getAttribute('data-param');
              if (param && valoresPrecio[param]) {
                input.value = valoresPrecio[param];
              }
            });

            bindFilterEvents();
            bindRemoveFilterLinks();
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
              // Crear un wrapper temporal para parsear el HTML
              var wrapper = document.createElement('div');
              wrapper.innerHTML = data.productos;

              // Extraer solo las tarjetas de producto
              var tarjetas = wrapper.querySelectorAll('.tarjetaProducto');

              // Actualizar el pagination-data antes de insertar las tarjetas
              var nuevoPaginationData = wrapper.querySelector('#pagination-data');
              var paginationDataActual = productosContainer.querySelector('#pagination-data');
              if (nuevoPaginationData && paginationDataActual) {
                paginationDataActual.setAttribute('data-next', nuevoPaginationData.getAttribute('data-next') || '');
              }

              // Insertar solo las tarjetas
              tarjetas.forEach(function (t) {
                t.classList.add('entrando');
                productosContainer.insertAdjacentElement('beforeend', t);
              });
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

      function bindRemoveFilterLinks() {
        var filterLinks = root.querySelectorAll('.filtrosActivos a');
        filterLinks.forEach(function (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            var url = new URL(this.href);
            // Convertir la URL a FormData
            var formData = new FormData();
            url.searchParams.forEach(function (value, key) {
              formData.append(key, value);
            });
            actualizarSeccion(formData, /*replace*/ true);
          });
        });
      }

      function aplicarFiltrosPrecio() {
        var inputsPrecio = form.querySelectorAll('.inputPrecio');

        inputsPrecio.forEach(function (input) {
          var paramName = input.getAttribute('data-param');
          var hiddenInput = form.querySelector('input[name="' + paramName + '"].inputPrecioHidden');

          if (hiddenInput) {
            if (input.value && input.value.trim() !== '') {
              var valorDecimal = parseFloat(input.value.replace(',', '.'));
              if (!isNaN(valorDecimal)) {
                hiddenInput.value = Math.round(valorDecimal);
              } else {
                hiddenInput.value = '';
              }
            } else {
              hiddenInput.value = '';
            }
          }
        });

        onFormChange();
      }

      function bindFilterEvents() {
        if (!form) return;
        var inputs = form.querySelectorAll('input, select');
        inputs.forEach(function (el) {
          if (!el.classList.contains('inputPrecio')) {
            el.addEventListener('change', onFormChange);
          } else {
            // Para inputs de precio: aplicar al presionar Enter o al perder foco
            el.addEventListener('keypress', function (e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                aplicarFiltrosPrecio();
              }
            });
            el.addEventListener('blur', function () {
              aplicarFiltrosPrecio();
            });
          }
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          aplicarFiltrosPrecio();
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

        // Desconectar observer anterior si existe
        if (obs) {
          try {
            obs.disconnect();
          } catch (e) {}
          obs = null;
        }

        // Verificar si hay siguiente página
        var next = nextPageURL();
        if (!next) {
          console.log('No hay más páginas para cargar');
          return;
        }

        obs = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting || cargando) return;

              // Verificar de nuevo que hay siguiente página en el momento de la intersección
              var nextURL = nextPageURL();
              if (!nextURL) {
                obs.disconnect();
                return;
              }

              var params = new URLSearchParams(window.location.search);
              var page = new URL(nextURL, window.location.origin).searchParams.get('page');
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
          bindRemoveFilterLinks();
          prepareObserver();
        });
      } else {
        // Ya está renderizado (para collection)
        bindFilterEvents();
        bindRemoveFilterLinks();
        prepareObserver();
      }
    },
  };
})();
