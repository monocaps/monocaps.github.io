/*
  Burbujas de obsidiana líquida.

  Un solo contexto WebGL (fuera de pantalla) dibuja todas las burbujas de la página
  y copia cada cuadro a su <canvas> 2D. Así hay burbujas "vivas" en todas las tarjetas
  sin abrir un contexto por tarjeta, que el celular no aguantaría.

  La luz que refleja el borde imita las luces de la ciudad vistas desde el mirador:
  ámbar y azul, como en las fotos de Mono Caps.

  Uso:
    Burbujas.registrar(canvas, { semilla: 3 })  -> { pulso() }
    Burbujas.agitar(0.6)                         // p. ej. al hacer scroll rápido
*/
(function () {
  'use strict';

  var LADO = 640; // tamaño máximo de una burbuja en píxeles
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec2 vUv;',
    'uniform float uTime, uSeed, uPulse, uPx;',

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

    // Entorno que se refleja: cielo nocturno + franja de luces de ciudad (ámbar y azul)
    'vec3 entorno(vec3 rd, float t){',
    ' float y = rd.y;',
    ' vec3 cielo = mix(vec3(0.006,0.007,0.014), vec3(0.05,0.055,0.085), smoothstep(-0.1,1.0,y));',
    ' float franja = smoothstep(-0.75,-0.32,y) * (1.0 - smoothstep(-0.12,0.10,y));',
    ' vec2 e = vec2(atan(rd.x, rd.z) * 1.4, y * 3.2);',
    ' float l1 = smoothstep(0.30, 0.85, snoise(vec3(e * 1.7, t * 0.12)));',
    ' float l2 = smoothstep(0.38, 0.90, snoise(vec3(e * 1.7 + 11.0, t * 0.14)));',
    ' vec3 ambar = vec3(1.0, 0.58, 0.22); vec3 azul = vec3(0.34, 0.56, 1.0);',
    ' vec3 ciudad = (ambar * l1 + azul * l2 * 0.9) * franja * 1.5;',
    ' ciudad += vec3(0.22, 0.14, 0.08) * franja * 0.45;',
    ' float arriba = smoothstep(0.35, 0.95, y) * 0.55;',
    ' return cielo + ciudad + vec3(arriba);',
    '}',

    'void main(){',
    ' vec2 p = (vUv * 2.0 - 1.0) * 1.2;',
    ' float t = uTime * 0.32 + uSeed * 7.31;',
    ' float ang = atan(p.y, p.x);',
    ' vec2 c = vec2(cos(ang), sin(ang));',
    ' float amp = 1.0 + uPulse * 1.3;',
    ' float ond = snoise(vec3(c * 0.85, t * 0.55)) * 0.034 * amp',
    '           + snoise(vec3(c * 2.0, t * 0.85 + 3.0)) * 0.013 * amp;',
    ' float r = length(p) / (1.0 + ond);',
    ' float aa = uPx * 2.4;',
    ' float alfa = 1.0 - smoothstep(1.0 - aa, 1.0, r);',
    ' if (alfa <= 0.0) { gl_FragColor = vec4(0.0); return; }',
    ' vec2 q = p / (1.0 + ond);',
    ' float z = sqrt(max(0.0, 1.0 - dot(q, q)));',
    ' vec3 n = normalize(vec3(q, z));',
    // superficie líquida: el ruido mueve las normales
    ' vec3 np = n * 1.5 + vec3(0.0, 0.0, t * 0.45);',
    ' n = normalize(n + (0.20 + 0.12 * uPulse) * vec3(snoise(np), snoise(np + 17.1), 0.0));',
    ' vec3 v = vec3(0.0, 0.0, 1.0);',
    ' vec3 rd = reflect(-v, n);',
    ' float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);',
    // cuerpo casi negro con un resplandor interno detrás de la gorra
    ' vec3 col = vec3(0.010, 0.010, 0.016);',
    ' vec2 g = q - vec2(0.0, -0.08);',
    ' col += vec3(0.095, 0.098, 0.122) * exp(-dot(g, g) * 1.8);',
    ' col += entorno(rd, t) * (0.06 + 1.25 * fres);',
    // filo de luz en el borde, como el canto de una piedra pulida
    ' float filo = smoothstep(0.80, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r));',
    ' col += mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.7, 0.4), smoothstep(0.2, -0.6, q.y)) * filo * 0.22;',
    ' vec3 L = normalize(vec3(-0.45, 0.62, 0.65));',
    ' float rl = max(dot(reflect(-L, n), v), 0.0);',
    ' col += vec3(0.92, 0.94, 1.0) * (pow(rl, 70.0) * 0.7 + pow(rl, 7.0) * 0.07);',
    ' gl_FragColor = vec4(col * alfa, alfa);',
    '}'
  ].join('\n');

  var gl, glCanvas, prog, u = {};
  var items = [];
  var agitacion = 0;
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
      function sh(tipo, src) {
        var s = gl.createShader(tipo);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uTime', 'uSeed', 'uPulse', 'uPx'].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
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
    items.forEach(function (it) { it.canvas.classList.add('burbuja--css'); });
  }

  function medir(it) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.min(LADO, Math.round(it.canvas.clientWidth * dpr));
    if (w > 0 && it.canvas.width !== w) {
      it.canvas.width = it.canvas.height = w;
      it.sucio = true;
    }
  }

  function dibujar(it, tiempo) {
    var w = it.canvas.width;
    if (!w || !gl) return;
    gl.viewport(0, 0, w, w);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uTime, tiempo);
    gl.uniform1f(u.uSeed, it.semilla);
    gl.uniform1f(u.uPulse, Math.min(1, it.pulso + agitacion));
    gl.uniform1f(u.uPx, 1.2 * 2 / w);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    it.ctx.clearRect(0, 0, w, w);
    it.ctx.drawImage(glCanvas, 0, LADO - w, w, w, 0, 0, w, w);
    it.sucio = false;
  }

  function bucle(ahora) {
    var visibles = items.filter(function (it) { return it.visible; });
    if (!visibles.length || document.hidden || !gl) { corriendo = false; return; }
    cuadro++;
    var tiempo = reducido ? 4 : (ahora - t0) / 1000;
    // con muchas burbujas en pantalla, cada una se actualiza a 30 cuadros por segundo
    var mitad = visibles.length > 3;
    visibles.forEach(function (it, i) {
      it.pulso *= 0.94;
      if (reducido) { if (it.sucio) dibujar(it, tiempo); return; }
      if (!mitad || (cuadro + i) % 2 === 0 || it.prioridad) dibujar(it, tiempo);
    });
    agitacion *= 0.92;
    requestAnimationFrame(bucle);
  }

  function arrancar() {
    if (!corriendo && gl) { corriendo = true; requestAnimationFrame(bucle); }
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      var it = items.find(function (x) { return x.canvas === e.target; });
      if (!it) return;
      it.visible = e.isIntersecting;
      if (it.visible) { medir(it); it.sucio = true; }
    });
    arrancar();
  }, { rootMargin: '80px' }) : null;

  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (ents) {
    ents.forEach(function (e) {
      var it = items.find(function (x) { return x.canvas === e.target; });
      if (it) medir(it);
    });
    arrancar();
  }) : null;

  var soportado = iniciarGL();

  window.Burbujas = {
    soportado: soportado,
    registrar: function (canvas, opciones) {
      opciones = opciones || {};
      var it = {
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        semilla: opciones.semilla || Math.random() * 10,
        prioridad: !!opciones.prioridad,
        pulso: 0,
        visible: !io,
        sucio: true
      };
      if (!soportado) { canvas.classList.add('burbuja--css'); }
      items.push(it);
      if (io) io.observe(canvas);
      if (ro) ro.observe(canvas);
      medir(it);
      arrancar();
      return {
        pulso: function (f) { it.pulso = Math.max(it.pulso, f || 1); it.sucio = true; arrancar(); },
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
    agitar: function (f) { agitacion = Math.min(0.8, Math.max(agitacion, f)); arrancar(); },
    reanudar: arrancar
  };

  document.addEventListener('visibilitychange', arrancar);
})();
