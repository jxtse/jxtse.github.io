#!/usr/bin/env python3
import functools
import http.server
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
POST = '/blog/where-collective-intelligence-hits-its-ceiling/'


class BilingualBrowser(unittest.TestCase):
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

    def assert_language(self, page, language):
        other = 'zh' if language == 'en' else 'en'
        self.assertTrue(page.locator('[data-language-panel="' + language + '"]').is_visible())
        self.assertFalse(page.locator('[data-language-panel="' + other + '"]').is_visible())
        self.assertEqual(page.locator('[data-language-button="' + language + '"]').get_attribute('aria-pressed'), 'true')
        self.assertTrue(page.locator('.post-title [lang="' + ('zh-CN' if language == 'zh' else 'en') + '"]').is_visible())
        self.assertTrue(page.locator('.post-description [lang="' + ('zh-CN' if language == 'zh' else 'en') + '"]').is_visible())
        self.assertTrue(page.locator('.reading-toc-link').evaluate_all('(links) => links.length > 0 && links.every(link => document.getElementById(decodeURIComponent(link.hash.slice(1))).getClientRects().length > 0)'))
        self.assertTrue(page.locator('#cite').is_visible())

    def test_default_toggle_layout_and_retention(self):
        for width, height in [(1440, 1000), (390, 844)]:
            page = self.browser.new_page(viewport={'width': width, 'height': height})
            page.goto(self.base + POST)
            self.assertEqual(page.locator('[data-language-button]').count(), 2, 'Expected opt-in language buttons')
            for language in ['en', 'zh', 'en']:
                if language != 'en' or '#chinese' in page.url:
                    page.locator('[data-language-button="' + language + '"]').click()
                self.assert_language(page, language)
                self.assertTrue(page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
                self.assertEqual(page.locator('[data-language-panel="' + language + '"] table').count(), 2)
            self.assertEqual(page.locator('.post-content table').count(), 4)
            self.assertIn('author       = {Xie, Jinxiang}', page.locator('.post-content').inner_text())
            self.assertTrue(page.evaluate('new Set([...document.querySelectorAll("[id]")].map(element => element.id)).size === document.querySelectorAll("[id]").length'))
            page.close()

    def test_deep_links_history_and_keyboard(self):
        page = self.browser.new_page()
        page.goto(self.base + POST + '#chinese')
        self.assert_language(page, 'zh')
        heading = page.locator('#chinese h3').first.get_attribute('id')
        page.goto(self.base + POST + '#' + heading)
        self.assert_language(page, 'zh')
        page.locator('[data-language-button="en"]').focus()
        page.keyboard.press('Enter')
        self.assert_language(page, 'en')
        page.go_back()
        self.assert_language(page, 'zh')
        page.go_forward()
        self.assert_language(page, 'en')
        page.goto(self.base + POST)
        self.assert_language(page, 'en')
        page.goto(self.base + POST + '#english')
        self.assert_language(page, 'en')
        page.close()

    def test_old_post_and_english_listing(self):
        page = self.browser.new_page()
        page.goto(self.base + '/blog/')
        link = page.locator('a[href*="where-collective-intelligence-hits-its-ceiling"]').first
        self.assertIn('Where Collective Intelligence', link.inner_text())
        old = page.locator('a[href*="/blog/"]').evaluate_all('(links) => links.map(link => link.href).find(href => !href.endsWith("/blog/") && !href.includes("where-collective-intelligence-hits-its-ceiling"))')
        self.assertIsNotNone(old)
        page.goto(old)
        self.assertEqual(page.locator('[data-language-button]').count(), 0)
        page.close()

    def test_toggle_keeps_header_controls_on_screen(self):
        for width, height in [(1440, 1000), (390, 844)]:
            page = self.browser.new_page(viewport={'width': width, 'height': height})
            page.goto(self.base + POST)
            page.locator('[data-language-button="zh"]').click()
            box = page.locator('.post-language-switch').bounding_box()
            self.assertGreaterEqual(box['y'], 0, 'Switch should not scroll itself above viewport')
            self.assertLess(box['y'] + box['height'], height)
            page.close()

    def test_no_javascript(self):
        page = self.browser.new_page(java_script_enabled=False)
        page.goto(self.base + POST)
        self.assertTrue(page.locator('#english').is_visible())
        self.assertTrue(page.locator('#chinese').is_visible())
        self.assertEqual(page.locator('[data-language-button]:visible').count(), 0)
        self.assertEqual(page.locator('.post-content table').count(), 4)
        page.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
