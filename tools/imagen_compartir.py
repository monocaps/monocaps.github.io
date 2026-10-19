"""Genera la imagen para compartir (og.jpg) y el ícono, a partir de la foto grupal."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import sys
R = Path(__file__).resolve().parent.parent
anton = str(R / "tools" / "Anton-Regular.ttf")
foto = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")

# --- og.jpg 1200x630: foto a la derecha fundida en negro, texto a la izquierda
W, H = 1200, 630
og = Image.new("RGB", (W, H), "black")
f = foto.resize((630, round(foto.height * 630 / foto.width)))
f = f.crop((0, round(f.height * 0.22), 630, round(f.height * 0.22) + H))
mask = Image.linear_gradient("L").rotate(90).resize((630, H))  # izquierda negra -> derecha blanca
mask = mask.point(lambda v: min(255, int(v * 1.8)))
og.paste(f, (W - 630, 0), mask)
d = ImageDraw.Draw(og)
big = ImageFont.truetype(anton, 190)
d.text((60, 70), "MONO", font=big, fill="white")
d.text((60, 255), "CAPS", font=big, fill="white")
small = ImageFont.truetype(anton, 44)
d.text((64, 480), "SE VE MEJOR DESDE ARRIBA.", font=small, fill=(204, 204, 204))
og.save(R / "og.jpg", quality=86)

# --- ícono 512x512
ic = Image.new("RGB", (512, 512), "black")
d = ImageDraw.Draw(ic)
fnt = ImageFont.truetype(anton, 300)
bb = d.textbbox((0, 0), "MC", font=fnt)
d.text(((512 - (bb[2] - bb[0])) / 2 - bb[0], (512 - (bb[3] - bb[1])) / 2 - bb[1]), "MC", font=fnt, fill="white")
ic.save(R / "img" / "icono.png")
print("ok")
