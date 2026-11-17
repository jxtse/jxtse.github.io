#!/usr/bin/env python3
"""Check metadata, navigation, assets and loading policy after a Jekyll build."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '_site'


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.tags = []
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def elements(self, tag):
        return [attrs for name, attrs in self.tags if name == tag]

    def meta(self, key):
        return [a.get('content', '') for a in self.elements('meta')
                if a.get('name', a.get('property')) == key]


class SiteQuality(unittest.TestCase):
    def test_metadata(self):
        pages = [SITE / 'index.html', SITE / 'blog/index.html']
        pages += [SITE / project / 'index.html'
                  for project in ['cast', 'dsgram', 'tada', 'retrace', 'buyu']]
        pages += list((SITE / 'blog').glob('*/index.html'))
        self.assertGreater(len(pages), 7)
        for path in pages:
            with self.subTest(page=str(path.relative_to(SITE))):
                doc = Document(path)
                description = doc.meta('description')
                self.assertEqual(len(description), 1)
                self.assertTrue(description[0].strip())
                self.assertEqual(description, doc.meta('og:description'))
                self.assertEqual(description, doc.meta('twitter:description'))
                images = doc.meta('og:image')
                self.assertEqual(len(images), 1)
                self.assertTrue(images[0].startswith('https://'))
                self.assertTrue((SITE / unquote(urlsplit(images[0]).path).lstrip('/')).is_file())
                scripts = [a.get('src', '') for a in doc.elements('script')]
                self.assertFalse(any('googletagmanager.com' in s for s in scripts))
                self.assertFalse(any('mathjax' in s.lower() for s in scripts))
                self.assertFalse(any('gsap' in s.lower() for s in scripts))
                self.assertFalse(any('font-awesome' in a.get('href', '')
                                     for a in doc.elements('link')))

    def test_post_citation_meta(self):
        posts = list((SITE / 'blog').glob('*/index.html'))
        self.assertGreater(len(posts), 5)
        opted_out = set()
        for source in (ROOT / '_posts').glob('*.md'):
            front = source.read_text().split('\n---', 1)[0]
            if re.search(r'^scholar:\s*false\s*$', front, re.M):
                opted_out.add(source.stem[11:])
        self.assertGreater(len(opted_out), 0)
        for path in posts:
            with self.subTest(page=str(path.relative_to(SITE))):
                doc = Document(path)
                if path.parent.name in opted_out:
                    self.assertEqual(doc.meta('citation_title'), [])
                    continue
                for key in ['citation_title', 'citation_author',
                            'citation_publication_date']:
                    values = doc.meta(key)
                    self.assertEqual(len(values), 1, key)
                    self.assertTrue(values[0].strip(), key)
                self.assertRegex(doc.meta('citation_publication_date')[0],
                                 r'^\d{4}/\d{2}/\d{2}$')
        for path in [SITE / 'index.html', SITE / 'blog/index.html']:
            self.assertEqual(Document(path).meta('citation_title'), [])

    def test_home_navigation(self):
        doc = Document(SITE / 'index.html')
        ids = {a['id'] for _, a in doc.tags if 'id' in a}
        for a in doc.elements('a'):
            href = a.get('href', '')
            if href.startswith('/#'):
                self.assertIn(unquote(href[2:]), ids)
        self.assertTrue(any(a.get('href') == '/#-education' for a in doc.elements('a')))

    def test_xiaohongshu_icon_frame(self):
        import xml.etree.ElementTree as ET
        svg = ET.parse(ROOT / '_includes/icons/xiaohongshu.svg').getroot()
        ns = {'svg': 'http://www.w3.org/2000/svg'}
        frame = svg.find('svg:rect', ns)
        if frame is None:
            self.fail('Xiaohongshu icon must include a square frame')
        self.assertEqual(frame.get('fill'), 'none')
        self.assertEqual(frame.get('stroke'), 'currentColor')
        self.assertEqual(frame.get('width'), frame.get('height'))
        self.assertIsNotNone(svg.find('svg:g/svg:path', ns))

    def test_institution_logos(self):
        doc = Document(SITE / 'index.html')
        logos = [a for a in doc.elements('img')
                 if 'institution-logo' in a.get('class', '').split()]
        self.assertEqual(len(logos), 8)  # Three biography marks, five timeline marks.
        self.assertEqual(len({a['src'] for a in logos}), 5)
        for logo in logos:
            self.assertTrue(logo['src'].startswith('/images/institutions/'))
            self.assertTrue((SITE / logo['src'].lstrip('/')).is_file())
            self.assertEqual(logo.get('alt'), '')  # Adjacent names supply the text.
            self.assertIn(logo.get('width'), ['20', '24'])
            self.assertEqual(logo.get('width'), logo.get('height'))

    def test_research_directions(self):
        html = (SITE / 'index.html').read_text()
        headings = re.findall(r'<h3[^>]*>(.*?)</h3>', html, re.S)
        for title in ['Harness-Model Co-Design',
                      'Long-Horizon Evaluation', 'Data-Driven RSI']:
            self.assertIn(title, headings)
        for old_title in ['AI Researcher', 'Writer &amp; Builder', 'Life Explorer']:
            self.assertNotIn(old_title, html)
        for name in ['ReTRACE-27B-latest', 'ClinAge-4B', 'ClinAge-9B',
                     'TADA-Bench', 'TADA-Agent', 'CAST', 'DSGram',
                     'Traj2data', 'Traj2env']:
            self.assertIn(name, html)
        self.assertEqual(html.count('class="rd-lead"'), 3)
        links = {a.get('href') for a in Document(SITE / 'index.html').elements('a')}
        for href in ['/retrace/', '/cast/', '/dsgram/',
                     'https://huggingface.co/jxtse/ReTRACE-27B-latest',
                     'https://huggingface.co/jxtse/ClinAge-4B',
                     'https://huggingface.co/jxtse/ClinAge-9B',
                     'https://github.com/jxtse/tada/tree/main/benchmark',
                     'https://github.com/jxtse/tada/tree/main/agent',
                     'https://github.com/jxtse/agent-snapshot-resume',
                     'https://github.com/jxtse/tbs-taskgen']:
            self.assertIn(href, links)

    def test_home_social_preview(self):
        doc = Document(SITE / 'index.html')
        description = doc.meta('description')[0]
        self.assertIn('agentic systems', description)
        for stale in ['agentic reinforcement learning', 'collective intelligence']:
            self.assertNotIn(stale, description)
        for key in ['og:image', 'twitter:image']:
            self.assertEqual(doc.meta(key), ['https://jxtse.github.io/images/social-card.png'])
        data = (SITE / 'images/social-card.png').read_bytes()
        self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual((int.from_bytes(data[16:20], 'big'),
                          int.from_bytes(data[20:24], 'big')), (1200, 630))
        self.assertLess(len(data), 300_000)

    def test_canonical_code_links(self):
        for page in ['index.html', 'tada/index.html', 'dsgram/index.html']:
            html = (SITE / page).read_text()
            self.assertNotIn('github.com/jxtse/TADA-Agent', html)
            self.assertNotIn('github.com/jxtse/GEC-Metrics-DSGram', html)

    def test_icons_and_manifest(self):
        pages = [SITE / 'index.html', SITE / 'blog/index.html', SITE / 'cast/index.html']
        pages += list((SITE / 'blog').glob('*/index.html'))
        for page in pages:
            doc = Document(page)
            links = [a for a in doc.elements('link')
                     if a.get('rel') in ['icon', 'apple-touch-icon', 'manifest']]
            self.assertTrue(any(a.get('href') == '/images/jx-mark.svg' for a in links))
            for a in links:
                self.assertTrue((SITE / a['href'].lstrip('/')).is_file(), a['href'])
        svg = (SITE / 'images/jx-mark.svg').read_text()
        self.assertNotIn('<image', svg)  # Vector mark, not an embedded portrait.
        self.assertIn('Jinxiang Xie', svg)
        for size in [16, 32, 180, 192, 512]:
            data = (SITE / f'images/jx-icon-{size}.png').read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
            self.assertEqual(int.from_bytes(data[16:20], 'big'), size)
            self.assertEqual(int.from_bytes(data[20:24], 'big'), size)
        self.assertTrue((SITE / 'favicon.ico').is_file())
        manifest_path = SITE / 'images/site.webmanifest'
        manifest = json.loads(manifest_path.read_text())
        self.assertTrue(manifest['name'])
        for icon in manifest['icons']:
            self.assertTrue(icon['src'].startswith('jx-icon-'))
            self.assertTrue((manifest_path.parent / icon['src']).is_file())

    def test_private_build_inputs_excluded(self):
        names = ['AGENTS', 'AGENTS.md', 'CODE_REVIEW_IMPROVEMENTS',
                 'CODE_REVIEW_IMPROVEMENTS.md', 'README.md', 'Gemfile.lock',
                 'tests', 'scripts', 'run_server.sh']
        sitemap = (SITE / 'sitemap.xml').read_text()
        for name in names:
            self.assertFalse((SITE / name).exists(), name)
            self.assertNotIn('/' + name, sitemap)

    def test_card_images(self):
        for path, eager_count in [('index.html', 0), ('blog/index.html', 3)]:
            doc = Document(SITE / path)
            images = [a for a in doc.elements('img') if '/thumbnails/' in a.get('src', '')]
            self.assertGreater(len(images), 3)
            self.assertEqual(sum(a['loading'] == 'eager' for a in images), eager_count)
            for a in images:
                self.assertIn(a['loading'], ['lazy', 'eager'])
                self.assertEqual(a['decoding'], 'async')
                self.assertEqual((a['width'], a['height']), ('720', '405'))
                self.assertTrue((SITE / a['src'].lstrip('/')).is_file())


if __name__ == '__main__':
    unittest.main(verbosity=2)
