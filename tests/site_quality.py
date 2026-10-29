#!/usr/bin/env python3
"""Check metadata, navigation, assets and loading policy after a Jekyll build."""
import json
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
        for path in posts:
            with self.subTest(page=str(path.relative_to(SITE))):
                doc = Document(path)
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

    def test_icons_and_manifest(self):
        doc = Document(SITE / 'index.html')
        for a in doc.elements('link'):
            if a.get('rel') in ['icon', 'apple-touch-icon', 'manifest']:
                self.assertTrue((SITE / a['href'].lstrip('/')).is_file(), a['href'])
        manifest_path = SITE / 'images/site.webmanifest'
        manifest = json.loads(manifest_path.read_text())
        self.assertTrue(manifest['name'])
        for icon in manifest['icons']:
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
