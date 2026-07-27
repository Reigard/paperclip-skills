# Troubleshooting

The failures everyone hits, in roughly the order people hit them. Each has the
symptom, the cause, and the fix.

## 1. `availability: / returned 301/302`

**Symptom:** the homepage "fails" with a redirect status.
**Cause:** your `baseUrl` redirects (http→https, non-www→www, or a trailing
slash rule).
**Fix:** set `baseUrl` to the *canonical* URL your site actually serves — the
one with no redirect. Check with `curl -I https://your-site.com`. If the final
URL is `https://www.your-site.com/`, use that.

## 2. `cp: login page loads` fails with 404

**Symptom:** the control panel test can't find the login page.
**Cause:** your `cpTrigger` isn't `admin`, or the CP is on a subdomain.
**Fix:** set `cp.loginPath` to match your Craft config. If `cpTrigger` is
`cp`, use `/cp/login`. If the CP is on `cms.your-site.com`, either run a
separate config against that host or set `SMOKE_BASE_URL` for the CP run.

## 3. `seo: sitemap is reachable` fails

**Symptom:** sitemap returns 404.
**Cause:** Craft has no sitemap by default — it comes from a plugin
(SEOmatic, `craft-sitemap`, etc.), each with its own URL.
**Fix:** set `seo.sitemapPath` to your plugin's actual sitemap URL (SEOmatic is
often `/sitemaps-1-sitemap.xml`). No sitemap plugin? Remove the check by pointing
it at a URL you know 200s, or accept the skip.

## 4. `console: / has no JS errors` fails on third-party noise

**Symptom:** failures from Google Maps, analytics, chat widgets, or
`favicon.ico`.
**Cause:** third-party scripts log errors you don't control.
**Fix:** add a substring to `console.ignore` in `smoke.config.js`. Keep it
specific (`'Google Maps JavaScript API'`), not broad. Don't ignore errors coming
from your own JS — fix those.

## 5. `links` fails on links that work in a browser

**Symptom:** a link reports 403 or 405 but loads fine when you click it.
**Cause:** some servers/CDNs block `HEAD` requests or bot-like user agents, or
the link requires a session.
**Fix:** the test already falls back from `HEAD` to `GET` on 405/501. For 403
from a CDN, add the link (or a path fragment) to `links.ignore`. For
auth-gated links, ignore them — smoke tests run anonymously.

## 6. Forms test creates real submissions / emails

**Symptom:** running the suite floods an inbox or CRM.
**Cause:** the form test genuinely submits the form.
**Fix:** point `forms[].path` at **staging**, or use a form that routes test
submissions somewhere harmless. Make `successText` match a string that appears
*only* on success so a validation error doesn't read as a pass.

## 7. Everything passes locally, fails on CI right after deploy

**Symptom:** green locally, red in the on-deploy run, green if you re-run.
**Cause:** the CDN/edge cache is still warming, or the deploy platform fired the
trigger before the new release was live.
**Fix:** `retries` is already `1` on CI to absorb this. If it persists, add a
short delay before the dispatch in your deploy trigger, or increase
`timeouts.action`. Confirm your platform triggers *after* the release is
promoted, not at build time.

## 8. `Executable doesn't exist` / browser not installed

**Symptom:** Playwright complains the Chromium binary is missing.
**Cause:** browsers weren't installed.
**Fix:** run `npm run install:browsers`. On CI the workflow already does this;
if you customized it, ensure `playwright install --with-deps chromium` runs
before `npm test`.

## 9. Slack notification never arrives

**Symptom:** runs go red but no Slack message.
**Causes & fixes:**
- `notify: no Slack webhook configured` — the `SMOKE_SLACK_WEBHOOK` secret isn't
  set in the repo. Add it (see [slack.md](../notifications/slack.md)).
- Message on success expected but `notifyOn` is `'failure'` — set it to
  `'always'`.
- Slack returns 403/404 — the webhook was revoked or mistyped; regenerate it.
- The notify step didn't run — confirm the workflow has the
  `if: failure()` notify step and that `npm test` actually failed (a skipped
  suite is not a failure).

## 10. `repository_dispatch` fires but no workflow runs

**Symptom:** your deploy curl returns `204` but nothing shows in Actions.
**Causes & fixes:**
- The workflow file must be on the repo's **default branch** for
  `repository_dispatch` to trigger it. Merge it to `main`.
- `event_type` in your curl must match `types: [site-deployed]` in the workflow.
- The token lacks the scope to dispatch — a fine-grained token needs
  **Contents** and **Actions** read/write on that repo.
- You're looking at the wrong repo — dispatch targets the repo in the curl URL,
  which should be the **smoke suite** repo, not your site's repo.

---

### Still stuck?

See the [maintenance promise](../MAINTENANCE.md) for how to report a break.
Include the failing test name, the full error output, your `smoke.config.js`
(redact secrets), your Node version, and whether it's local or CI.
