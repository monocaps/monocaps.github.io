/* =========================================================
   MONO CAPS — lógica del catálogo
   Todos los datos salen de data/productos.json.
   ========================================================= */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ESTADOS = {
    'disponible': 'Disponible',
    'ultimas': 'Últimas unidades',
    'agotada': 'Agotada',
    'por-llegar': 'Por llegar'
  };

  var tienda, gorras = [];
  var filtros = { marca: 'todas', estado: 'todos', talla: 'todas', orden: 'normal' };

  /* ---------- utilidades ---------- */
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var formato = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  function precio(g) { return typeof g.precio === 'number' ? formato.format(g.precio) : 'Precio por confirmar'; }
  function num(g) { return '#' + String(gorras.indexOf(g) + 1).padStart(2, '0'); }
  function foto(archivo, peque) { return 'img/productos/' + (peque ? 'sm/' : '') + archivo + '.webp'; }
  function fotoReal(archivo, peque) { return 'img/mirador/' + archivo + (peque ? '-sm' : '') + '.webp'; }
  function wa(texto) { return 'https://wa.me/' + tienda.whatsapp + '?text=' + encodeURIComponent(texto); }
  function rellenar(plantilla, g) {
    return plantilla.replace('{nombre}', g.nombre).replace('{talla}', g.tallas.join(' o '));
  }
  function sePuedePedir(g) { return g.estado !== 'agotada'; }
  function etiquetas(g) {
    var h = '<span class="etiqueta etiqueta--' + g.estado + '">' + ESTADOS[g.estado] + '</span>';
    if (g.nueva) h += '<span class="etiqueta etiqueta--nueva">Nueva</span>';
    return '<span class="etiquetas">' + h + '</span>';
  }
  function avisar(texto) {
    var a = $('.aviso-flotante');
    a.textContent = texto;
    a.hidden = false;
    clearTimeout(avisar.t);
    avisar.t = setTimeout(function () { a.hidden = true; }, 2200);
  }

  /* ---------- portada: animar solo cuando la foto y el recorte estén listos ---------- */
  (function () {
    var p = $('.portada');
    var listo = function () { p.classList.add('lista'); };
    Promise.all($$('.portada__foto, .portada__gorra').map(function (img) {
      return img.complete ? Promise.resolve() : new Promise(function (r) { img.onload = img.onerror = r; });
    })).then(listo);
    setTimeout(listo, 6000);
  })();

  /* ---------- carga ---------- */
  fetch('data/productos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (datos) {
      tienda = datos.tienda;
      gorras = datos.gorras;
      montarTienda();
      montarVitrina();
      montarFiltros();
      pintarRejilla();
      montarDetalle();
      ruta();
    })
    .catch(function (err) {
      console.error(err);
      $('[data-rejilla]').innerHTML = '<li class="rejilla__vacia">No se pudo cargar el catálogo. Recarga la página.</li>';
    });

  /* ---------- datos de la tienda ---------- */
  function montarTienda() {
    $$('[data-wa-general]').forEach(function (a) {
      a.href = wa(tienda.mensajeGeneral);
      a.target = '_blank';
      a.rel = 'noopener';
    });
    $$('[data-wa-numero]').forEach(function (s) { s.textContent = tienda.whatsappVisible; });
    $$('[data-icono-wa]').forEach(function (s) { s.innerHTML = $('.pildora--flotante svg').innerHTML; });

    var redes = [];
    if (tienda.instagram) redes.push('<a class="enlace" href="https://instagram.com/' + esc(tienda.instagram) + '" target="_blank" rel="noopener">Instagram</a>');
    if (tienda.tiktok) redes.push('<a class="enlace" href="https://www.tiktok.com/@' + esc(tienda.tiktok) + '" target="_blank" rel="noopener">TikTok</a>');
    $$('[data-redes]').forEach(function (s) { s.innerHTML = redes.join(' &nbsp; '); });
    $$('[data-redes-texto]').forEach(function (s) {
      var n = [tienda.instagram && 'Instagram', tienda.tiktok && 'TikTok'].filter(Boolean);
      s.textContent = n.length ? ', ' + n.join(' y ') : '';
    });

    var entrega = 'Entrega gratis en ' + tienda.entregaGratis.map(function (c) { return c.replace(/ \(.*\)/, ''); }).join(' y ');
    var avisos = [entrega, tienda.envios, tienda.promo, 'Pide por WhatsApp'];
    var fila = avisos.map(function (t) { return '<span>' + esc(t) + '<i>✦</i></span>'; }).join('');
    $('[data-cinta]').innerHTML = fila + fila.replace(/<span>/g, '<span aria-hidden="true">');

    $('[data-entrega]').textContent = tienda.entregaGratis.join(' y ');
    $('[data-envios]').textContent = tienda.envios;
    $('[data-promo]').textContent = tienda.promo;
    $('[data-pagos]').textContent = tienda.pagos.join(' · ');
    $('[data-anio]').textContent = new Date().getFullYear();
  }

  /* ---------- vitrina: la burbuja grande ---------- */
  var vitrina = { i: 0, timer: null, pausa: 0 };
  function montarVitrina() {
    var lista = gorras.filter(sePuedePedir);
    if (!lista.length) { $('.vitrina').hidden = true; return; }
    vitrina.lista = lista;
    vitrina.burbuja = window.Burbujas.registrar($('[data-burbuja="vitrina"]'), { semilla: 2.4, prioridad: true });
    $('[data-v-total]').textContent = String(lista.length).padStart(2, '0');
    mostrarVitrina(0, true);

    $('[data-v-prev]').addEventListener('click', function () { tocarVitrina(-1); });
    $('[data-v-next]').addEventListener('click', function () { tocarVitrina(1); });

    var escena = $('[data-v-escena]'), x0 = null, y0 = 0;
    escena.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      x0 = e.clientX; y0 = e.clientY;
    });
    escena.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) tocarVitrina(dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        fijarOrigen(escena);
        location.hash = '#/gorra/' + vitrina.lista[vitrina.i].id;
      }
    });
    escena.addEventListener('pointercancel', function () { x0 = null; });

    var io = new IntersectionObserver(function (ents) {
      vitrina.visible = ents[0].isIntersecting;
      programarVitrina();
    }, { threshold: .35 });
    io.observe(escena);
  }
  function tocarVitrina(dir) {
    vitrina.pausa = Date.now() + 12000;
    mostrarVitrina(vitrina.i + dir);
    programarVitrina();
  }
  function programarVitrina() {
    clearTimeout(vitrina.timer);
    if (!vitrina.visible || reducido) return;
    var espera = Math.max(4800, vitrina.pausa - Date.now());
    vitrina.timer = setTimeout(function () {
      if (document.hidden || $('.detalle').classList.contains('abierto')) { programarVitrina(); return; }
      mostrarVitrina(vitrina.i + 1);
      programarVitrina();
    }, espera);
  }
  function mostrarVitrina(i, inicial) {
    var n = vitrina.lista.length;
    vitrina.i = (i + n) % n;
    var g = vitrina.lista[vitrina.i];
    var img = $('[data-v-img]');
    var nombre = $('.vitrina__nombre');
    var src = foto(g.fotos[0].archivo);

    function aplicarTexto() {
      $('[data-v-actual]').textContent = String(vitrina.i + 1).padStart(2, '0');
      $('[data-v-marca]').textContent = g.marca;
      $('[data-v-nombre]').textContent = g.nombre;
      $('[data-v-estado]').innerHTML = etiquetas(g) + ' <span class="nota">&nbsp;' + esc(precio(g)) + '</span>';
      var ver = $('[data-v-ver]');
      ver.href = '#/gorra/' + g.id;
      ver.onclick = function () { fijarOrigen($('[data-v-escena]')); };
      img.alt = g.nombre;
    }

    if (inicial) { img.src = src; aplicarTexto(); return; }

    img.classList.add('sale');
    nombre.classList.add('cambia');
    vitrina.burbuja.pulso(1);
    var cargada = new Image();
    cargada.src = src;
    setTimeout(function () {
      (cargada.decode ? cargada.decode() : Promise.resolve()).catch(function () {}).then(function () {
        img.src = src;
        aplicarTexto();
        img.classList.remove('sale');
        img.classList.add('entra');
        void img.offsetWidth;
        img.classList.remove('entra');
        void nombre.offsetWidth;
        nombre.classList.remove('cambia');
      });
    }, 420);
    // precarga la siguiente
    new Image().src = foto(vitrina.lista[(vitrina.i + 1) % n].fotos[0].archivo);
  }

  /* ---------- filtros ---------- */
  function contar(fn) { return gorras.filter(fn).length; }
  function chip(grupo, valor, texto, cuenta) {
    return '<button class="chip" data-grupo="' + grupo + '" data-valor="' + esc(valor) + '" aria-pressed="' +
      (filtros[grupo] === valor) + '">' + esc(texto) + (cuenta != null ? '<small>' + cuenta + '</small>' : '') + '</button>';
  }
  function montarFiltros() {
    var marcas = [];
    gorras.forEach(function (g) { if (marcas.indexOf(g.marca) < 0) marcas.push(g.marca); });
    var h = chip('marca', 'todas', 'Todas', gorras.length);
    marcas.forEach(function (m) { h += chip('marca', m, m, contar(function (g) { return g.marca === m; })); });
    $('[data-filtro-marca]').innerHTML = marcas.length > 1 ? h : '';

    var ya = contar(function (g) { return g.estado === 'disponible' || g.estado === 'ultimas'; });
    var vienen = contar(function (g) { return g.estado === 'por-llegar'; });
    $('[data-filtro-estado]').innerHTML = (ya && vienen)
      ? chip('estado', 'todos', 'Todo') + chip('estado', 'ya', 'Disponibles ahora', ya) + chip('estado', 'por-llegar', 'Por llegar', vienen)
      : '';

    var tallas = [];
    gorras.forEach(function (g) { g.tallas.forEach(function (t) { if (tallas.indexOf(t) < 0) tallas.push(t); }); });
    var extra = '';
    if (tallas.length > 1) {
      extra += chip('talla', 'todas', 'Todas las tallas');
      tallas.forEach(function (t) { extra += chip('talla', t, t); });
    }
    if (contar(function (g) { return typeof g.precio === 'number'; }) > 1) {
      extra += '<select class="selector" data-orden aria-label="Ordenar">' +
        '<option value="normal">Orden: destacadas</option>' +
        '<option value="menor">Precio: menor a mayor</option>' +
        '<option value="mayor">Precio: mayor a menor</option></select>';
    }
    $('[data-filtro-extra]').innerHTML = extra;

    $('.filtros').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      filtros[b.dataset.grupo] = b.dataset.valor;
      $$('.chip[data-grupo="' + b.dataset.grupo + '"]').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === b));
      });
      pintarRejilla(true);
    });
    var orden = $('[data-orden]');
    if (orden) orden.addEventListener('change', function () { filtros.orden = orden.value; pintarRejilla(true); });
  }

  function filtradas() {
    var l = gorras.filter(function (g) {
      if (filtros.marca !== 'todas' && g.marca !== filtros.marca) return false;
      if (filtros.talla !== 'todas' && g.tallas.indexOf(filtros.talla) < 0) return false;
      if (filtros.estado === 'ya' && !(g.estado === 'disponible' || g.estado === 'ultimas')) return false;
      if (filtros.estado === 'por-llegar' && g.estado !== 'por-llegar') return false;
      return true;
    });
    if (filtros.orden !== 'normal') {
      var s = filtros.orden === 'menor' ? 1 : -1;
      l = l.slice().sort(function (a, b) {
        var pa = typeof a.precio === 'number' ? a.precio : Infinity * s;
        var pb = typeof b.precio === 'number' ? b.precio : Infinity * s;
        return (pa - pb) * s;
      });
    }
    return l;
  }

  /* ---------- cuadrícula ---------- */
  function pintarRejilla(animar) {
    var ul = $('[data-rejilla]');
    $$('canvas', ul).forEach(function (c) { window.Burbujas.quitar(c); });
    var l = filtradas();
    var ya = contar(function (g) { return g.estado === 'disponible' || g.estado === 'ultimas'; });
    var vienen = contar(function (g) { return g.estado === 'por-llegar'; });
    $('[data-resumen]').textContent = gorras.length + ' gorras' +
      (ya ? ' · ' + ya + ' disponibles' : '') + (vienen ? ' · ' + vienen + ' en camino' : '') + '. Todas talla S/M.';

    ul.innerHTML = l.map(function (g, i) {
      return '<li class="tarjeta' + (g.estado === 'agotada' ? ' tarjeta--agotada' : '') + (animar ? ' entra' : ' revelar') +
        '" style="--d:-' + (i * 0.7).toFixed(1) + 's;--e:' + (i * 0.04).toFixed(2) + 's">' +
        '<a href="#/gorra/' + esc(g.id) + '">' +
        '<div class="tarjeta__escena">' +
        '<span class="tarjeta__num">' + num(g) + '</span>' +
        '<canvas class="burbuja" aria-hidden="true"></canvas>' +
        '<img src="' + foto(g.fotos[0].archivo, true) + '" alt="" loading="lazy" decoding="async" width="400" height="400">' +
        '</div>' +
        '<p class="tarjeta__marca">' + esc(g.marca) + '</p>' +
        '<h3 class="tarjeta__nombre">' + esc(g.nombre) + '</h3>' +
        '<p class="tarjeta__precio' + (typeof g.precio === 'number' ? '' : ' tarjeta__precio--pendiente') + '">' + esc(precio(g)) + '</p>' +
        '<div class="tarjeta__estado">' + etiquetas(g) + '</div>' +
        '</a></li>';
    }).join('');
    $('[data-vacia]').hidden = l.length > 0;

    $$('.tarjeta', ul).forEach(function (li, i) {
      var b = window.Burbujas.registrar($('canvas', li), { semilla: 1 + i * 1.37 });
      var a = $('a', li);
      a.addEventListener('pointerdown', function () { b.pulso(0.8); });
      a.addEventListener('click', function () { fijarOrigen($('.tarjeta__escena', li)); });
      if (!animar) observarRevelar(li);
    });
  }

  /* ---------- detalle ---------- */
  var det = {};
  function montarDetalle() {
    det.el = $('.detalle');
    det.burbuja = window.Burbujas.registrar($('[data-burbuja="detalle"]'), { semilla: 5.2, prioridad: true });
    $('[data-cerrar]', det.el).addEventListener('click', cerrarConHistoria);
    $('[data-compartir]', det.el).addEventListener('click', compartir);
    $$('[data-tab]', det.el).forEach(function (t) {
      t.addEventListener('click', function () { pestana(t.dataset.tab); });
    });
    var carril = $('[data-d-carril]');
    carril.addEventListener('scroll', function () {
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
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('.visor').hidden) cerrarVisor();
      else if (!det.el.hidden) cerrarConHistoria();
      else if (!$('#menu').hidden) alternarMenu(false);
    });
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
  function fijarOrigen(el) {
    var r = el.getBoundingClientRect();
    origen = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  var navegoDentro = false, scrollGuardado = 0, ultimoFoco = null;
  function abrirDetalle(id) {
    var g = gorras.find(function (x) { return x.id === id; });
    if (!g) { cerrarDetalle(); return; }
    det.g = g;
    det.lamina = 0;
    var el = det.el;

    $('[data-d-num]').textContent = num(g);
    $('[data-d-marca]').textContent = g.marca;
    $('[data-d-nombre]').textContent = g.nombre;
    $('[data-d-precio]').textContent = precio(g);
    $('[data-d-talla]').textContent = g.tallas.join(', ');
    $('[data-d-ajuste]').textContent = g.ajuste || 'Por confirmar';
    $('[data-d-estado]').innerHTML = etiquetas(g);
    $('[data-d-nota]').textContent = g.nota || '';
    $('[data-d-nota]').hidden = !g.nota;

    $('[data-d-carril]').innerHTML = g.fotos.map(function (f) {
      var recorte = f.recorte !== false;
      return '<div class="carril__lamina' + (recorte ? '' : ' carril__lamina--foto') + '">' +
        '<button data-zoom="' + foto(f.archivo) + '" aria-label="Ampliar foto: ' + esc(g.nombre) + ', ' + esc(f.vista) + '">' +
        '<img src="' + foto(f.archivo) + '" alt="' + esc(g.nombre) + ', ' + esc(f.vista) + '" decoding="async" width="720" height="720"></button></div>';
    }).join('');
    $('[data-d-carril]').scrollLeft = 0;
    indiceProducto();

    var reales = g.fotosReales || [];
    $('[data-d-pestanas]').hidden = !reales.length;
    $('[data-d-reales]').innerHTML = reales.map(function (f) {
      return '<div class="carril__lamina"><button data-zoom="' + fotoReal(f.archivo) + '" aria-label="Ampliar foto real: ' + esc(f.vista) + '">' +
        '<img src="' + fotoReal(f.archivo) + '" srcset="' + fotoReal(f.archivo, true) + ' 640w, ' + fotoReal(f.archivo) + ' 1200w" sizes="(min-width: 700px) 40vw, 86vw" ' +
        'alt="Foto real de la ' + esc(g.nombre) + ' en el mirador, ' + esc(f.vista.toLowerCase()) + '" loading="lazy" decoding="async" width="1200" height="1600"></button></div>';
    }).join('');
    $('[data-d-reales]').scrollLeft = 0;
    if (reales.length) $('[data-d-indice-real]').textContent = '1 / ' + reales.length + ' · ' + reales[0].vista;
    pestana('producto');

    var avisos = ['Entrega gratis en ' + tienda.entregaGratis.join(' y '), tienda.envios, tienda.promo];
    $('[data-d-avisos]').innerHTML = avisos.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    var boton = $('[data-d-wa]');
    if (g.estado === 'agotada') {
      boton.removeAttribute('href');
      boton.setAttribute('aria-disabled', 'true');
      $('[data-d-wa-texto]').textContent = 'Agotada';
    } else {
      boton.removeAttribute('aria-disabled');
      boton.href = wa(rellenar(g.estado === 'por-llegar' ? tienda.mensajeApartar : tienda.mensajePedir, g));
      $('[data-d-wa-texto]').textContent = g.estado === 'por-llegar' ? 'Apartar por WhatsApp' : 'Pedir por WhatsApp';
    }

    document.title = g.nombre + ' — Mono Caps';
    if (el.hidden) {
      ultimoFoco = document.activeElement;
      scrollGuardado = window.scrollY;
      var o = origen || { x: innerWidth / 2, y: innerHeight / 2 };
      el.style.setProperty('--ox', o.x + 'px');
      el.style.setProperty('--oy', o.y + 'px');
      origen = null;
      el.hidden = false;
      document.body.classList.add('bloqueado', 'detalle-abierto');
      $('.detalle__scroll').scrollTop = 0;
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('abierto'); }); });
      setTimeout(function () { el.focus({ preventScroll: true }); det.burbuja.pulso(1); }, 300);
    }
  }
  function cerrarDetalle() {
    var el = det.el;
    if (!el || el.hidden) return;
    document.title = 'Mono Caps — Gorras';
    el.classList.remove('abierto');
    document.body.classList.remove('bloqueado', 'detalle-abierto');
    window.scrollTo(0, scrollGuardado);
    setTimeout(function () {
      if (!el.classList.contains('abierto')) el.hidden = true;
    }, reducido ? 0 : 760);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }
  function cerrarConHistoria() {
    if (navegoDentro) { history.back(); }
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
  window.addEventListener('hashchange', function (e) {
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
      try { document.execCommand('copy'); avisar('Link copiado'); } catch (e) { avisar(texto); }
      t.remove();
    }
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function () { avisar('Link copiado'); }, viejo);
    else viejo();
  }

  /* ---------- visor con zoom (pellizcar, doble toque, arrastrar) ---------- */
  var visor = { s: 1, x: 0, y: 0, punteros: new Map() };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-zoom]');
    if (b) abrirVisor(b.dataset.zoom, $('img', b).alt);
  });
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
  (function () {
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
  function alternarMenu(abrir) {
    var m = $('#menu'), b = $('.hamburguesa');
    m.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
    b.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-abierto', abrir);
    document.body.classList.toggle('bloqueado', abrir);
  }
  $('.hamburguesa').addEventListener('click', function () { alternarMenu($('#menu').hidden); });

  // enlaces internos: desplazamiento suave sin ensuciar el historial
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href.indexOf('#/') === 0) return;
    e.preventDefault();
    alternarMenu(false);
    if (href === '#') { window.scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' }); return; }
    var destino = $(href);
    if (destino) destino.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  });

  /* ---------- revelado al hacer scroll ---------- */
  var ioRevelar = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); ioRevelar.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function observarRevelar(el) {
    if (ioRevelar) ioRevelar.observe(el); else el.classList.add('visible');
  }
  $$('.revelar').forEach(observarRevelar);

  /* ---------- scroll: paralaje de la portada y burbujas que se agitan ---------- */
  var portada = $('.portada'), yAnterior = window.scrollY, pendiente = false;
  function alHacerScroll() {
    pendiente = false;
    var y = window.scrollY;
    var alto = portada.offsetHeight;
    if (y < alto * 1.2 && !reducido) portada.style.setProperty('--py', y.toFixed(1));
    document.body.classList.toggle('paso-portada', y > alto * 0.55);
    var v = Math.abs(y - yAnterior);
    if (v > 6 && window.Burbujas) window.Burbujas.agitar(Math.min(0.55, v / 90));
    yAnterior = y;
  }
  window.addEventListener('scroll', function () {
    if (!pendiente) { pendiente = true; requestAnimationFrame(alHacerScroll); }
  }, { passive: true });
  alHacerScroll();
})();
