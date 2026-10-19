"""
Procesa las fotos del catálogo Mono Caps.

  python tools/procesar_fotos.py productos  <carpeta_png>    -> img/productos/
  python tools/procesar_fotos.py mirador    <carpeta_jpg>    -> img/mirador/
  python tools/procesar_fotos.py portada    <IMG_0230.jpg>   -> img/portada/

Productos: quita el fondo (solo recorta la silueta, no inventa ni retoca la gorra),
centra cada gorra en un lienzo cuadrado igual para todas y guarda WebP
en dos tamaños (720 px para el detalle, 400 px para la cuadrícula).
Los archivos con "detalle" en el nombre son primeros planos: se guardan tal cual, sin recortar.

Mirador: corrige la rotación, reduce a 1200 px y 640 px de ancho y guarda WebP.

Requiere: pip install pillow "rembg[cpu]"  (la primera vez descarga el modelo BiRefNet, ~1 GB)
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
LIENZO = 720          # lado del lienzo cuadrado grande
LIENZO_SM = 400       # lado del lienzo de la cuadrícula
ANCHO_GORRA = 0.86    # la gorra ocupa como máximo este ancho del lienzo
ALTO_GORRA = 0.74     # ...y este alto


def sesion():
    from rembg import new_session
    return new_session("birefnet-general")


def recortar(img, ses):
    from rembg import remove
    out = remove(img.convert("RGB"), session=ses)
    a = out.getchannel("A").point(lambda v: 0 if v < 12 else v)
    out.putalpha(a)
    return out.crop(a.getbbox())


def encajar(gorra, lado):
    escala = min(lado * ANCHO_GORRA / gorra.width, lado * ALTO_GORRA / gorra.height)
    escala = min(escala, 1.15)  # no agrandar más de lo que aguanta la foto
    g = gorra.resize((round(gorra.width * escala), round(gorra.height * escala)), Image.LANCZOS)
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(g, ((lado - g.width) // 2, (lado - g.height) // 2 + round(lado * 0.03)), g)
    return lienzo


def productos(carpeta):
    dst = RAIZ / "img" / "productos"
    (dst / "sm").mkdir(parents=True, exist_ok=True)
    ses = sesion()
    for f in sorted(Path(carpeta).glob("*.png")):
        img = Image.open(f)
        if "detalle" in f.stem:
            img = img.convert("RGB")
            img.thumbnail((LIENZO, LIENZO * 2), Image.LANCZOS)
            img.save(dst / f"{f.stem}.webp", quality=80, method=6)
            img.thumbnail((LIENZO_SM, LIENZO_SM * 2), Image.LANCZOS)
            img.save(dst / "sm" / f"{f.stem}.webp", quality=78, method=6)
        else:
            gorra = recortar(img, ses)
            encajar(gorra, LIENZO).save(dst / f"{f.stem}.webp", quality=84, method=6)
            encajar(gorra, LIENZO_SM).save(dst / "sm" / f"{f.stem}.webp", quality=82, method=6)
        print("ok", f.name)


def mirador(carpeta):
    dst = RAIZ / "img" / "mirador"
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(Path(carpeta).glob("*.[jJ][pP]*[gG]")):
        img = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
        for ancho, suf in ((1200, ""), (640, "-sm")):
            r = img.resize((ancho, round(img.height * ancho / img.width)), Image.LANCZOS)
            r.save(dst / f"{f.stem}{suf}.webp", quality=74, method=6)
        print("ok", f.name)


def portada(archivo):
    """Foto grupal + recorte de la Fox blanca (la que tapa la palabra CAPS)."""
    dst = RAIZ / "img" / "portada"
    dst.mkdir(parents=True, exist_ok=True)
    img = ImageOps.exif_transpose(Image.open(archivo)).convert("RGB")
    ses = sesion()
    for ancho, suf in ((1200, ""), (800, "-sm")):
        r = img.resize((ancho, round(img.height * ancho / img.width)), Image.LANCZOS)
        r.save(dst / f"portada{suf}.webp", quality=74, method=6)
        # zona de la Fox blanca, en proporción de la foto
        k = ancho / 1500
        caja = tuple(round(v * k) for v in (965, 620, 1340, 900))
        from rembg import remove
        trozo = remove(r.crop(caja), session=ses)
        capa = Image.new("RGBA", r.size, (0, 0, 0, 0))
        capa.paste(trozo, caja[:2], trozo)
        capa.save(dst / f"portada-gorra{suf}.webp", quality=86, method=6)
    print("ok portada")


if __name__ == "__main__":
    {"productos": productos, "mirador": mirador, "portada": portada}[sys.argv[1]](sys.argv[2])
