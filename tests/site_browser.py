#!/usr/bin/env python3
"""Offline browser smoke tests for layout, local icons and optimized images."""
import functools
import http.server
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class SiteBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / '_site'))
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel='chrome', headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def test_pages_without_external_dependencies(self):
        for width, height in [(1440, 1000), (390, 844)]:
            for path in ['/', '/blog/', '/cast/']:
                with self.subTest(width=width, path=path):
                    page = self.browser.new_page(viewport={'width': width, 'height': height})
                    page.route('**/*', lambda route: route.continue_()
                               if route.request.url.startswith(self.base + '/') else route.abort())
                    errors, missing = [], []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('response', lambda response: missing.append(response.url)
                            if response.url.startswith(self.base) and response.status >= 400 else None)
                    page.goto(self.base + path)
                    page.evaluate('document.fonts.ready')
                    self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                    icons = page.locator('i.fas, i.fab, i.fa').evaluate_all('''icons => icons.map(icon => ({
                        name: icon.className,
                        content: getComputedStyle(icon, '::before').content,
                        font: getComputedStyle(icon).fontFamily
                    }))''')
                    self.assertTrue(icons)
                    for icon in icons:
                        self.assertNotIn(icon['content'], ['none', 'normal', '""'], icon['name'])
                        self.assertIn('Font Awesome 5', icon['font'])
                    for img in page.locator('.blog-card img, img.author__avatar').all():
                        img.scroll_into_view_if_needed()
                        img.evaluate('(img) => img.decode()')
                        self.assertGreater(img.evaluate('img => img.naturalWidth'), 0)
                    if path == '/':
                        avatar = page.locator('img.author__avatar').bounding_box()
                        self.assertAlmostEqual(avatar['width'], avatar['height'], delta=1)
                    self.assertEqual(errors, [])
                    self.assertEqual(missing, [])
                    page.close()

    def test_education_navigation(self):
        page = self.browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.route('**/*', lambda route: route.continue_()
                   if route.request.url.startswith(self.base + '/') else route.abort())
        page.goto(self.base + '/')
        link = page.get_by_role('link', name='Education', exact=True)
        self.assertEqual(link.get_attribute('href'), '/#-education')
        link.click()
        # The existing smooth-scroll plugin scrolls without changing the URL.
        page.wait_for_function("Math.abs(document.getElementById('-education').getBoundingClientRect().top) < 100")
        page.close()
        page = self.browser.new_page(java_script_enabled=False)
        page.route('**/*', lambda route: route.continue_()
                   if route.request.url.startswith(self.base + '/') else route.abort())
        page.goto(self.base + '/#-education')
        self.assertTrue(page.url.endswith('#-education'))
        page.wait_for_function("Math.abs(document.getElementById('-education').getBoundingClientRect().top) < 100")
        page.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
