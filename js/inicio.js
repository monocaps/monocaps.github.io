/* =========================================================
   MONO CAPS — página de inicio (la marca)
   Portada, adelanto de la colección, cómo comprar, tallas, entregas.
   ========================================================= */
(function () {
  'use strict';
  var MC = window.MC, $ = MC.$, $$ = MC.$$, reducido = MC.reducido;
  MC.tituloPagina = document.title;

  // los links que ya se compartieron (index.html#/gorra/…) ahora viven en la colección
  if (/^#\/gorra\//.test(location.hash)) { location.replace('coleccion.html' + location.hash); return; }

  /* ---------- portada: animar solo cuando la foto y el recorte estén listos ---------- */
  (function () {
    var p = $('.portada');
    var listo = function () { p.classList.add('lista'); };
    Promise.all($$('.portada__foto, .portada__gorra').map(function (img) {
      return img.complete ? Promise.resolve() : new Promise(function (r) { img.onload = img.onerror = r; });
    })).then(listo);
    setTimeout(listo, 6000);
  })();

  /* ---------- datos ---------- */
  MC.cargar().then(function () {
    cinta();
    adelanto();
    calle();
  }).catch(function (err) { console.error(err); });

  function cinta() {
    var t = MC.tienda;
    var entrega = 'Entrega gratis en ' + t.entregaGratis.map(function (c) { return c.replace(/ \(.*\)/, ''); }).join(' y ');
    var avisos = [entrega, t.envios, t.promo, 'Pide por WhatsApp'];
    var fila = avisos.map(function (x) { return '<span>' + MC.esc(x) + '<i>✦</i></span>'; }).join('');
    $('[data-cinta]').innerHTML = fila + fila.replace(/<span>/g, '<span aria-hidden="true">');
  }

  /* ---------- adelanto de la colección: tres burbujas y el botón para entrar ---------- */
  function adelanto() {
    var g = MC.gorras;
    var cuenta = function (e) { return g.filter(function (x) { return e.indexOf(x.estado) >= 0; }).length; };
    var partes = [g.length + ' gorras'];
    if (cuenta(['disponible', 'ultimas'])) partes.push(cuenta(['disponible', 'ultimas']) + ' disponibles');
    if (cuenta(['por-llegar'])) partes.push(cuenta(['por-llegar']) + ' en camino');
    if (cuenta(['encargo'])) partes.push(cuenta(['encargo']) + ' por encargo');
    $('[data-resumen]').textContent = partes.join(' · ') + '. Todas talla S/M.';

    var orden = { disponible: 0, ultimas: 0, 'por-llegar': 1, encargo: 2, agotada: 3 };
    var tres = g.slice().sort(function (a, b) { return orden[a.estado] - orden[b.estado]; }).slice(0, 3);
    var ul = $('[data-adelanto]');
    ul.innerHTML = tres.map(function (x, i) {
      return '<li class="adelanto__item" style="--i:' + i + '"><a href="coleccion.html?g=' + MC.esc(x.id) + '" aria-label="' + MC.esc(x.nombre) + '">' +
        '<div class="flota">' + (x.estado === 'encargo' ? MC.SELLO : '') +
        '<canvas class="burbuja" aria-hidden="true"></canvas>' +
        '<img class="flota__gorra" src="' + MC.foto(x.fotos[0].archivo, true) + '" alt="" loading="lazy" decoding="async" width="400" height="400">' +
        '<canvas class="burbuja burbuja--frente" aria-hidden="true"></canvas>' +
        '</div></a></li>';
    }).join('');
    observarRevelar(ul);
    $$('.adelanto__item', ul).forEach(function (li, i) {
      var b = window.Burbujas.registrar($('canvas.burbuja', li), { frente: $('canvas.burbuja--frente', li), semilla: 2 + i * 1.9 });
      $('a', li).addEventListener('pointerdown', function () { b.pulso(0.9); });
    });
  }

  /* ---------- así se lleva: puntos sobre cada gorra de la foto ----------
     x/y en % de la foto. Cada punto muestra la gorra abajo y lleva a ella en la colección. */
  var PUNTOS = [
    { id: 'fox-negra-logo-gris', x: 63, y: 38.5 },
    { id: 'fox-roja', x: 20, y: 62.8 },
    { id: 'hurley-azul-rey', x: 37.3, y: 71 },
    { id: 'fox-blanca', x: 64, y: 69.3 },
    { id: 'fox-gris-oscuro', x: 80.5, y: 69 }
  ];
  function calle() {
    var cont = $('[data-calle-puntos]'), ficha = $('[data-calle-ficha]');
    var puntos = PUNTOS.map(function (p) { p.g = MC.gorras.filter(function (x) { return x.id === p.id; })[0]; return p; })
      .filter(function (p) { return p.g; });
    cont.innerHTML = puntos.map(function (p, i) {
      return '<button class="calle__punto" type="button" aria-pressed="false" data-i="' + i + '" style="--x:' + p.x + '%;--y:' + p.y + '%;--i:' + i + '" aria-label="' + MC.esc(p.g.nombre) + '"></button>';
    }).join('');
    cont.addEventListener('click', function (e) {
      var b = e.target.closest('.calle__punto');
      if (!b) return;
      $$('.calle__punto', cont).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var g = puntos[+b.dataset.i].g;
      ficha.innerHTML = '<a class="calle__gorra" href="coleccion.html?g=' + MC.esc(g.id) + '">' +
        '<span class="calle__mini">' +
        '<img src="' + MC.foto(g.fotos[0].archivo, true) + '" alt="" width="400" height="400"></span>' +
        '<span class="calle__datos"><span class="calle__nombre">' + MC.esc(g.nombre) + '</span>' + MC.etiquetas(g) + '</span>' +
        '<span class="calle__ver" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span></a>';
    });
  }

  /* ---------- enlaces internos: desplazamiento suave sin ensuciar el historial ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href.indexOf('#/') === 0) return;
    e.preventDefault();
    MC.alternarMenu(false);
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
  // títulos grandes: cada letra sube por separado
  $$('.titulo-seccion > span, .pie__marca').forEach(function (s) { s.innerHTML = MC.letras(s.textContent); });
  $$('.revelar, .pie__marca').forEach(observarRevelar);

  /* ---------- textos que se mueven con el dedo ----------
     Las líneas de los títulos se deslizan en direcciones opuestas según su altura en pantalla,
     y la cinta de avisos se acelera (o se devuelve) con la velocidad del scroll. */
  var titulos = $$('.titulo-seccion, .pie__marca');
  function derivarTextos() {
    if (reducido) return;
    var alto = window.innerHeight;
    titulos.forEach(function (h) {
      var r = h.getBoundingClientRect();
      if (r.bottom < 0 || r.top > alto) return;
      var c = (r.top + r.height / 2) / alto - 0.5; // -0.5 arriba … 0.5 abajo
      h.style.setProperty('--deriva', (c * 70).toFixed(1));
    });
  }
  var banda = { x: 0, v: 0, el: $('[data-cinta]') };
  (function moverCinta() {
    if (!reducido && banda.el.firstChild) {
      banda.v *= 0.92;
      banda.x -= 0.6 + banda.v;
      var mitad = banda.el.scrollWidth / 2;
      if (mitad) { if (banda.x <= -mitad) banda.x += mitad; if (banda.x > 0) banda.x -= mitad; }
      banda.el.style.transform = 'translate3d(' + banda.x.toFixed(1) + 'px,0,0)';
    }
    if (!reducido) requestAnimationFrame(moverCinta);
  })();

  // la foto de la calle se acerca un poco al entrar y se asienta mientras se baja
  var lienzo = $('[data-calle-lienzo]');
  function zoomCalle() {
    if (reducido || !lienzo) return;
    var r = lienzo.parentNode.getBoundingClientRect(), alto = window.innerHeight;
    if (r.bottom < 0 || r.top > alto) return;
    var p = Math.max(0, Math.min(1, (alto - r.top) / (alto + r.height * 0.6)));
    lienzo.style.setProperty('--pz', (1 - p).toFixed(3));
  }

  /* ---------- scroll: paralaje de la portada y burbujas que se agitan ---------- */
  var portada = $('.portada'), yAnterior = window.scrollY, pendiente = false;
  function alHacerScroll() {
    pendiente = false;
    var y = window.scrollY;
    var alto = portada.offsetHeight;
    if (y < alto * 1.2 && !reducido) portada.style.setProperty('--py', y.toFixed(1));
    document.body.classList.toggle('paso-portada', y > alto * 0.55);
    var v = y - yAnterior;
    if (Math.abs(v) > 1 && window.Burbujas) window.Burbujas.scroll(v);
    banda.v = Math.max(-14, Math.min(14, banda.v + v * 0.08));
    derivarTextos();
    zoomCalle();
    yAnterior = y;
  }
  window.addEventListener('scroll', function () {
    if (!pendiente) { pendiente = true; requestAnimationFrame(alHacerScroll); }
  }, { passive: true });
  alHacerScroll();
})();
