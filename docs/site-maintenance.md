# Metadata and performance maintenance

## Page metadata

- Set a plain-text `description` in page/post front matter. The shared SEO include
  uses it for search, Open Graph and Twitter. It falls back to `excerpt`, then
  the site description.
- Set `cover_image` to a root-relative path for a page-specific sharing image.
  `social_image` in `_config.yml` is the fallback. Article covers retain the
  original images; listing thumbnails are separate.
- Google Analytics loads only when `google_analytics_id` is nonblank and the page
  does not set `analytics: false`. GoatCounter remains independently configured.

## Images

The original portrait and article images are retained. To regenerate the avatar,
PNG site icons, and opted-in blog thumbnails:

```sh
python3 -m pip install Pillow
python3 scripts/optimize_images.py
```

For a new post, add both paths before running the script:

```yaml
cover_image: /images/my-post/cover.jpg
cover_thumbnail: /images/thumbnails/my-post.webp
```

Commit the generated images: GitHub Pages does not run this Python script.
Thumbnails are center-cropped to 720 x 405 WebP. Omit `cover_thumbnail` to use the
original cover instead. Homepage cards load lazily; the first three cards on the
blog listing load eagerly. The 384px avatar covers the current 163px desktop
presentation at 2x pixel density. Manifest icon paths are relative to the manifest.

## Optional math and local icons

MathJax is opt-in. Add `math: true` to front matter for pages containing LaTeX
(`$...$`, `$$...$$`, `\(...\)`, etc.). Current pages do not require it. This also
avoids interpreting currency or token names such as `$TRUMP` as math.

Use the bundled Font Awesome 5 icons (`fas`, `fab`) rather than adding a CDN
stylesheet. Available names are in `_sass/vendor/font-awesome/_icons.scss`.

## Validation

```sh
bundle install
bundle exec jekyll build
python3 tests/site_quality.py
python3 tests/site_browser.py
python3 tests/bilingual_browser.py
```

The browser test requires Playwright and installed Chrome. `site_quality.py`
checks the current production configuration (Google Analytics unset, math off
on existing pages). Update those expectations if intentionally enabling them.
Development docs, tests, generation scripts and repository instructions are
excluded from the public build in `_config.yml`.
