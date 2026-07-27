# Writing your own tests

The built-in tests cover the "is it up and rendering" basics for any Craft site.
Sooner or later you'll want to assert something specific to *your* site — that
the cart shows a total, that a gated page redirects, that a search returns
results. This is how.

## Two ways to extend

1. **Config-only** (preferred when it fits): add entries to `templates` or
   `forms` in `smoke.config.js`. No JavaScript required. Covers "this page
   renders these elements" and "this form submits".

2. **A new spec file**: drop a `*.spec.js` into `tests/`. Playwright picks it up
   automatically. Use this for behavior the config can't express.

## Anatomy of a spec

```js
const { test, expect } = require('@playwright/test');
const smoke = require('../smoke.config');

test('cart shows a running total', async ({ page }) => {
  await page.goto('/shop/cart');
  const total = page.locator('[data-cart-total]');
  await expect(total).toBeVisible();
  await expect(total).toContainText('$');
});
```

Key points:

- `baseURL` is already set from `smoke.config.js`, so `page.goto('/shop/cart')`
  resolves against your site. Use relative paths.
- Import `smoke` if you want to reuse config values (base URL, credentials,
  site-specific lists you add).
- Prefer **stable selectors**. Add `data-*` hooks in your templates
  (`data-cart-total`) rather than depending on class names that change with CSS.

## Common patterns

### Assert a redirect

```js
test('members-only page redirects anonymous visitors', async ({ page }) => {
  const res = await page.goto('/members/dashboard');
  expect(page.url()).toContain('/login');
});
```

### Search returns results

```js
test('site search finds a known entry', async ({ page }) => {
  await page.goto('/search?q=craft');
  await expect(page.locator('.search-result').first()).toBeVisible();
});
```

### An API/JSON endpoint responds

```js
test('menu JSON endpoint returns items', async ({ request }) => {
  const res = await request.get('/actions/menu/get');
  expect(res.status()).toBeLessThan(400);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
});
```

### Authenticated flows

Reuse the CP credentials pattern: read from env, skip when absent.

```js
const hasCreds = smoke.cp.username && smoke.cp.password;
(hasCreds ? test : test.skip)('logged-in user sees their name', async ({ page }) => {
  // ... perform login, then assert ...
});
```

## Keep your additions upgrade-safe

When a new version of the Suite ships, you'll typically replace the stock spec
files. To avoid losing your work:

- Put **all** custom specs in clearly named files, e.g.
  `tests/site-checkout.spec.js`, `tests/site-membership.spec.js`. Never edit the
  stock `availability.spec.js` etc. — add alongside them.
- Drive anything reusable through additions to `smoke.config.js` (you own that
  file; upgrades won't overwrite your values, only the shape — see the
  [CHANGELOG](../CHANGELOG.md) for any config changes).

## Running just your file

```bash
npx playwright test tests/site-checkout.spec.js
npx playwright test -g "cart shows"   # by test title
npm run test:ui                        # interactive runner, great for authoring
```

## A word on flakiness

Smoke tests should be **deterministic**. If a test only passes sometimes:

- Wait for state, don't sleep. Use `expect(locator).toBeVisible()` (auto-waits),
  not fixed timeouts.
- Load to the right point: `waitUntil: 'networkidle'` for JS-heavy pages.
- Avoid asserting on content that changes every request (timestamps, random
  featured items) unless that's the point.

See [troubleshooting](troubleshooting.md) for the flakiness section.
