/**
 * Sistema de filtrado client-side para productos
 * Usa API nativa de Shopify (/collections/X/products.json)
 * Sin tokens, carga todos los productos y filtra en memoria
 */
(function () {
  'use strict';

  var FiltrosProductos = {
    productos: [],
    productosFiltrados: [],
    ordenActual: 'recientes',
    filtrosActivos: {},
    cargando: false,

    /**
     * Cargar todos los productos de una colección
     */
    cargarTodos: async function (collectionHandle) {
      this.cargando = true;
      var productos = [];
      var page = 1;
      var limite = 250; // Máximo por página

      try {
        while (true) {
          var url = '/collections/' + collectionHandle + '/products.json?page=' + page + '&limit=' + limite;
          var response = await fetch(url);

          if (!response.ok) {
            throw new Error('Error loading products: ' + response.status);
          }

          var data = await response.json();

          if (!data.products || data.products.length === 0) {
            break;
          }

          productos = productos.concat(data.products);

          // Si trajo menos del límite, ya no hay más páginas
          if (data.products.length < limite) {
            break;
          }

          page++;
        }

        this.productos = productos;
        this.productosFiltrados = productos.slice();
        this.cargando = false;
        return productos;
      } catch (error) {
        console.error('Error cargando productos:', error);
        this.cargando = false;
        throw error;
      }
    },

    /**
     * Aplicar filtros y ordenamiento
     */
    aplicarFiltros: function (filtros) {
      this.filtrosActivos = filtros || {};
      var resultado = this.productos.slice();

      // Filtro por disponibilidad
      if (this.filtrosActivos.disponible !== undefined) {
        resultado = resultado.filter(
          function (p) {
            return p.available === this.filtrosActivos.disponible;
          }.bind(this)
        );
      }

      // Filtro por rango de precio
      if (this.filtrosActivos.precioMin !== undefined) {
        resultado = resultado.filter(
          function (p) {
            var precio = this.obtenerPrecioMinimo(p);
            return precio >= this.filtrosActivos.precioMin;
          }.bind(this)
        );
      }

      if (this.filtrosActivos.precioMax !== undefined) {
        resultado = resultado.filter(
          function (p) {
            var precio = this.obtenerPrecioMinimo(p);
            return precio <= this.filtrosActivos.precioMax;
          }.bind(this)
        );
      }

      // Filtros por tags
      if (this.filtrosActivos.tags && this.filtrosActivos.tags.length > 0) {
        resultado = resultado.filter(
          function (p) {
            return this.filtrosActivos.tags.some(function (tag) {
              return p.tags.includes(tag);
            });
          }.bind(this)
        );
      }

      // Filtros custom (para extender con metafields si están disponibles)
      if (this.filtrosActivos.custom) {
        for (var key in this.filtrosActivos.custom) {
          var valor = this.filtrosActivos.custom[key];
          resultado = resultado.filter(function (p) {
            // Buscar en tags con formato "key:value"
            var tagKey = key + ':' + valor;
            return p.tags.some(function (t) {
              return t.toLowerCase() === tagKey.toLowerCase();
            });
          });
        }
      }

      this.productosFiltrados = resultado;
      return this.ordenar(this.ordenActual);
    },

    /**
     * Ordenar productos
     */
    ordenar: function (tipo) {
      this.ordenActual = tipo;
      var ordenados = this.productosFiltrados.slice();

      switch (tipo) {
        case 'precio-asc':
          ordenados.sort(
            function (a, b) {
              return this.obtenerPrecioMinimo(a) - this.obtenerPrecioMinimo(b);
            }.bind(this)
          );
          break;

        case 'precio-desc':
          ordenados.sort(
            function (a, b) {
              return this.obtenerPrecioMinimo(b) - this.obtenerPrecioMinimo(a);
            }.bind(this)
          );
          break;

        case 'titulo-asc':
          ordenados.sort(function (a, b) {
            return a.title.localeCompare(b.title);
          });
          break;

        case 'titulo-desc':
          ordenados.sort(function (a, b) {
            return b.title.localeCompare(a.title);
          });
          break;

        case 'recientes':
        default:
          ordenados.sort(function (a, b) {
            var dateA = new Date(a.published_at || a.created_at);
            var dateB = new Date(b.published_at || b.created_at);
            return dateB - dateA;
          });
          break;
      }

      this.productosFiltrados = ordenados;
      return ordenados;
    },

    /**
     * Obtener precio mínimo del producto
     */
    obtenerPrecioMinimo: function (producto) {
      if (!producto.variants || producto.variants.length === 0) {
        return 0;
      }
      var precios = producto.variants.map(function (v) {
        return parseFloat(v.price);
      });
      return Math.min.apply(Math, precios);
    },

    /**
     * Obtener precio de comparación
     */
    obtenerPrecioComparacion: function (producto) {
      if (!producto.variants || producto.variants.length === 0) {
        return null;
      }
      var variant = producto.variants[0];
      return variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
    },

    /**
     * Renderizar tarjeta de producto
     */
    renderCard: function (producto, mostrarPrecio) {
      var precio = this.obtenerPrecioMinimo(producto);
      var precioCompare = this.obtenerPrecioComparacion(producto);

      var html = '<a href="/products/' + producto.handle + '" class="tarjetaProducto">';

      // Resolver imagen destacada de forma robusta
      var imgSrc = null;
      if (producto.featured_image) {
        imgSrc =
          typeof producto.featured_image === 'string' ? producto.featured_image : producto.featured_image.src || null;
      }
      if (!imgSrc && producto.image && producto.image.src) {
        imgSrc = producto.image.src;
      }
      if (!imgSrc && producto.images && producto.images.length > 0) {
        imgSrc = producto.images[0].src || null;
      }

      if (imgSrc) {
        html +=
          '<img src="' +
          imgSrc +
          '" alt="' +
          this.escapeHtml(producto.title) +
          '" class="tarjetaProductoImagen" loading="lazy">';
      }

      html += '<h3 class="tarjetaProductoTitulo">' + this.escapeHtml(producto.title) + '</h3>';

      if (mostrarPrecio) {
        html += '<div class="tarjetaProductoPrecio">';
        html += '<span class="precio">' + this.formatMoney(precio) + '</span>';
        if (precioCompare && precioCompare > precio) {
          html += '<span class="precioComparar">' + this.formatMoney(precioCompare) + '</span>';
        }
        html += '</div>';
      }

      html += '</a>';
      return html;
    },

    /**
     * Formatear dinero
     */
    formatMoney: function (amount) {
      var val = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(val)) val = 0;
      return '$' + val.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    /**
     * Escapar HTML
     */
    escapeHtml: function (text) {
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return String(text).replace(/[&<>"']/g, function (m) {
        return map[m];
      });
    },

    /**
     * Obtener valores únicos de tags para generar filtros
     */
    obtenerValoresTag: function (tagPrefix) {
      var valores = new Set();
      this.productos.forEach(function (p) {
        p.tags.forEach(function (tag) {
          if (tag.toLowerCase().startsWith(tagPrefix.toLowerCase() + ':')) {
            var valor = tag.split(':')[1];
            if (valor) valores.add(valor.trim());
          }
        });
      });
      return Array.from(valores).sort();
    },

    /**
     * Obtener rango de precios de la colección
     */
    obtenerRangoPrecios: function () {
      if (this.productos.length === 0) return { min: 0, max: 0 };

      var precios = this.productos.map(
        function (p) {
          return this.obtenerPrecioMinimo(p);
        }.bind(this)
      );

      return {
        min: Math.min.apply(Math, precios),
        max: Math.max.apply(Math, precios),
      };
    },
  };

  // Exponer globalmente
  window.FiltrosProductos = FiltrosProductos;
})();
