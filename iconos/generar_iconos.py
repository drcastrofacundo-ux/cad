"""Deriva los tamanos de icono que faltan a partir de icon-512.png.

El diseno original (gota blanca con cruz sobre teal #0A6480) no se toca: es el
que ya esta instalado en los telefonos y por el que se reconoce la app. Este
script solo produce las variantes que Android e iOS necesitan y que faltaban.

    python iconos/generar_iconos.py
"""

import os

from PIL import Image

DIR = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(DIR)
ORIGEN = os.path.join(RAIZ, "icon-512.png")

TEAL = (10, 100, 128, 255)  # #0A6480, el fondo del icono original

# Los lanzadores de Android recortan el icono "maskable" a un circulo: el
# contenido tiene que caber en el 80% central para que no se coma la gota.
ESCALA_MASKABLE = 0.72


def redimensionar(lado, ruta):
    base = Image.open(ORIGEN).convert("RGBA")
    base.resize((lado, lado), Image.LANCZOS).save(ruta)
    return ruta


def maskable(lado, ruta):
    base = Image.open(ORIGEN).convert("RGBA")
    interior = int(lado * ESCALA_MASKABLE)
    lienzo = Image.new("RGBA", (lado, lado), TEAL)
    encogido = base.resize((interior, interior), Image.LANCZOS)
    desp = (lado - interior) // 2
    lienzo.paste(encogido, (desp, desp), encogido)
    lienzo.save(ruta)
    return ruta


if __name__ == "__main__":
    generados = [
        redimensionar(180, os.path.join(DIR, "icono-180.png")),   # apple-touch-icon
        redimensionar(32, os.path.join(DIR, "favicon-32.png")),
        maskable(512, os.path.join(DIR, "icono-512-maskable.png")),
    ]
    for ruta in generados:
        print(f"  {os.path.basename(ruta):28} {os.path.getsize(ruta):>7,} bytes")
