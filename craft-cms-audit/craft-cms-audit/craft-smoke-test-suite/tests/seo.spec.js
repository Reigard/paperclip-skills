const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

/**
 * SEO extras belong to frontend-audit unless the run opted in (SMOKE_CHECK_SEO=1).
 */
if (!smoke.seo.enabled) {
  test.skip('seo: skipped unless SMOKE_CHECK_SEO=1', () => {});
} else {
  for (const path of smoke.seo.paths) {
    test(`seo: ${path} has title, meta description, canonical`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const title = (await page.title()).trim();
      expect(title.length, `${path} has an empty <title>`).toBeGreaterThan(0);

      if (smoke.seo.requireMetaDescription) {
        const desc = await page.getAttribute('meta[name="description"]', 'content');
        expect((desc || '').trim().length, `${path} is missing a meta description`).toBeGreaterThan(0);
      }

      if (smoke.seo.requireCanonical) {
        const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
        expect((canonical || '').trim().length, `${path} is missing a canonical link`).toBeGreaterThan(0);
      }
    });
  }

  test('seo: robots.txt is reachable', async ({ request }) => {
    const res = await request.get(smoke.seo.robotsPath, { failOnStatusCode: false });
    expect(res.status(), `robots.txt returned ${res.status()}`).toBeLessThan(400);
  });

  test('seo: sitemap is reachable', async ({ request }) => {
    const res = await request.get(smoke.seo.sitemapPath, { failOnStatusCode: false });
    expect(res.status(), `sitemap returned ${res.status()}`).toBeLessThan(400);
  });
}
