/* =========================================================
   MONO CAPS — la colección (coleccion.html)
   Una gorra a la vez dentro de la burbuja. Se pasa deslizando de lado (o con las flechas):
   la burbuja se estira, se parte como una gota, la vieja sale en diagonal con su gorra y
   la nueva aparece con la siguiente. Tocar la gorra la gira para ver la parte de atrás.
   ========================================================= */
(function () {
  'use strict';
  var MC = window.MC, $ = MC.$, $$ = MC.$$, reducido = MC.reducido;
  MC.tituloPagina = document.title;

  var DUR = reducido ? 0 : 900;           // ms de cada cambio de gorra
  var cong = location.search.match(/[?&]congelar=([\d.]+)/), congelar = cong ? +cong[1] : null;
  var lento = location.search.match(/[?&]lento=(\d+)/);
  if (lento) DUR *= +lento[1]; // solo para revisar la animación cuadro a cuadro (?lento=30)
  var TINTE_NEUTRO = [0.6, 0.65, 0.85];

  var col = { lista: [], i: 0, filtro: 'todos', ocupado: false, pendiente: 0, tintes: {} };
  var escena = $('[data-escena]');
  var gota = window.Gota.crear($('[data-gota-fondo]'), $('[data-gota-frente]'));
  var capas = [$('[data-gorra-a]'), $('[data-gorra-b]')]; // capas[0] = la gorra que se ve
  var sello = $('[data-col-sello]');

  /* ---------- utilidades de animación ---------- */
  function limitar(x) { return Math.max(0, Math.min(1, x)); }
  function tramo(t, a, b) { return limitar((t - a) / (b - a)); }
  function entrada(t) { return 1 - Math.pow(1 - t, 3); }
  function salida(t) { return t * t * t; }
  function rebote(t) { var c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  /* ---------- geometría del escenario ---------- */
  function medidas() {
    var w = escena.clientWidth, h = escena.clientHeight;
    return { w: w, h: h, cx: w / 2, cy: h * 0.5, r: Math.min(w * 0.37, h * 0.40) };
  }

  /* ---------- tinte: el color dominante de cada gorra (para el reflejo del borde) ---------- */
  function tinte(g) {
    if (col.tintes[g.id]) return col.tintes[g.id];
    col.tintes[g.id] = TINTE_NEUTRO;
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 24;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
        var d = x.getImageData(0, 0, 24, 24).data, r = 0, gg = 0, b = 0, peso = 0;
        for (var k = 0; k < d.length; k += 4) {
          if (d[k + 3] < 200) continue;
          var mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]);
          var sat = mx ? (mx - mn) / mx : 0, w = sat * sat + 0.02;
          r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; peso += w;
        }
        if (!peso) return;
        r /= peso; gg /= peso; b /= peso;
        var m = Math.max(r, gg, b) || 1, s = (Math.max(r, gg, b) - Math.min(r, gg, b)) / m;
        // gorras negras, grises o blancas: reflejo neutro; con color: ese color, aclarado
        col.tintes[g.id] = s < 0.22 ? TINTE_NEUTRO : [r / m, gg / m, b / m].map(function (v) { return 0.25 + v * 0.75; });
        if (col.lista[col.i] === g && !col.ocupado) pintarReposo();
      } catch (e) { /* sin acceso a los píxeles: tinte neutro */ }
    };
    img.src = MC.foto(g.fotos[0].archivo, true);
    return TINTE_NEUTRO;
  }

  /* ---------- la gorra dentro de cada capa ---------- */
  function atras(g) {
    var f = g.fotos[1];
    return f && f.recorte !== false ? f : null;
  }
  function vestir(capa, g) {
    var caras = $$('img', capa);
    caras[0].src = MC.foto(g.fotos[0].archivo);
    caras[0].alt = g.nombre + ', frente';
    var b = atras(g);
    caras[1].hidden = !b;
    if (b) { caras[1].src = MC.foto(b.archivo); caras[1].alt = g.nombre + ', ' + b.vista.toLowerCase(); }
    $('.col-giro', capa).classList.remove('girada');
  }
  function ubicar(capa, x, y, escala, opacidad, m) {
    var lado = m.r * 2 * 0.70;
    capa.style.width = capa.style.height = lado + 'px';
    capa.style.transform = 'translate3d(' + (x - lado / 2).toFixed(1) + 'px,' + (y - lado / 2).toFixed(1) + 'px,0) scale(' + escala.toFixed(3) + ')';
    capa.style.opacity = opacidad.toFixed(3);
  }

  /* ---------- reposo: una sola gota en el centro ---------- */
  function pintarReposo() {
    var g = col.lista[col.i];
    if (!g) return;
    var m = medidas();
    gota.gotas({ x: m.cx, y: m.cy, r: m.r, tinte: tinte(g) }, null, false);
    ubicar(capas[0], m.cx, m.cy, 1, 1, m);
    ubicar(capas[1], m.cx, m.cy, 1, 0, m);
    ubicarSello(m.cx, m.cy, m, g.estado === 'encargo');
    asomar();
  }
  function ubicarSello(x, y, m, visible) {
    sello.hidden = !visible;
    if (!visible) return;
    var lado = m.r * 0.78;
    sello.style.width = lado + 'px';
    sello.style.left = (x - m.r * 1.05) + 'px';
    sello.style.top = (y - m.r * 1.08) + 'px';
  }

  /* ---------- cambio de gorra: la gota se parte ----------
     dir 1 = siguiente: la gota vieja sale en diagonal hacia arriba a la izquierda y la nueva
     nace de ella y se queda en el centro con un rebote. dir -1 = anterior, en espejo. */
  function ir(dir, destino) {
    var n = col.lista.length;
    if (n < 2) { gota.pulso(1); return; }
    if (col.ocupado) { col.pendiente = dir; return; }
    var de = col.lista[col.i];
    col.i = destino != null ? destino : (col.i + dir + n) % n;
    var a = col.lista[col.i];
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
    actualizarUrl(a);
    if (!DUR) { vestir(capas[0], a); texto(a); progreso(); pintarReposo(); return; }

    col.ocupado = true;
    var vieja = capas[0], nueva = capas[1];
    vestir(nueva, a);
    // con datos lentos, espera a que la foto nueva esté lista (máx. 700 ms) antes de partir la gota
    var img = $('img', nueva);
    var lista = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    Promise.race([lista, new Promise(function (r) { setTimeout(r, 700); })]).then(function () { partir(de, a, dir, vieja, nueva); });
  }
  function partir(de, a, dir, vieja, nueva) {
    capas = [nueva, vieja];
    var tv = tinte(de), tn = tinte(a);
    var sale = dir > 0 ? { x: -0.66, y: -0.34 } : { x: 0.66, y: 0.34 };
    var nace = dir > 0 ? { x: 0.12, y: 0.07 } : { x: -0.12, y: -0.07 };
    var t0 = performance.now(), cambioTexto = false, conSello = de.estado === 'encargo';
    sello.classList.remove('pega');
    gota.pulso(0.8);

    requestAnimationFrame(function paso(ahora) {
      var t = limitar((ahora - t0) / DUR), m = medidas();
      if (congelar != null && t >= congelar) t = congelar; // revisión: deja el salto quieto en ese instante
      // la vieja: arranca despacio (se estira pegada a la nueva) y sale disparada en diagonal
      var tq = tramo(t, 0.0, 0.8), ts = tq * tq * (1.6 - 0.6 * tq);
      var A = { x: m.cx + sale.x * m.w * ts, y: m.cy + sale.y * m.h * ts, r: m.r * (1 - 0.5 * ts), tinte: tv, vida: 1 - tramo(t, 0.72, 0.86) };
      // la nueva: nace pequeña dentro de la vieja y crece hasta su sitio con un rebote
      var tn2 = tramo(t, 0.12, 1), re = rebote(tn2);
      var B = { x: m.cx + nace.x * m.w * (1 - entrada(tn2)), y: m.cy + nace.y * m.h * (1 - entrada(tn2)), r: m.r * (0.18 + 0.82 * re), tinte: tn };
      gota.gotas(B, A.vida > 0 ? A : null, true);
      ubicar(vieja, A.x, A.y, A.r / m.r, 1 - tramo(t, 0.55, 0.8), m);
      ubicar(nueva, B.x, B.y, B.r / m.r, tramo(t, 0.25, 0.5), m);
      if (conSello) ubicarSello(A.x, A.y, m, A.vida > 0.5);
      if (!cambioTexto && t > 0.32) { cambioTexto = true; texto(a); progreso(); asomar(); }
      if (t < 1) { requestAnimationFrame(paso); return; }
      if (congelar != null) return;
      col.ocupado = false;
      pintarReposo();
      if (a.estado === 'encargo') { void sello.offsetWidth; sello.classList.add('pega'); }
      if (col.pendiente) { var d = col.pendiente; col.pendiente = 0; ir(d); }
    });
  }

  /* ---------- textos de la gorra ---------- */
  function texto(g) {
    var info = $('[data-info]');
    $('[data-c-num]').textContent = MC.num(g);
    $('[data-c-marca]').textContent = g.marca;
    $('[data-c-nombre]').innerHTML = MC.letras(g.nombre);
    $('[data-c-meta]').innerHTML = MC.etiquetas(g) + '<span class="col-precio">' + MC.esc(MC.precio(g)) + '</span>';
    info.classList.remove('entra'); void info.offsetWidth; info.classList.add('entra');
    var boton = $('[data-c-wa]'), acc = MC.accion(g);
    if (acc) { boton.href = acc.href; boton.removeAttribute('aria-disabled'); $('[data-c-wa-texto]').textContent = acc.texto; }
    else { boton.removeAttribute('href'); boton.setAttribute('aria-disabled', 'true'); $('[data-c-wa-texto]').textContent = 'Agotada'; }
    $('[data-c-detalle]').href = '#/gorra/' + g.id;
    var pista = $('[data-pista-giro]');
    pista.hidden = !atras(g) || yaGiro();
    $('[data-toque]').setAttribute('aria-label', atras(g) ? 'Girar la ' + g.nombre + ' para ver la parte de atrás' : g.nombre + ': solo tiene foto de frente');
    // precarga la siguiente y la anterior
    var n = col.lista.length;
    [col.lista[(col.i + 1) % n], col.lista[(col.i - 1 + n) % n]].forEach(function (x) {
      if (x) { new Image().src = MC.foto(x.fotos[0].archivo); tinte(x); }
    });
  }

  /* ---------- pistas: rayitas de progreso y burbujas que asoman ---------- */
  function progreso() {
    var p = $('[data-progreso]');
    if (p.childElementCount !== col.lista.length) p.innerHTML = col.lista.map(function () { return '<span></span>'; }).join('');
    $$('span', p).forEach(function (s, k) { s.className = k < col.i ? 'visto' : k === col.i ? 'actual' : ''; });
    $('[data-contador]').textContent = (col.i + 1) + ' / ' + col.lista.length;
  }
  function asomar() {
    var n = col.lista.length;
    var prev = $('[data-asoma-prev]'), next = $('[data-asoma-next]');
    prev.hidden = next.hidden = n < 2;
    if (n < 2) return;
    $('img', prev).src = MC.foto(col.lista[(col.i - 1 + n) % n].fotos[0].archivo, true);
    $('img', next).src = MC.foto(col.lista[(col.i + 1) % n].fotos[0].archivo, true);
    $('[data-luces]').style.setProperty('--paso', col.i);
  }

  /* ---------- girar la gorra para ver la parte de atrás ---------- */
  function yaGiro() { try { return localStorage.getItem('mc-giro') === '1'; } catch (e) { return false; } }
  function girar() {
    var g = col.lista[col.i];
    if (!g || col.ocupado) return;
    gota.pulso(0.9);
    var giro = $('.col-giro', capas[0]);
    if (!atras(g)) { giro.classList.remove('nego'); void giro.offsetWidth; giro.classList.add('nego'); return; }
    giro.classList.toggle('girada');
    $('[data-pista-giro]').hidden = true;
    try { localStorage.setItem('mc-giro', '1'); } catch (e) {}
  }

  /* ---------- gestos: deslizar de lado cambia de gorra; tocar la gira ---------- */
  (function () {
    var ini = null;
    var zona = $('[data-gestos]');
    zona.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a, button:not([data-toque])')) return;
      ini = { x: e.clientX, y: e.clientY, t: performance.now(), toque: !!e.target.closest('[data-toque]') };
    });
    zona.addEventListener('pointerup', function (e) {
      if (!ini) return;
      var dx = e.clientX - ini.x, dy = e.clientY - ini.y, dt = performance.now() - ini.t, toque = ini.toque;
      ini = null;
      var rapido = Math.abs(dx) / Math.max(dt, 1) > 0.35;
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > 45 || (rapido && Math.abs(dx) > 22))) ir(dx < 0 ? 1 : -1);
      else if (toque && Math.abs(dx) < 10 && Math.abs(dy) < 10) girar();
    });
    zona.addEventListener('pointercancel', function () { ini = null; });
    $('[data-prev]').addEventListener('click', function () { ir(-1); });
    $('[data-next]').addEventListener('click', function () { ir(1); });
    document.addEventListener('keydown', function (e) {
      if (document.body.classList.contains('detalle-abierto') || !$('[data-panel-todas]').hidden) return;
      if (e.key === 'ArrowRight') ir(1);
      else if (e.key === 'ArrowLeft') ir(-1);
    });
  })();

  /* ---------- filtros ---------- */
  function cuenta(f) { return MC.gorras.filter(f).length; }
  var FILTROS = {
    todos: function () { return true; },
    ya: function (g) { return g.estado === 'disponible' || g.estado === 'ultimas'; },
    'por-llegar': function (g) { return g.estado === 'por-llegar'; },
    encargo: function (g) { return g.estado === 'encargo'; }
  };
  function montarFiltros() {
    var op = [['todos', 'Todas'], ['ya', 'Disponibles'], ['por-llegar', 'Por llegar'], ['encargo', 'Por encargo']]
      .filter(function (o) { return o[0] === 'todos' || cuenta(FILTROS[o[0]]); });
    var fila = $('[data-filtro-estado]');
    fila.innerHTML = op.length > 2 ? op.map(function (o) {
      return '<button class="chip" data-valor="' + o[0] + '" aria-pressed="' + (col.filtro === o[0]) + '">' + o[1] +
        '<small>' + cuenta(FILTROS[o[0]]) + '</small></button>';
    }).join('') : '';
    fila.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b || b.dataset.valor === col.filtro) return;
      col.filtro = b.dataset.valor;
      $$('.chip', fila).forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      aplicarFiltro();
    });
  }
  function aplicarFiltro(idInicial) {
    col.lista = MC.gorras.filter(FILTROS[col.filtro]);
    var k = idInicial ? col.lista.findIndex(function (g) { return g.id === idInicial; }) : 0;
    col.i = Math.max(0, k);
    $('[data-vacio]').hidden = col.lista.length > 0;
    if (!col.lista.length) return;
    vestir(capas[0], col.lista[col.i]);
    texto(col.lista[col.i]);
    progreso();
    pintarReposo();
    pintarTodas();
    actualizarUrl(col.lista[col.i]);
  }
  function actualizarUrl(g) {
    try { history.replaceState(history.state, '', location.pathname + '?g=' + encodeURIComponent(g.id) + location.hash); } catch (e) {}
  }

  /* ---------- ver todas: cuadrícula para ver la colección de un vistazo ---------- */
  function pintarTodas() {
    $('[data-todas]').innerHTML = col.lista.map(function (g, k) {
      return '<li><button class="mini" data-k="' + k + '">' +
        '<span class="mini__burbuja">' + (g.estado === 'encargo' ? MC.SELLO : '') +
        '<img src="' + MC.foto(g.fotos[0].archivo, true) + '" alt="" loading="lazy" width="400" height="400"></span>' +
        '<span class="mini__num">' + MC.num(g) + '</span>' +
        '<span class="mini__nombre">' + MC.esc(g.nombre) + '</span>' +
        '<span class="mini__precio">' + MC.esc(MC.precio(g)) + '</span>' + MC.etiquetas(g) +
        '</button></li>';
    }).join('');
  }
  function panelTodas(abrir) {
    var p = $('[data-panel-todas]'), b = $('[data-ver-todas]');
    p.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
    document.body.classList.toggle('todas-abierto', abrir);
    if (abrir) { p.scrollTop = 0; $('[data-cerrar-todas]').focus({ preventScroll: true }); }
  }
  $('[data-ver-todas]').addEventListener('click', function () { panelTodas($('[data-panel-todas]').hidden); });
  $('[data-cerrar-todas]').addEventListener('click', function () { panelTodas(false); });
  $('[data-todas]').addEventListener('click', function (e) {
    var b = e.target.closest('[data-k]');
    if (!b) return;
    var k = +b.dataset.k;
    panelTodas(false);
    if (k !== col.i) setTimeout(function () { ir(k > col.i ? 1 : -1, k); }, 120);
  });
  MC.alEscape = function () { if (!$('[data-panel-todas]').hidden) panelTodas(false); };

  /* ---------- detalle ---------- */
  $('[data-c-detalle]').addEventListener('click', function () { MC.fijarOrigen(escena); });
  // si el detalle se abre con un link directo, la colección se para en esa gorra
  MC.alAbrirGorra = function (g) {
    var k = col.lista.indexOf(g);
    if (k < 0) { col.filtro = 'todos'; $$('[data-filtro-estado] .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.valor === 'todos')); }); aplicarFiltro(g.id); }
    else if (k !== col.i && !col.ocupado) { col.i = k; vestir(capas[0], g); texto(g); progreso(); pintarReposo(); }
  };

  /* ---------- arranque ---------- */
  window.addEventListener('resize', function () { if (!col.ocupado) pintarReposo(); });
  MC.cargar().then(function () {
    montarFiltros();
    var enlace = location.hash.match(/^#\/gorra\/([\w-]+)/);
    var id = enlace ? enlace[1] : new URLSearchParams(location.search).get('g');
    aplicarFiltro(id);
    document.body.classList.add('lista');
  }).catch(function (err) {
    console.error(err);
    $('[data-vacio]').hidden = false;
    $('[data-vacio]').textContent = 'No se pudo cargar la colección. Recarga la página.';
  });
})();
