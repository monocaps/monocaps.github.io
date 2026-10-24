/* =========================================================
   MONO CAPS — base común de las dos páginas
   (inicio: index.html · colección: coleccion.html)
   Datos, utilidades, detalle de cada gorra, visor con zoom y menú.
   Todos los datos salen de data/productos.json.
   ========================================================= */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ESTADOS = {
    'disponible': 'Disponible',
    'ultimas': 'Últimas unidades',
    'agotada': 'Agotada',
    'por-llegar': 'Por llegar',
    'encargo': 'Vendida · por encargo'
  };
  var SELLO = '<span class="sello" aria-hidden="true"><span class="sello__txt"><b>Vendida</b><i>por encargo</i></span></span>';

  var MC = window.MC = { $: $, $$: $$, reducido: reducido, ESTADOS: ESTADOS, SELLO: SELLO, tienda: null, gorras: [] };

  /* ---------- utilidades ---------- */
  MC.esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var formato = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  MC.precio = function (g) { return typeof g.precio === 'number' ? formato.format(g.precio) : 'Precio por confirmar'; };
  MC.num = function (g) { return '#' + String(MC.gorras.indexOf(g) + 1).padStart(2, '0'); };
  MC.foto = function (archivo, peque) { return 'img/productos/' + (peque ? 'sm/' : '') + archivo + '.webp'; };
  MC.fotoReal = function (archivo, peque) { return 'img/mirador/' + archivo + (peque ? '-sm' : '') + '.webp'; };
  MC.wa = function (texto) { return 'https://wa.me/' + MC.tienda.whatsapp + '?text=' + encodeURIComponent(texto); };
  MC.etiquetas = function (g) {
    var h = '<span class="etiqueta etiqueta--' + g.estado + '">' + ESTADOS[g.estado] + '</span>';
    if (g.nueva) h += '<span class="etiqueta etiqueta--nueva">Nueva</span>';
    return '<span class="etiquetas">' + h + '</span>';
  };
  // qué se hace con cada gorra según su estado: pedir, apartar (viene en camino) o encargar (ya se vendió)
  MC.accion = function (g) {
    if (g.estado === 'agotada') return null;
    var t = MC.tienda;
    var tipo = g.estado === 'por-llegar' ? 'Apartar' : g.estado === 'encargo' ? 'Encargar' : 'Pedir';
    var plantilla = tipo === 'Apartar' ? t.mensajeApartar : tipo === 'Encargar' ? (t.mensajeEncargo || t.mensajePedir) : t.mensajePedir;
    return {
      texto: tipo + ' por WhatsApp',
      href: MC.wa(plantilla.replace('{nombre}', g.nombre).replace('{talla}', g.tallas.join(' o ')))
    };
  };
  MC.avisar = function (texto) {
    var a = $('.aviso-flotante');
    if (!a) return;
    a.textContent = texto;
    a.hidden = false;
    clearTimeout(MC.avisar.t);
    MC.avisar.t = setTimeout(function () { a.hidden = true; }, 2200);
  };
  // parte un texto en letras (sin cortar palabras) para animarlas una por una
  MC.letras = function (texto) {
    var n = 0;
    return texto.split(' ').map(function (palabra) {
      return '<span class="palabra">' + palabra.split('').map(function (c) {
        return '<span class="letra" style="--i:' + (n++) + '">' + MC.esc(c) + '</span>';
      }).join('') + '</span>';
    }).join(' ');
  };

  /* ---------- carga de datos ---------- */
  MC.cargar = function () {
    return fetch('data/productos.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (datos) {
        MC.tienda = datos.tienda;
        MC.gorras = datos.gorras;
        montarTienda();
        if ($('.detalle')) { montarDetalle(); ruta(); }
        return datos;
      });
  };

  /* ---------- datos de la tienda en la página ---------- */
  function montarTienda() {
    var t = MC.tienda;
    $$('[data-wa-general]').forEach(function (a) {
      a.href = MC.wa(t.mensajeGeneral);
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-wa-numero]').forEach(function (s) { s.textContent = t.whatsappVisible; });
    var icono = $('[data-icono-wa-fuente]');
    $$('[data-icono-wa]').forEach(function (s) { if (icono) s.innerHTML = icono.innerHTML; });

    var redes = [];
    if (t.instagram) redes.push('<a class="enlace" href="https://instagram.com/' + MC.esc(t.instagram) + '" target="_blank" rel="noopener">Instagram</a>');
    if (t.tiktok) redes.push('<a class="enlace" href="https://www.tiktok.com/@' + MC.esc(t.tiktok) + '" target="_blank" rel="noopener">TikTok</a>');
    $$('[data-redes]').forEach(function (s) { s.innerHTML = redes.join(' &nbsp; '); });
    $$('[data-redes-texto]').forEach(function (s) {
      var n = [t.instagram && 'Instagram', t.tiktok && 'TikTok'].filter(Boolean);
      s.textContent = n.length ? ', ' + n.join(' y ') : '';
    });
    var poner = function (sel, txt) { var el = $(sel); if (el) el.textContent = txt; };
    poner('[data-entrega]', t.entregaGratis.join(' y '));
    poner('[data-envios]', t.envios);
    poner('[data-promo]', t.promo);
    poner('[data-pagos]', t.pagos.join(' · '));
    poner('[data-anio]', new Date().getFullYear());
  }

  /* ---------- detalle de una gorra ---------- */
  var det = {};
  function montarDetalle() {
    det.el = $('.detalle');
    det.burbuja = window.Burbujas.registrar($('[data-burbuja="detalle"]'), {
      frente: $('[data-burbuja-frente="detalle"]'), semilla: 5.2, prioridad: true, sensible: 0
    });
    $('[data-cerrar]', det.el).addEventListener('click', cerrarConHistoria);
    $('[data-compartir]', det.el).addEventListener('click', compartir);
    $$('[data-tab]', det.el).forEach(function (t) {
      t.addEventListener('click', function () { pestana(t.dataset.tab); });
    });
    var carril = $('[data-d-carril]');
    var izqAnterior = 0;
    carril.addEventListener('scroll', function () {
      // la gorra pasa por encima de la burbuja y el líquido se estira con el deslizamiento
      var d = carril.scrollLeft - izqAnterior;
      izqAnterior = carril.scrollLeft;
      if (Math.abs(d) > 0.5) det.burbuja.empujar(-d / 28, 0);
      var i = Math.round(carril.scrollLeft / carril.clientWidth);
      if (i !== det.lamina) { det.lamina = i; det.burbuja.pulso(0.7); indiceProducto(); }
    }, { passive: true });
    var reales = $('[data-d-reales]');
    reales.addEventListener('scroll', function () {
      var lam = reales.firstElementChild;
      if (!lam) return;
      var i = Math.round(reales.scrollLeft / (lam.offsetWidth + 10));
      $('[data-d-indice-real]').textContent = (i + 1) + ' / ' + det.g.fotosReales.length + ' · ' + det.g.fotosReales[Math.min(i, det.g.fotosReales.length - 1)].vista;
    }, { passive: true });
  }
  function indiceProducto() {
    var f = det.g.fotos;
    $('[data-d-indice]').textContent = f.length > 1 ? (det.lamina + 1) + ' / ' + f.length + ' · ' + f[det.lamina].vista : f[0].vista;
  }
  function pestana(cual) {
    $$('[data-tab]', det.el).forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === cual)); });
    $$('[data-panel]', det.el).forEach(function (p) { p.hidden = p.dataset.panel !== cual; });
    if (cual === 'producto') det.burbuja.pulso(1);
  }

  var origen = null;
  MC.fijarOrigen = function (el) {
    var r = el.getBoundingClientRect();
    origen = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  var navegoDentro = false, ultimoFoco = null;
  function abrirDetalle(id) {
    var g = MC.gorras.find(function (x) { return x.id === id; });
    if (!g) { cerrarDetalle(); return; }
    det.g = g;
    det.lamina = 0;
    var el = det.el;

    $('[data-d-num]').textContent = MC.num(g);
    $('[data-d-marca]').textContent = g.marca;
    $('[data-d-nombre]').textContent = g.nombre;
    $('[data-d-precio]').textContent = MC.precio(g);
    $('[data-d-talla]').textContent = g.tallas.join(', ');
    $('[data-d-ajuste]').textContent = g.ajuste || 'Por confirmar';
    $('[data-d-estado]').innerHTML = MC.etiquetas(g);
    $('[data-d-nota]').textContent = g.nota || '';
    $('[data-d-nota]').hidden = !g.nota;

    $('[data-d-carril]').innerHTML = g.fotos.map(function (f) {
      var recorte = f.recorte !== false;
      return '<div class="carril__lamina' + (recorte ? '' : ' carril__lamina--foto') + '">' +
        '<button data-zoom="' + MC.foto(f.archivo) + '" aria-label="Ampliar foto: ' + MC.esc(g.nombre) + ', ' + MC.esc(f.vista) + '">' +
        '<img src="' + MC.foto(f.archivo) + '" alt="' + MC.esc(g.nombre) + ', ' + MC.esc(f.vista) + '" decoding="async" width="720" height="720"></button></div>';
    }).join('');
    $('[data-d-carril]').scrollLeft = 0;
    indiceProducto();

    var reales = g.fotosReales || [];
    $('[data-d-pestanas]').hidden = !reales.length;
    $('[data-d-reales]').innerHTML = reales.map(function (f) {
      return '<div class="carril__lamina"><button data-zoom="' + MC.fotoReal(f.archivo) + '" aria-label="Ampliar foto real: ' + MC.esc(f.vista) + '">' +
        '<img src="' + MC.fotoReal(f.archivo) + '" srcset="' + MC.fotoReal(f.archivo, true) + ' 640w, ' + MC.fotoReal(f.archivo) + ' 1200w" sizes="(min-width: 700px) 40vw, 86vw" ' +
        'alt="Foto real de la ' + MC.esc(g.nombre) + ' en el mirador, ' + MC.esc(f.vista.toLowerCase()) + '" loading="lazy" decoding="async" width="1200" height="1600"></button></div>';
    }).join('');
    $('[data-d-reales]').scrollLeft = 0;
    if (reales.length) $('[data-d-indice-real]').textContent = '1 / ' + reales.length + ' · ' + reales[0].vista;
    pestana('producto');

    var t = MC.tienda;
    var avisos = ['Entrega gratis en ' + t.entregaGratis.join(' y '), t.envios, t.promo];
    if (g.estado === 'encargo') avisos.unshift('Esta ya se vendió. Escríbeme y te confirmo si te la puedo conseguir, cuánto tarda y el precio.');
    $('[data-d-sello]').hidden = g.estado !== 'encargo';
    $('[data-d-avisos]').innerHTML = avisos.map(function (x) { return '<li>' + MC.esc(x) + '</li>'; }).join('');

    var boton = $('[data-d-wa]'), acc = MC.accion(g);
    if (!acc) {
      boton.removeAttribute('href');
      boton.setAttribute('aria-disabled', 'true');
      $('[data-d-wa-texto]').textContent = 'Agotada';
    } else {
      boton.removeAttribute('aria-disabled');
      boton.href = acc.href;
      $('[data-d-wa-texto]').textContent = acc.texto;
    }

    document.title = g.nombre + ' — Mono Caps';
    if (el.hidden) {
      ultimoFoco = document.activeElement;
      var o = origen || { x: innerWidth / 2, y: innerHeight / 2 };
      el.style.setProperty('--ox', o.x + 'px');
      el.style.setProperty('--oy', o.y + 'px');
      origen = null;
      el.hidden = false;
      document.body.classList.add('detalle-abierto');
      $('.detalle__scroll').scrollTop = 0;
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('abierto'); }); });
      setTimeout(function () { el.focus({ preventScroll: true }); det.burbuja.pulso(1); }, 300);
    }
    if (MC.alAbrirGorra) MC.alAbrirGorra(g);
  }
  function cerrarDetalle() {
    var el = det.el;
    if (!el || el.hidden) return;
    document.title = MC.tituloPagina || document.title;
    el.classList.remove('abierto');
    document.body.classList.remove('detalle-abierto');
    setTimeout(function () {
      if (!el.classList.contains('abierto')) el.hidden = true;
    }, reducido ? 0 : 760);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }
  function cerrarConHistoria() {
    if (navegoDentro) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      cerrarDetalle();
    }
  }
  function ruta() {
    var m = location.hash.match(/^#\/gorra\/([\w-]+)/);
    if (m) abrirDetalle(m[1]);
    else cerrarDetalle();
  }
  MC.abrirGorra = function (id) { location.hash = '#/gorra/' + id; };
  window.addEventListener('hashchange', function (e) {
    if (!det.el) return;
    var antes = (e.oldURL || '').indexOf('#/gorra/') >= 0;
    var ahora = location.hash.indexOf('#/gorra/') === 0;
    if (ahora && !antes) navegoDentro = true;
    if (!ahora) navegoDentro = false;
    ruta();
  });

  function compartir() {
    var g = det.g;
    var url = location.origin + location.pathname + '#/gorra/' + g.id;
    var datos = { title: g.nombre + ' — Mono Caps', text: g.nombre + ' en Mono Caps', url: url };
    if (navigator.share) { navigator.share(datos).catch(function () {}); return; }
    copiar(url);
  }
  function copiar(texto) {
    function viejo() {
      var t = document.createElement('textarea');
      t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); MC.avisar('Link copiado'); } catch (e) { MC.avisar(texto); }
      t.remove();
    }
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function () { MC.avisar('Link copiado'); }, viejo);
    else viejo();
  }

  /* ---------- visor con zoom (pellizcar, doble toque, arrastrar) ---------- */
  var visor = { s: 1, x: 0, y: 0, punteros: new Map() };
  function abrirVisor(src, alt) {
    var v = $('.visor'), img = $('.visor__img');
    img.src = src; img.alt = alt || '';
    visor.s = 1; visor.x = 0; visor.y = 0; aplicarVisor();
    v.hidden = false;
    $('.visor__cerrar').focus({ preventScroll: true });
  }
  function cerrarVisor() { $('.visor').hidden = true; }
  function aplicarVisor() {
    $('.visor__img').style.transform = 'translate(' + visor.x + 'px,' + visor.y + 'px) scale(' + visor.s + ')';
  }
  if ($('.visor')) (function () {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-zoom]');
      if (b) abrirVisor(b.dataset.zoom, $('img', b).alt);
    });
    var v = $('.visor'), ultimoToque = 0, inicio = null, arrastreY = 0;
    $('.visor__cerrar').addEventListener('click', cerrarVisor);
    v.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.visor__cerrar')) return;
      v.setPointerCapture(e.pointerId);
      visor.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (visor.punteros.size === 1) {
        var ahora = Date.now();
        if (ahora - ultimoToque < 300) {
          if (visor.s > 1) { visor.s = 1; visor.x = 0; visor.y = 0; }
          else {
            visor.s = 2.6;
            visor.x = (innerWidth / 2 - e.clientX) * 1.6;
            visor.y = (innerHeight / 2 - e.clientY) * 1.6;
          }
          $('.visor__img').style.transition = 'transform .3s';
          aplicarVisor();
          setTimeout(function () { $('.visor__img').style.transition = ''; }, 320);
        }
        ultimoToque = ahora;
        arrastreY = 0;
      }
      inicio = { s: visor.s, x: visor.x, y: visor.y, d: distancia(), c: centro() };
    });
    v.addEventListener('pointermove', function (e) {
      if (!visor.punteros.has(e.pointerId)) return;
      var antes = visor.punteros.get(e.pointerId);
      visor.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (visor.punteros.size === 2 && inicio.d) {
        var c = centro();
        visor.s = Math.min(5, Math.max(1, inicio.s * distancia() / inicio.d));
        visor.x = inicio.x + (c.x - inicio.c.x);
        visor.y = inicio.y + (c.y - inicio.c.y);
      } else if (visor.punteros.size === 1) {
        if (visor.s > 1) { visor.x += e.clientX - antes.x; visor.y += e.clientY - antes.y; }
        else { arrastreY += e.clientY - antes.y; visor.y = arrastreY; }
      }
      aplicarVisor();
    });
    function soltar(e) {
      visor.punteros.delete(e.pointerId);
      if (visor.punteros.size === 0 && visor.s <= 1) {
        if (Math.abs(arrastreY) > 110) { cerrarVisor(); return; }
        visor.s = 1; visor.x = 0; visor.y = 0; aplicarVisor();
      }
      inicio = { s: visor.s, x: visor.x, y: visor.y, d: distancia(), c: centro() };
    }
    v.addEventListener('pointerup', soltar);
    v.addEventListener('pointercancel', soltar);
    function distancia() {
      var p = Array.from(visor.punteros.values());
      return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    function centro() {
      var p = Array.from(visor.punteros.values());
      if (!p.length) return { x: 0, y: 0 };
      return p.length < 2 ? p[0] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    }
  })();

  /* ---------- menú ---------- */
  MC.alternarMenu = function (abrir) {
    var m = $('#menu'), b = $('.hamburguesa');
    if (!m) return;
    m.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
    b.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-abierto', abrir);
    document.body.classList.toggle('bloqueado', abrir);
  };
  if ($('.hamburguesa')) $('.hamburguesa').addEventListener('click', function () { MC.alternarMenu($('#menu').hidden); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('.visor') && !$('.visor').hidden) cerrarVisor();
    else if (det.el && !det.el.hidden) cerrarConHistoria();
    else if ($('#menu') && !$('#menu').hidden) MC.alternarMenu(false);
    else if (MC.alEscape) MC.alEscape();
  });
})();
