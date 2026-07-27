# Quickstart — zero to first green run

Target: **under 10 minutes** to a passing smoke run against your homepage. Then
grow it one check at a time.

## Prerequisites

- Node 20 or newer (`node --version`).
- A site with a public URL (production or staging).

## Step 1 — Install (about 2 minutes)

```bash
npm install
npm run install:browsers   # downloads Chromium for Playwright
```

## Step 2 — Point it at your site (about 1 minute)

Open `smoke.config.js` and change two lines:

```js
baseUrl: 'https://your-live-site.com',   // no trailing slash
siteName: 'Your Site Name',
```

Don't want to edit yet? Run against any URL with an env var:

```bash
SMOKE_BASE_URL='https://your-live-site.com' npm test
```

## Step 3 — First run (about 1 minute)

```bash
npm test
```

Out of the box, only the checks that make sense with an empty config will run:

- **availability** on `/`
- **console** on `/`
- **links** on `/`
- **seo** on `/` (+ robots.txt and sitemap)
- **cp** login page

`templates` and `forms` are skipped until you configure them. You should see
mostly green. If not, jump to [troubleshooting](troubleshooting.md) — the first
run surfaces the usual suspects (wrong CP path, no sitemap, redirect on `/`).

## Step 4 — See the report

```bash
npm run report
```

This opens the Playwright HTML report with screenshots for any failure.

## Step 5 — Add your critical paths

Back in `smoke.config.js`:

```js
criticalPaths: [
  '/',
  '/about',
  '/services',
  '/blog',
  '/contact',
],
```

Run again. These now get the full availability + error-text treatment.

## Step 6 — Add a template check

Confirm a page didn't just return 200 but actually rendered its key elements:

```js
templates: [
  { name: 'Homepage', path: '/', expect: ['header', 'main', 'footer'] },
  { name: 'Blog index', path: '/blog', expect: ['.post-card'] },
],
```

## Step 7 — Wire it to your deploy

Once it's green locally, make it run automatically:

1. Copy `ci/github-actions/smoke-on-deploy.yml` into `.github/workflows/`.
2. Follow your platform's trigger guide in [`ci/triggers/`](../ci/triggers/).
3. Set up [Slack notifications](../notifications/slack.md).

That's it. Every deploy now smoke-tests itself and pings you only if something
is wrong.

## Where to go next

- [Configuration](configuration.md) — every option explained.
- [Writing your own tests](writing-your-own.md) — for site-specific behavior.
