#!/usr/bin/env python3
"""Generate committed web assets. Requires Pillow; originals are never modified."""
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / 'images'


def main():
    with Image.open(IMAGES / 'android-chrome-512x512.jpg') as source:
        portrait = ImageOps.exif_transpose(source).convert('RGB')
        avatar = ImageOps.fit(portrait, (384, 384), method=Image.Resampling.LANCZOS)
        avatar.save(IMAGES / 'avatar.webp', quality=82, method=6)
        for name, size in [('favicon-16x16', 16), ('favicon-32x32', 32),
                           ('apple-touch-icon', 180), ('android-chrome-192x192', 192),
                           ('android-chrome-512x512', 512)]:
            ImageOps.fit(portrait, (size, size), method=Image.Resampling.LANCZOS).save(
                IMAGES / (name + '.png'), optimize=True)

    # Only posts with an explicit cover_thumbnail opt in. Paths are root-relative.
    for post in sorted((ROOT / '_posts').glob('*.md')):
        front_matter = post.read_text().split('---', 2)[1]
        paths = dict(re.findall(r'^(cover_image|cover_thumbnail):\s*(/[^\n]+)$',
                                front_matter, re.MULTILINE))
        if 'cover_thumbnail' not in paths:
            continue
        target = ROOT / paths['cover_thumbnail'].lstrip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(ROOT / paths['cover_image'].lstrip('/')) as source:
            image = ImageOps.exif_transpose(source).convert('RGB')
            ImageOps.fit(image, (720, 405), method=Image.Resampling.LANCZOS).save(
                target, quality=80, method=6)
        print(target.relative_to(ROOT))


if __name__ == '__main__':
    main()
