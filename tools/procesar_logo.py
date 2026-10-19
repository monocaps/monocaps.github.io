"""
Recorta el logo (parche redondo) en un círculo con fondo transparente y genera sus tamaños.

  python tools/procesar_logo.py <logo.png>

Salida: img/logo.png (512), img/logo-sm.webp (128) e img/icono.png (180, ícono del celular).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
im = Image.open(sys.argv[1]).convert("RGB")

# el parche: el borde rojo va de x=7..719 e y=7..722 en el original de 724 px
cx, cy, r = 363, 364.5, 357.5
esc = 4  # máscara a 4x para que el borde quede suave
m = Image.new("L", (im.width * esc, im.height * esc), 0)
ImageDraw.Draw(m).ellipse([(cx - r) * esc, (cy - r) * esc, (cx + r) * esc, (cy + r) * esc], fill=255)
m = m.resize(im.size, Image.LANCZOS)
logo = im.convert("RGBA")
logo.putalpha(m)
logo = logo.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r)))

logo.resize((512, 512), Image.LANCZOS).save(RAIZ / "img" / "logo.png", optimize=True)
logo.resize((128, 128), Image.LANCZOS).save(RAIZ / "img" / "logo-sm.webp", quality=88)
icono = Image.new("RGBA", (180, 180), (0, 0, 0, 255))
l = logo.resize((164, 164), Image.LANCZOS)
icono.alpha_composite(l, (8, 8))
icono.convert("RGB").save(RAIZ / "img" / "icono.png")
print("ok")
