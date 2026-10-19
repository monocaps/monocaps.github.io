/*
  Burbujas de obsidiana líquida.

  Un solo contexto WebGL (fuera de pantalla) dibuja todas las burbujas de la página
  y copia cada cuadro a sus <canvas> 2D. Cada burbuja tiene dos capas:
    - fondo: el cuerpo oscuro, detrás de la gorra
    - frente: el brillo del vidrio (borde y reflejo), delante de la gorra
  así la gorra queda "dentro" de la burbuja.

  La burbuja se comporta como líquido: se estira en la dirección en que se mueve
  (scroll, arrastre con el dedo) y rebota con un resorte al detenerse.
  La luz del borde imita las luces de la ciudad vistas desde el mirador (ámbar y azul).

  Uso:
    var b = Burbujas.registrar(canvasFondo, { frente: canvasFrente, semilla: 3 });
    b.empujar(x, y)    // hacia dónde se abomba el líquido (unidades ~ -0.7..0.7)
    b.pulso()          // ondulación
    Burbujas.scroll(vy) // velocidad del scroll en px por cuadro
*/
(function () {
  'use strict';

  var LADO = 640; // tamaño máximo de una burbuja en píxeles
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec2 vUv;',
    'uniform float uTime, uSeed, uPulse, uPx, uCapa;',
    'uniform vec2 uDef;',

    // Ruido simplex 3D (Ashima Arts / Stefan Gustavson, licencia MIT)
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    ' i=mod289(i);',
    ' vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',

    // Entorno que se refleja: cielo nocturno + franja de luces de ciudad
    'vec3 entorno(vec3 rd, float t){',
    ' float y = rd.y;',
    ' vec3 cielo = mix(vec3(0.006,0.007,0.014), vec3(0.05,0.055,0.085), smoothstep(-0.1,1.0,y));',
    ' float franja = smoothstep(-0.75,-0.32,y) * (1.0 - smoothstep(-0.12,0.10,y));',
    ' vec2 e = vec2(atan(rd.x, rd.z) * 1.4, y * 3.2);',
    ' float l1 = smoothstep(0.30, 0.85, snoise(vec3(e * 1.7, t * 0.12)));',
    ' float l2 = smoothstep(0.38, 0.90, snoise(vec3(e * 1.7 + 11.0, t * 0.14)));',
    ' vec3 ciudad = (vec3(1.0, 0.58, 0.22) * l1 + vec3(0.34, 0.56, 1.0) * l2 * 0.9) * franja * 1.5;',
    ' ciudad += vec3(0.22, 0.14, 0.08) * franja * 0.45;',
    ' return cielo + ciudad + vec3(smoothstep(0.35, 0.95, y) * 0.55);',
    '}',

    'void main(){',
    ' vec2 p = (vUv * 2.0 - 1.0) * 1.3;',
    // deformación líquida: se estira en la dirección del movimiento y se queda un poco atrás
    ' float s = min(length(uDef), 0.7);',
    ' if (s > 0.001) {',
    '   vec2 dir = uDef / length(uDef);',
    '   float a = dot(p, dir); vec2 perp = p - a * dir;',
    '   a = a / (1.0 + s * 0.5) - s * 0.10;',
    '   perp *= 1.0 + s * 0.22 + 0.10 * s * a;',
    '   p = a * dir + perp;',
    ' }',
    ' float t = uTime * 0.32 + uSeed * 7.31;',
    ' float ang = atan(p.y, p.x);',
    ' vec2 c = vec2(cos(ang), sin(ang));',
    ' float amp = 1.0 + uPulse * 1.4 + s * 0.8;',
    ' float ond = snoise(vec3(c * 0.85, t * 0.55)) * 0.032 * amp',
    '           + snoise(vec3(c * 2.0, t * 0.85 + 3.0)) * 0.012 * amp;',
    ' float r = length(p) / (1.0 + ond);',
    ' float alfa = 1.0 - smoothstep(1.0 - uPx * 2.4, 1.0, r);',
    ' if (alfa <= 0.0) { gl_FragColor = vec4(0.0); return; }',
    ' vec2 q = p / (1.0 + ond);',
    ' float z = sqrt(max(0.0, 1.0 - dot(q, q)));',
    ' vec3 n = normalize(vec3(q, z));',
    ' vec3 np = n * 1.5 + vec3(0.0, 0.0, t * 0.45);',
    ' n = normalize(n + (0.18 + 0.12 * uPulse + 0.1 * s) * vec3(snoise(np), snoise(np + 17.1), 0.0));',
    ' vec3 v = vec3(0.0, 0.0, 1.0);',
    ' vec3 rd = reflect(-v, n);',
    ' float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);',
    ' vec3 env = entorno(rd, t);',
    ' float filo = smoothstep(0.80, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r));',
    ' vec3 colFilo = mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.7, 0.4), smoothstep(0.2, -0.6, q.y)) * filo;',
    ' vec3 L = normalize(vec3(-0.45, 0.62, 0.65));',
    ' float rl = max(dot(reflect(-L, n), v), 0.0);',
    ' vec3 brillo = vec3(0.92, 0.94, 1.0) * (pow(rl, 70.0) * 0.75 + pow(rl, 7.0) * 0.05);',
    ' if (uCapa < 0.5) {',
    // fondo: cuerpo casi negro con un resplandor interno que separa las gorras negras
    '   vec3 col = vec3(0.010, 0.010, 0.016);',
    '   vec2 g = q - vec2(0.0, -0.04);',
    '   col += vec3(0.10, 0.103, 0.128) * exp(-dot(g, g) * 1.7);',
    '   col += env * (0.05 + 0.9 * fres) + colFilo * 0.12;',
    '   gl_FragColor = vec4(col * alfa, alfa);',
    ' } else {',
    // frente: solo el vidrio (borde iluminado y reflejo), transparente en el centro
    '   vec3 col = env * pow(fres, 1.6) * 0.95 + colFilo * 0.22 + brillo;',
    '   float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);',
    '   gl_FragColor = vec4(col * alfa, a * alfa);',
    ' }',
    '}'
  ].join('\n');

  var gl, glCanvas, u = {};
  var items = [];
  var global = { y: 0 };
  var t0 = performance.now();
  var corriendo = false;
  var cuadro = 0;

  function iniciarGL() {
    try {
      glCanvas = document.createElement('canvas');
      glCanvas.width = glCanvas.height = LADO;
      var opts = { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true };
      gl = glCanvas.getContext('webgl', opts) || glCanvas.getContext('experimental-webgl', opts);
      if (!gl) return false;
      var sh = function (tipo, src) {
        var s = gl.createShader(tipo);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      var prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTime', 'uSeed', 'uPulse', 'uPx', 'uCapa', 'uDef'].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
      gl.clearColor(0, 0, 0, 0);
      glCanvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; marcarCSS(); }, false);
      return true;
    } catch (err) {
      console.warn('Burbujas: sin WebGL, uso la versión simple.', err);
      gl = null;
      return false;
    }
  }

  function marcarCSS() {
    items.forEach(function (it) {
      it.canvas.classList.add('burbuja--css');
      if (it.frente) it.frente.classList.add('burbuja--css-frente');
    });
  }

  function medir(it) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.min(LADO, Math.round(it.canvas.clientWidth * dpr));
    if (w > 0 && it.canvas.width !== w) {
      it.canvas.width = it.canvas.height = w;
      if (it.frente) it.frente.width = it.frente.height = w;
    }
  }

  function pintarCapa(ctx, w, capa) {
    gl.uniform1f(u.uCapa, capa);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.clearRect(0, 0, w, w);
    ctx.drawImage(glCanvas, 0, LADO - w, w, w, 0, 0, w, w);
  }

  function dibujar(it, tiempo) {
    var w = it.canvas.width;
    if (!w || !gl) return;
    gl.viewport(0, 0, w, w);
    gl.uniform1f(u.uTime, tiempo);
    gl.uniform1f(u.uSeed, it.semilla);
    gl.uniform1f(u.uPulse, Math.min(1, it.pulso));
    gl.uniform1f(u.uPx, 1.3 * 2 / w);
    // en pantalla "abajo" es +y; en el shader es -y
    gl.uniform2f(u.uDef, it.dx, -it.dy);
    pintarCapa(it.ctx, w, 0);
    if (it.ctxFrente) pintarCapa(it.ctxFrente, w, 1);
  }

  // resorte: la deformación persigue al objetivo y rebota un poco al llegar
  function fisica(it) {
    var tx = it.ex, ty = it.ey + global.y * it.sensible;
    it.vx = (it.vx + (tx - it.dx) * 0.16) * 0.80;
    it.vy = (it.vy + (ty - it.dy) * 0.16) * 0.80;
    it.dx += it.vx; it.dy += it.vy;
    it.ex *= 0.86; it.ey *= 0.86;
    it.pulso *= 0.95;
  }

  function bucle(ahora) {
    var visibles = items.filter(function (it) { return it.visible; });
    if (!visibles.length || document.hidden || !gl) { corriendo = false; return; }
    cuadro++;
    var tiempo = reducido ? 4 : (ahora - t0) / 1000;
    global.y *= 0.88;
    // con muchas burbujas en pantalla, cada una se redibuja a 30 cuadros por segundo
    var mitad = visibles.length > 3;
    visibles.forEach(function (it, i) {
      fisica(it);
      if (reducido) { if (it.sucio) { dibujar(it, tiempo); it.sucio = false; } return; }
      if (!mitad || (cuadro + i) % 2 === 0 || it.prioridad) dibujar(it, tiempo);
    });
    requestAnimationFrame(bucle);
  }

  function arrancar() {
    if (!corriendo && gl) { corriendo = true; requestAnimationFrame(bucle); }
  }

  function buscar(canvas) {
    for (var i = 0; i < items.length; i++) if (items[i].canvas === canvas) return items[i];
    return null;
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      var it = buscar(e.target);
      if (!it) return;
      it.visible = e.isIntersecting;
      if (it.visible) { medir(it); it.sucio = true; }
    });
    arrancar();
  }, { rootMargin: '120px' }) : null;

  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (ents) {
    ents.forEach(function (e) {
      var it = buscar(e.target);
      if (it) { medir(it); it.sucio = true; }
    });
    arrancar();
  }) : null;

  var soportado = iniciarGL();

  window.Burbujas = {
    soportado: soportado,
    registrar: function (canvas, op) {
      op = op || {};
      var it = {
        canvas: canvas, ctx: canvas.getContext('2d'),
        frente: op.frente || null, ctxFrente: op.frente ? op.frente.getContext('2d') : null,
        semilla: op.semilla || Math.random() * 10,
        prioridad: !!op.prioridad,
        sensible: op.sensible == null ? 1 : op.sensible,
        pulso: 0, dx: 0, dy: 0, vx: 0, vy: 0, ex: 0, ey: 0,
        visible: !io, sucio: true
      };
      items.push(it);
      if (!soportado) marcarCSS();
      if (io) io.observe(canvas);
      if (ro) ro.observe(canvas);
      medir(it);
      arrancar();
      return {
        pulso: function (f) { it.pulso = Math.max(it.pulso, f || 1); it.sucio = true; arrancar(); },
        empujar: function (x, y) {
          if (reducido) return;
          it.ex = Math.max(-0.7, Math.min(0.7, x || 0));
          it.ey = Math.max(-0.7, Math.min(0.7, y || 0));
          arrancar();
        },
        semilla: function (s) { it.semilla = s; it.sucio = true; }
      };
    },
    quitar: function (canvas) {
      items = items.filter(function (it) {
        if (it.canvas !== canvas) return true;
        if (io) io.unobserve(canvas);
        if (ro) ro.unobserve(canvas);
        return false;
      });
    },
    // velocidad del scroll (px por cuadro): estira las burbujas en vertical
    scroll: function (vy) {
      if (reducido) return;
      var objetivo = Math.max(-0.4, Math.min(0.4, vy / 95));
      if (Math.abs(objetivo) > Math.abs(global.y)) global.y = objetivo;
      arrancar();
    },
    reanudar: arrancar
  };

  document.addEventListener('visibilitychange', arrancar);
})();
