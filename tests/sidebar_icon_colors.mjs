// Load this function into ego-browser nodejs, then pass a managed Page.
export default async function verifySidebarIconColors(page, baseURL) {
  const results = [];
  for (const path of ['/', '/blog/']) {
    await page.goto(baseURL + path);
    for (const width of [1440, 390]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', {
        width, height: 900, deviceScaleFactor: 1, mobile: false
      });
      const prefix = width > 768 ? '.author__urls' : '.author__urls_sm';
      const reference = `${prefix} a[href="https://github.com/jxtse"]`;
      const targets = [`${prefix} a[aria-label="Hugging Face"]`,
                       `${prefix} a[aria-label="小红书 / Xiaohongshu"]`];
      const color = selector => page.evaluate(s => {
        const a = document.querySelector(s);
        const icon = a.querySelector('svg, i');
        if (!icon.getBoundingClientRect().width) throw new Error('Hidden icon: ' + s);
        return getComputedStyle(icon.querySelector('path') || icon)[icon.tagName.toLowerCase() === 'svg' ? 'fill' : 'color'];
      }, selector);
      for (const state of ['normal', 'hover', 'focus']) {
        async function activate(selector) {
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          if (state === 'hover') await page.hover(selector + ' :is(i,svg)');
          if (state === 'focus') await page.focus(selector);
          // The site's icon colour transitions last 0.3s.
          await page.waitForTimeout(350);
        }
        await activate(reference);
        const expected = await color(reference);
        for (const selector of targets) {
          await activate(selector);
          const actual = await color(selector);
          if (actual !== expected) throw new Error(JSON.stringify({path,width,state,selector,expected,actual}));
        }
        results.push({path,width,state,color:expected});
      }
    }
  }
  console.log(JSON.stringify(results));
}
