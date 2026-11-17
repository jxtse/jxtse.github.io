#!/usr/bin/env python3
"""Render the personal JX mark. Requires rsvg-convert and Pillow; no photo inputs."""
import io
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / 'images'


def main():
    png = subprocess.check_output([
        'rsvg-convert', '-w', '1024', '-h', '1024', str(IMAGES / 'jx-mark.svg')])
    source = Image.open(io.BytesIO(png)).convert('RGBA')
    for size in [16, 32, 180, 192, 512]:
        icon = source.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(IMAGES / f'jx-icon-{size}.png', optimize=True)
    # Also replace legacy endpoints, including the implicit browser fallback.
    for name, size in [('favicon-16x16', 16), ('favicon-32x32', 32),
                       ('apple-touch-icon', 180), ('android-chrome-192x192', 192),
                       ('android-chrome-512x512', 512)]:
        (IMAGES / f'{name}.png').write_bytes((IMAGES / f'jx-icon-{size}.png').read_bytes())
    source.save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    # Some older links may still request the previous images/ endpoint.
    (IMAGES / 'favicon.ico').write_bytes((ROOT / 'favicon.ico').read_bytes())
    # Link-preview card (Open Graph / X). Uses the same mark; no portrait.
    card = subprocess.check_output([
        'rsvg-convert', '-w', '1200', '-h', '630', str(IMAGES / 'social-card.svg')])
    Image.open(io.BytesIO(card)).convert('RGB').save(
        IMAGES / 'social-card.png', optimize=True)


if __name__ == '__main__':
    main()
