# Bilingual blog authoring

New posts starting with *Where Collective Intelligence Hits Its Ceiling* are published as complete English and Chinese versions in one post and at one canonical URL. Existing monolingual posts are left unchanged.

Use the standard `layout: post` and retain English `title` and `description` for homepage cards and canonical metadata. Only when both translations are available, add:

```yaml
bilingual: true
title_zh: "中文标题"
description_zh: "对应的中文摘要"
```

Wrap the full translations in Markdown-enabled sections (blank lines matter):

```html
<noscript>
<p><a href="#english">English</a> · <a href="#chinese">中文</a></p>
</noscript>

<section id="english" data-language-panel="en" lang="en" markdown="1">

## English section heading

Complete English text.

</section>

<section id="chinese" data-language-panel="zh" lang="zh-CN" markdown="1">

## 中文章节标题

完整中文正文。

</section>

<section id="cite" markdown="1">

## Cite this post / 引用本文

One shared citation with the canonical URL and the correct author list.

</section>
```

Both panels' heading IDs must be unique. Match all factual claims, numbers, qualifications, references and figures across languages. No auto-translation is performed in the browser.

## Reader behavior

- Bare article URLs default to English; no global language preference is persisted.
- English/中文 buttons switch the title, summary, body and visible-heading TOC.
- `#english`, `#chinese`, and a heading inside either panel are shareable deep links. Back/forward navigation follows the selected language.
- Without JavaScript both full texts remain accessible with anchor navigation; inert buttons stay hidden.
- Posts without `bilingual: true` do not render a language switch.
- Keep wide tables horizontally scrollable inside the content column, not the page.

## Verification

Build with the project's Bundler/Jekyll environment, then run:

```sh
python3 tests/bilingual_browser.py
```

The browser tests require Python Playwright and installed Google Chrome; they start a temporary loopback-only server for `_site/`. They cover desktop/mobile switching, translated title/summary, TOC, history/deep links, keyboard access, no-JS fallback, old-post behavior, content retention, and control visibility after switching.

Before publishing, verify English homepage metadata, unchanged old-post behavior, exact deployed commit, and actual live browser switching rather than only HTTP 200.
