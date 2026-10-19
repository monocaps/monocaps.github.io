"""Genera la imagen para compartir el link (og.jpg) a partir de la foto grupal y el logo.

  python tools/imagen_compartir.py <IMG_0230.jpg>

Requiere img/logo.png (ver tools/procesar_logo.py).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import sys
R = Path(__file__).resolve().parent.parent
anton = str(R / "tools" / "Anton-Regular.ttf")
foto = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")

# 1200x630: foto a la derecha fundida en negro; logo, nombre y frase a la izquierda
W, H = 1200, 630
og = Image.new("RGB", (W, H), "black")
f = foto.resize((630, round(foto.height * 630 / foto.width)))
f = f.crop((0, round(f.height * 0.22), 630, round(f.height * 0.22) + H))
mask = Image.linear_gradient("L").rotate(90).resize((630, H))  # izquierda negra -> derecha blanca
mask = mask.point(lambda v: min(255, int(v * 1.8)))
og.paste(f, (W - 630, 0), mask)

logo = Image.open(R / "img" / "logo.png").convert("RGBA").resize((210, 210), Image.LANCZOS)
og.paste(logo, (60, 52), logo)
d = ImageDraw.Draw(og)
d.text((58, 270), "MONO CAPS", font=ImageFont.truetype(anton, 132), fill="white")
d.text((62, 470), "SE VE MEJOR DESDE ARRIBA.", font=ImageFont.truetype(anton, 44), fill=(204, 204, 204))
og.save(R / "og.jpg", quality=86)
print("ok")
