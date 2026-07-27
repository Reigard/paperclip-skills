const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * links.spec.js
 * Collect internal links from each configured page and assert each resolves to
 * a status < 400. External links are skipped unless links.checkExternal is set.
 */
function shouldIgnore(href) {
  return smoke.links.ignore.some((frag) => href.includes(frag));
}

for (const path of smoke.links.paths) {
  test(`links: ${path} has no broken internal links`, async ({ page, request }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const base = new URL(smoke.baseUrl);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));

    const toCheck = new Set();
    for (const href of hrefs) {
      if (!href || shouldIgnore(href)) continue;
      let url;
      try {
        url = new URL(href, smoke.baseUrl);
      } catch {
        continue;
      }
      const isExternal = url.host !== base.host;
      if (isExternal && !smoke.links.checkExternal) continue;
      toCheck.add(url.toString());
    }

    const broken = [];
    for (const url of toCheck) {
      try {
        // HEAD first; some servers reject HEAD, so fall back to GET.
        let res = await request.head(url, { failOnStatusCode: false });
        if (res.status() === 405 || res.status() === 501) {
          res = await request.get(url, { failOnStatusCode: false });
        }
        if (res.status() >= 400) {
          broken.push(`${res.status()}  ${url}`);
        }
      } catch (err) {
        broken.push(`ERR  ${url}  (${err.message})`);
      }
    }

    expect(broken, `Broken links on ${path}:\n${broken.join('\n')}`).toHaveLength(0);
  });
}
