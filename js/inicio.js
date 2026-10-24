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
    yAnterior = y;
  }
  window.addEventListener('scroll', function () {
    if (!pendiente) { pendiente = true; requestAnimationFrame(alHacerScroll); }
  }, { passive: true });
  alHacerScroll();
})();
