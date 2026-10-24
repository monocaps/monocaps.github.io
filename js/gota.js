/*
  Gota: el escenario de la colección.

  Dibuja hasta dos gotas de obsidiana líquida en un mismo lienzo (WebGL). Cuando están
  cerca se funden en una sola forma (unión suave de sus contornos); al separarse aparece
  el "cuello" que se estira y se rompe, como una gota de agua que se divide.

  Cada gota tiene posición, radio y un tinte: el color de su gorra, que tiñe las luces
  que refleja el borde (el resto sigue siendo casi negro).

  Igual que burbuja.js, pinta dos capas en dos <canvas> 2D:
    - fondo: el cuerpo oscuro, detrás de las gorras
    - frente: el brillo del vidrio, delante de las gorras

  Uso:
    var g = Gota.crear(canvasFondo, canvasFrente);
    g.gotas([{ x, y, r, tinte: [r, g, b], vida: 0..1 }, ...])  // en px CSS del lienzo
    g.pulso(1)
*/
(function () {
  'use strict';

  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MAX = 1100; // lado máximo del lienzo interno, en px

  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;',          // tamaño del lienzo en px internos
    'uniform float uEsc;',         // px internos por px CSS
    'uniform vec4 uA, uB;',        // gota A y B: x, y, radio (px CSS), vida (0 = no existe)
    'uniform vec3 uTA, uTB;',      // tintes
    'uniform float uTime, uPulse, uCapa, uK;',

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

    // distancia al contorno de una gota que ondula un poco
    'float gota(vec2 p, vec4 g, float semilla){',
    ' if (g.w <= 0.0) return 1e5;',
    ' vec2 q = p - g.xy; float ang = atan(q.y, q.x); vec2 c = vec2(cos(ang), sin(ang));',
    ' float t = uTime * 0.32 + semilla;',
    ' float ond = snoise(vec3(c * 0.85, t * 0.55)) * 0.03 + snoise(vec3(c * 2.0, t * 0.85 + 3.0)) * 0.011;',
    ' ond *= 1.0 + uPulse * 1.5;',
    ' return length(q) - g.z * g.w * (1.0 + ond);',
    '}',
    // unión suave: dos gotas cercanas se funden; devuelve distancia y mezcla (0 = A, 1 = B)
    'vec2 campo(vec2 p){',
    ' float a = gota(p, uA, 1.7), b = gota(p, uB, 6.1);',
    ' float h = clamp(0.5 + 0.5 * (a - b) / uK, 0.0, 1.0);',
    ' return vec2(mix(a, b, h) - uK * h * (1.0 - h), h);',
    '}',

    // cielo nocturno + franja de luces de ciudad, teñida con el color de la gorra
    'vec3 entorno(vec3 rd, float t, vec3 tinte){',
    ' float y = rd.y;',
    ' vec3 cielo = mix(vec3(0.006,0.007,0.014), vec3(0.05,0.055,0.085), smoothstep(-0.1,1.0,y));',
    ' float franja = smoothstep(-0.75,-0.32,y) * (1.0 - smoothstep(-0.12,0.10,y));',
    ' vec2 e = vec2(atan(rd.x, rd.z) * 1.4, y * 3.2);',
    ' float l1 = smoothstep(0.30, 0.85, snoise(vec3(e * 1.7, t * 0.12)));',
    ' float l2 = smoothstep(0.38, 0.90, snoise(vec3(e * 1.7 + 11.0, t * 0.14)));',
    ' vec3 ambar = mix(vec3(1.0, 0.58, 0.22), tinte, 0.55);',
    ' vec3 azul = mix(vec3(0.34, 0.56, 1.0), tinte, 0.35);',
    ' vec3 ciudad = (ambar * l1 + azul * l2 * 0.9) * franja * 1.5 + tinte * franja * 0.25;',
    ' return cielo + ciudad + vec3(smoothstep(0.35, 0.95, y) * 0.55);',
    '}',

    'void main(){',
    ' vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uEsc;',  // px CSS, y hacia abajo
    ' vec2 f = campo(p);',
    ' float aa = 1.2;',
    ' float alfa = 1.0 - smoothstep(-aa, aa * 0.5, f.x);',
    ' if (alfa <= 0.0) { gl_FragColor = vec4(0.0); return; }',
    ' float R = mix(uA.z * uA.w, uB.z * uB.w, f.y);',
    ' vec3 tinte = mix(uTA, uTB, f.y);',
    // normal: dirección del contorno + altura como la de una esfera de radio R
    ' float e = 1.5;',
    ' vec2 grad = vec2(campo(p + vec2(e, 0.0)).x - f.x, campo(p + vec2(0.0, e)).x - f.x);',
    ' grad = length(grad) > 1e-5 ? normalize(grad) : vec2(0.0);',
    ' float d = min(f.x, 0.0);',
    ' float z = sqrt(max(0.0, -d * (2.0 * R + d))) / max(R, 1.0);',
    ' vec2 lado = grad * clamp((R + d) / max(R, 1.0), 0.0, 1.0);',
    ' vec3 n = normalize(vec3(lado.x, -lado.y, z + 0.02));',
    ' float t = uTime * 0.32;',
    ' vec3 np = n * 1.5 + vec3(0.0, 0.0, t * 0.45);',
    ' n = normalize(n + (0.18 + 0.12 * uPulse) * vec3(snoise(np), snoise(np + 17.1), 0.0));',
    ' vec3 v = vec3(0.0, 0.0, 1.0);',
    ' vec3 rd = reflect(-v, n);',
    ' float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);',
    ' vec3 env = entorno(rd, t, tinte);',
    ' float r = clamp(1.0 + f.x / max(R, 1.0), 0.0, 1.0);',  // 0 centro … 1 borde
    ' float filo = smoothstep(0.80, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r));',
    ' vec3 colFilo = mix(mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.7, 0.4), smoothstep(0.2, -0.6, n.y)), tinte, 0.45) * filo;',
    ' vec3 L = normalize(vec3(-0.45, 0.62, 0.65));',
    ' float rl = max(dot(reflect(-L, n), v), 0.0);',
    ' vec3 brillo = vec3(0.92, 0.94, 1.0) * (pow(rl, 70.0) * 0.75 + pow(rl, 7.0) * 0.05);',
    ' if (uCapa < 0.5) {',
    '   vec3 col = vec3(0.010, 0.010, 0.016);',
    '   vec2 ga = (p - uA.xy - vec2(0.0, uA.z * 0.04)) / max(uA.z, 1.0);',
    '   vec2 gb = (p - uB.xy - vec2(0.0, uB.z * 0.04)) / max(uB.z, 1.0);',
    '   float brA = uA.w > 0.0 ? exp(-dot(ga, ga) * 1.7) : 0.0;',
    '   float brB = uB.w > 0.0 ? exp(-dot(gb, gb) * 1.7) : 0.0;',
    '   col += vec3(0.10, 0.103, 0.128) * max(brA, brB) + tinte * 0.03 * max(brA, brB);',
    '   col += env * (0.05 + 0.9 * fres) + colFilo * 0.12;',
    '   gl_FragColor = vec4(col * alfa, alfa);',
    ' } else {',
    '   vec3 col = env * pow(fres, 1.6) * 0.95 + colFilo * 0.22 + brillo;',
    '   float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);',
    '   gl_FragColor = vec4(col * alfa, a * alfa);',
    ' }',
    '}'
  ].join('\n');

  function crear(fondo, frente) {
    var glc = document.createElement('canvas');
    var opts = { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true };
    var gl = glc.getContext('webgl', opts) || glc.getContext('experimental-webgl', opts);
    var ctxF = fondo.getContext('2d'), ctxV = frente.getContext('2d');
    var u = {}, estado = { A: null, B: null, pulso: 0 }, t0 = performance.now(), corriendo = false, cuadro = 0;
    var ancho = 0, alto = 0, esc = 1;

    if (gl) {
      try {
        var sh = function (tipo, src) {
          var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
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
        ['uRes', 'uEsc', 'uA', 'uB', 'uTA', 'uTB', 'uTime', 'uPulse', 'uCapa', 'uK'].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
        gl.clearColor(0, 0, 0, 0);
        glc.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; }, false);
      } catch (err) {
        console.warn('Gota: sin WebGL.', err);
        gl = null;
      }
    }

    function medir() {
      var w = fondo.clientWidth, h = fondo.clientHeight;
      if (!w || !h) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      esc = Math.min(dpr, MAX / Math.max(w, h));
      ancho = Math.round(w * esc); alto = Math.round(h * esc);
      [fondo, frente, glc].forEach(function (c) { if (c.width !== ancho) c.width = ancho; if (c.height !== alto) c.height = alto; });
    }

    function capa(ctx, n) {
      gl.uniform1f(u.uCapa, n);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      ctx.clearRect(0, 0, ancho, alto);
      ctx.drawImage(glc, 0, 0);
    }
    function gv(g) { return g ? [g.x, g.y, g.r, g.vida == null ? 1 : g.vida] : [0, 0, 0, 0]; }
    function tv(g) { return g && g.tinte ? g.tinte : [0.6, 0.65, 0.85]; }

    function dibujar(ahora) {
      if (!gl || !ancho) return;
      gl.viewport(0, 0, ancho, alto);
      gl.uniform2f(u.uRes, ancho, alto);
      gl.uniform1f(u.uEsc, esc);
      gl.uniform4fv(u.uA, gv(estado.A));
      gl.uniform4fv(u.uB, gv(estado.B));
      gl.uniform3fv(u.uTA, tv(estado.A));
      gl.uniform3fv(u.uTB, tv(estado.B));
      gl.uniform1f(u.uTime, reducido ? 4 : (ahora - t0) / 1000);
      gl.uniform1f(u.uPulse, Math.min(1, estado.pulso));
      var r = (estado.A ? estado.A.r : 100);
      gl.uniform1f(u.uK, r * 0.45);
      capa(ctxF, 0);
      capa(ctxV, 1);
    }

    function bucle(ahora) {
      if (document.hidden || !gl) { corriendo = false; return; }
      cuadro++;
      estado.pulso *= 0.95;
      // en reposo basta con 30 cuadros por segundo; durante un salto, todos
      if (estado.animando || cuadro % 2 === 0) dibujar(ahora);
      if (reducido && !estado.animando) { corriendo = false; return; }
      requestAnimationFrame(bucle);
    }
    function arrancar() { if (!corriendo && gl) { corriendo = true; requestAnimationFrame(bucle); } }

    if ('ResizeObserver' in window) new ResizeObserver(function () { medir(); arrancar(); }).observe(fondo);
    window.addEventListener('resize', medir);
    document.addEventListener('visibilitychange', arrancar);
    medir();

    return {
      soportado: !!gl,
      gotas: function (A, B, animando) { estado.A = A; estado.B = B; estado.animando = !!animando; arrancar(); if (reducido) dibujar(performance.now()); },
      pulso: function (f) { estado.pulso = Math.max(estado.pulso, f || 1); arrancar(); },
      medir: medir
    };
  }

  window.Gota = { crear: crear };
})();
