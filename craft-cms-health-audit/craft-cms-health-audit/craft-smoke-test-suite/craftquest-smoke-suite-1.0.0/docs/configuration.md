# Configuration reference

Everything you configure lives in **`smoke.config.js`**. This page documents
every option. Options read from `process.env` can also be set in CI without
editing the file.

## Top level

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseUrl` | string | `https://example.com` | Base URL under test, **no trailing slash**. Override with `SMOKE_BASE_URL`. |
| `siteName` | string | `My CraftQuest Site` | Friendly name shown in reports and Slack. |
| `criticalPaths` | string[] | `['/']` | Paths that must return 200 and render with no error text. |
| `errorText` | string[] | Craft/Yii/PHP error strings | Case-insensitive substrings that, if found in HTML, fail the page. |
| `retries` | number | `1` on CI, `0` local | Retries per test before reporting red. Smooths CDN races after deploy. |

### `errorText`

The defaults catch the common Craft/Twig/Yii/PDO fatal errors. Keep this list
**tight** — an overly broad string (like `error`) will match legitimate content
("404 error page") and cause false failures. Add strings specific to your stack
if you have custom error output.

## `templates[]`

Each entry loads a page and asserts every selector is visible.

```js
templates: [
  { name: 'Blog entry', path: '/blog/hello', expect: ['article h1', 'time', '.entry-body'] },
],
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Label in test output. |
| `path` | string | Path to load, relative to `baseUrl`. |
| `expect` | string[] | CSS selectors that must each be **visible**. Use stable, meaningful selectors (a heading, main content), not fragile ones. |

Leave the array empty to skip template tests.

## `console`

```js
console: { paths: ['/'], ignore: ['favicon.ico'] },
```

| Field | Type | Description |
| --- | --- | --- |
| `paths` | string[] | Pages to load and watch for JS errors. |
| `ignore` | string[] | Substrings of error messages to ignore (noisy third parties). |

A test fails if any `console.error` or uncaught exception fires that isn't
ignored. Pages are loaded to `networkidle` so late errors are caught.

## `links`

```js
links: { paths: ['/'], checkExternal: false, ignore: ['mailto:', 'tel:', '#'] },
```

| Field | Type | Description |
| --- | --- | --- |
| `paths` | string[] | Pages whose links are collected and checked. |
| `checkExternal` | boolean | If `true`, also check links to other hosts. Off by default (external sites cause flaky failures). |
| `ignore` | string[] | Href substrings to skip entirely. |

Each link is checked with `HEAD` (falling back to `GET` if the server rejects
`HEAD`). A status ≥ 400 fails the test.

## `seo`

```js
seo: {
  paths: ['/'],
  requireCanonical: true,
  requireMetaDescription: true,
  robotsPath: '/robots.txt',
  sitemapPath: '/sitemap.xml',
},
```

| Field | Type | Description |
| --- | --- | --- |
| `paths` | string[] | Pages checked for `<title>`, meta description, canonical. |
| `requireCanonical` | boolean | Require a non-empty `<link rel="canonical">`. |
| `requireMetaDescription` | boolean | Require a non-empty meta description. |
| `robotsPath` | string | Path to `robots.txt`; must be reachable. |
| `sitemapPath` | string | Path to the sitemap; must be reachable. If you use the SEOmatic/sitemap plugin, set this to its URL (e.g. `/sitemaps-1-sitemap.xml`). |

## `forms[]`

```js
forms: [{
  name: 'Contact form',
  path: '/contact',
  formSelector: 'form#contact',
  fields: { fromName: 'Smoke Test', fromEmail: 'smoke@example.com', message: 'Please ignore.' },
  honeypot: 'freeform_form_handle',
  submitSelector: 'button[type="submit"]',
  successText: 'Thanks',
}],
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Label in test output. |
| `path` | string | Page containing the form. |
| `formSelector` | string | CSS selector for the `<form>`. |
| `fields` | object | `{ inputName: value }` pairs to fill. |
| `honeypot` | string | Name of the hidden anti-spam field; left blank so the form treats you as human. |
| `submitSelector` | string | Selector for the submit button (within the form). |
| `successText` | string | Text that appears **only on success**. |

> **Point form tests at staging** or use forms that tolerate test submissions —
> a passing test means a real email/entry was created.

## `cp`

```js
cp: {
  loginPath: '/admin/login',
  dashboardPath: '/admin/dashboard',
  username: process.env.SMOKE_CP_USERNAME || null,
  password: process.env.SMOKE_CP_PASSWORD || null,
},
```

| Field | Type | Description |
| --- | --- | --- |
| `loginPath` | string | Craft CP login path. Match your `cpTrigger` (default `admin`). |
| `dashboardPath` | string | Authenticated landing page to verify. |
| `username` / `password` | string / null | From env only. If both set, the authenticated check runs; otherwise it's skipped. |

**Never commit credentials.** Set `SMOKE_CP_USERNAME` / `SMOKE_CP_PASSWORD` as
CI secrets.

## `timeouts`

```js
timeouts: { action: 15000, test: 30000 },
```

| Field | Type | Description |
| --- | --- | --- |
| `action` | ms | Per-action / navigation timeout. Raise for slow origins. |
| `test` | ms | Per-test timeout. |

## `notifications.slack`

```js
notifications: {
  slack: {
    webhookUrl: process.env.SMOKE_SLACK_WEBHOOK || null,
    notifyOn: 'failure',
  },
},
```

| Field | Type | Description |
| --- | --- | --- |
| `webhookUrl` | string / null | Slack incoming webhook. `null` disables notifications. From env. |
| `notifyOn` | `'failure'` \| `'always'` | When to post. See [notifications/slack.md](../notifications/slack.md). |

## Environment variables summary

| Var | Purpose |
| --- | --- |
| `SMOKE_BASE_URL` | Override `baseUrl` at runtime (per-environment CI). |
| `SMOKE_SLACK_WEBHOOK` | Slack webhook URL. |
| `SMOKE_CP_USERNAME` / `SMOKE_CP_PASSWORD` | Optional authenticated CP check. |
| `CI` | Set by CI; enables retries and forbids `test.only`. |
