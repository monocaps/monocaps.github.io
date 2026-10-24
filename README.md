# Mono Caps — catálogo web

Catálogo de gorras pensado para celular. Se publica gratis en GitHub Pages y no necesita servidor ni base de datos.

```
index.html            inicio: la marca (portada, adelanto, cómo comprar, tallas, entregas)
coleccion.html        la colección: una gorra a la vez, se pasa deslizando de lado
css/styles.css        diseño general
css/coleccion.css     diseño de la colección
js/comun.js           base de las dos páginas (datos, detalle de gorra, zoom, menú)
js/inicio.js          lógica del inicio
js/coleccion.js       lógica de la colección (cambio de gorra, giro, filtros, "Ver todas")
js/gota.js            la burbuja que se parte como gota (WebGL)
js/burbuja.js         las burbujas pequeñas (adelanto y detalle)
data/productos.json   ← TODOS LOS DATOS. Es el único archivo que vas a editar casi siempre
img/productos/        fotos de producto sin fondo (720 px) y sm/ (400 px)
img/mirador/          fotos reales del mirador (1200 px y -sm 640 px)
img/portada/          foto grupal y recorte de la Fox blanca
fonts/                Anton, Barlow y Barlow Condensed
og.jpg                imagen que sale al compartir el link
tools/                scripts para procesar fotos (no hacen parte de la página)
```

**Link directo a una gorra:** `https://monocaps.github.io/coleccion.html?g=fox-roja` (el `id` de la gorra). En la colección, la parte de atrás que se ve al tocar la gorra es la segunda foto de `"fotos"`.

---

## 1. Editar productos (`data/productos.json`)

Ábrelo con cualquier editor de texto (Bloc de notas sirve; [VS Code](https://code.visualstudio.com/) avisa si te equivocas en una coma). Puedes editarlo directamente en GitHub: abre el archivo, toca el lápiz ✏️ y luego **Commit changes**. En 1 o 2 minutos la página se actualiza.

### Datos de la tienda (arriba del archivo)

| Campo | Para qué |
|---|---|
| `whatsapp` | Número con 57 adelante, sin espacios ni + |
| `mensajePedir` | Mensaje que se escribe solo. `{nombre}` y `{talla}` se reemplazan |
| `mensajeApartar` | Mensaje para gorras "Por llegar" |
| `instagram`, `tiktok` | Tu usuario sin @. Si lo dejas vacío `""`, no aparece |
| `pagos` | Lista de medios de pago |

### Cada gorra

```json
{
  "id": "fox-roja",                 ← se usa en el link: .../#/gorra/fox-roja (sin espacios ni tildes)
  "nombre": "Fox roja",
  "marca": "Fox Racing",            ← los filtros por marca salen solos de aquí
  "precio": null,                   ← null = "Precio por confirmar". Con precio: 185000 (sin puntos ni $)
  "tallas": ["S/M"],                ← si algún día hay más: ["S/M", "L/XL"] y aparece el filtro de talla
  "ajuste": "Flexfit",
  "estado": "disponible",           ← disponible | ultimas | por-llegar | encargo | agotada
  "nueva": false,                   ← true muestra la etiqueta NUEVA
  "nota": "Texto corto opcional",
  "fotos": [ { "archivo": "fox-roja_frente", "vista": "Frente" } ],
  "fotosReales": [ { "archivo": "IMG_0249", "vista": "Frente" } ]
}
```

**Estados:**
- `disponible`: se puede pedir.
- `ultimas`: muestra "Últimas unidades".
- `agotada`: se ve atenuada y el botón queda desactivado.
- `por-llegar`: el botón dice "Apartar por WhatsApp".
- `encargo`: ya se vendió, pero se puede encargar. Sale con el parche "VENDIDA · por encargo" y el botón dice "Encargar por WhatsApp" (mensaje en `mensajeEncargo`).

**Ordenar:** las gorras salen en el orden del archivo, y el número #01, #02… también sale de ese orden.

**Quitar una gorra:** borra su bloque `{ ... }` completo y revisa que entre bloques quede una sola coma (y que no quede coma después del último).

**Cuando cambies precios:** si hay 2 o más gorras con precio, aparece solo el selector "Ordenar por precio".

> Si la página sale vacía después de editar, casi siempre es una coma o comilla de más o de menos. Pega el archivo en https://jsonlint.com para ver la línea del error.

---

## 2. Agregar fotos

### Fotos reales del mirador (cuando lleguen las 5 gorras)

1. Pon los JPG del celular en una carpeta, por ejemplo `Descargas\fotos mirador`.
2. Conviértelos (reduce de unos 3 MB a unos 80 KB cada uno):
   ```
   python tools/procesar_fotos.py mirador "C:\Users\santi\Downloads\fotos mirador"
   ```
3. En `productos.json`, en la gorra correspondiente, llena `fotosReales`:
   ```json
   "fotosReales": [ { "archivo": "IMG_0300", "vista": "Frente" }, { "archivo": "IMG_0301", "vista": "Atrás" } ]
   ```
   La pestaña "Así llega" aparece sola. De paso, cambia `"estado"` a `"disponible"`.

### Fotos de producto nuevas (o reemplazar las capturas por fotos tuyas)

1. Nombra los PNG o JPG como `nombre-gorra_frente.png` y `nombre-gorra_atras.png`, y ponlos en una carpeta.
2. Quítales el fondo y normalízalos:
   ```
   python tools/procesar_fotos.py productos "C:\ruta\a\la\carpeta"
   ```
   La primera vez descarga un modelo de unos 1 GB y tarda. Solo recorta la silueta: no inventa ni retoca la gorra.
   Si el nombre lleva `detalle` (ej. `hurley-azul_atras-detalle.png`), se guarda sin recortar; en el JSON ponle `"recorte": false`.
3. Usa el mismo nombre (sin extensión) en `"fotos"` dentro del JSON.

Los scripts necesitan Python con: `pip install pillow "rembg[cpu]"`

---

## 3. Dónde está publicado

- Página: **https://monocaps.github.io/** (este es el link para la bio de Instagram y TikTok)
- Repositorio: https://github.com/monocaps/monocaps.github.io
- GitHub Pages publica la rama **main**, carpeta **/ (root)** (Settings → Pages).

**Para actualizar después:** edita `data/productos.json` en GitHub con el lápiz, o sube fotos nuevas con **Add file → Upload files** dentro de la carpeta correspondiente (`img/mirador/`, `img/productos/`…).

> WhatsApp guarda la vista previa de un link por un tiempo. Si cambias `og.jpg` y no se actualiza, comparte el link con `?v=2` al final.

---

## 4. Ver la página en tu computador antes de publicar

Abrir `index.html` con doble clic **no funciona**, porque el navegador bloquea la lectura del JSON. En la carpeta del proyecto ejecuta:

```
python -m http.server 8000
```

y abre http://localhost:8000

---

## Pendiente por confirmar

- Usuarios de Instagram y TikTok (`instagram` y `tiktok` en `productos.json`).
- Fotos reales del mirador de las gorras que vienen en camino, cuando lleguen.

## Logo

El original está en `marca/logo-original.png`. Si cambia: `python tools/procesar_logo.py marca/logo-original.png` y luego `python tools/imagen_compartir.py <IMG_0230.jpg>`.
