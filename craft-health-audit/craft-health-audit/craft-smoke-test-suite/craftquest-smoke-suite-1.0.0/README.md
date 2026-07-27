# CraftQuest Smoke Suite

**The maintained smoke testing suite for Craft CMS.**

A complete, plug-and-play Playwright smoke test suite for Craft CMS, maintained
against current Craft releases, with CI and deploy-platform integrations already
debugged.

Point it at your site, edit **one file**, wire it to your deploy, and get pinged
in Slack the moment something breaks. It answers the question you actually care
about after every deploy: *"Is the site up, rendering, and not throwing
errors?"* — without you having to remember to check.

## Compatibility

| Suite version | Craft versions | Playwright | Node |
| --- | --- | --- | --- |
| 1.x | 3.x, 4.x, 5.x, 6.x | ^1.x | 20+ |

The suite tests your site **from the outside**, so it is not version-locked to
Craft — one line works across Craft 3 through 6. Suite versioning is
[semver, decoupled from Craft](CHANGELOG.md).

## What it is

- **Playwright** under the hood — real Chromium, real page loads.
- **One config file** (`smoke.config.js`) drives every test. Members should
  never need to touch the test files or `playwright.config.js`.
- **Seven focused checks**, each of which you can turn on/off by filling in (or
  leaving empty) its section of the config:
  | Test | What it guards against |
  | --- | --- |
  | `availability` | 5xx, white screens, error text on critical URLs |
  | `templates` | "200 but the layout exploded" |
  | `console` | JS errors that break interactivity |
  | `links` | broken internal links |
  | `seo` | missing title / meta / canonical, unreachable robots & sitemap |
  | `forms` | contact/lead forms that silently stop submitting |
  | `cp` | control panel login down; optional authenticated check |
- **Runs on deploy** (via `repository_dispatch`) or **on a schedule** (cron).
- **Slack notifications** built in.

## 10-minute quickstart

```bash
# 1. Install
npm install
npm run install:browsers

# 2. Point it at your site — edit ONE file
#    Open smoke.config.js and set `baseUrl` and `siteName`.
#    (Or run against any URL without editing: SMOKE_BASE_URL=https://your-site.com)

# 3. Run it
npm test

# 4. See the report
npm run report
```

Your first green run against just the homepage should take well under 10
minutes. Then add your critical paths, templates, and forms one at a time.

Full walkthrough: **[docs/quickstart.md](docs/quickstart.md)**.

## Wire it to your deploy

Pick your platform and follow the copy-paste guide:

- [Servd](ci/triggers/servd.md)
- [Buddy](ci/triggers/buddy.md)
- [Laravel Forge](ci/triggers/forge.md)
- [DeployHQ](ci/triggers/deployhq.md)
- [Any bash deploy](ci/triggers/custom-script.md)

Then copy the workflow you want into `.github/workflows/`:

- `ci/github-actions/smoke-on-deploy.yml` — run after each deploy
- `ci/github-actions/smoke-scheduled.yml` — run on a cron (uptime monitoring)

Slack setup: **[notifications/slack.md](notifications/slack.md)**.

## Supported configurations

Supported at v1.0 (what the maintenance promise covers):

- **Craft CMS**: single-site installs, versions 3 through 6, with standard
  front-end login patterns. The tests only touch the front end + CP login, so
  the Craft version is largely irrelevant.
- **Node**: 20 or newer (uses the built-in `fetch`).
- **CI runner**: GitHub Actions.
- **Deploy triggers**: Servd, Buddy, Forge, DeployHQ, and any custom bash
  deploy — the five debugged in the course.
- **OS** (local runs): macOS, Linux, Windows (Playwright installs its own
  browser).

Documented as **unsupported at launch** (roadmap candidates, not obligations):
multi-site installs, headless/decoupled front ends, GitLab CI / Bitbucket
Pipelines, and SSO / custom CP authentication. See [MAINTENANCE.md](MAINTENANCE.md).

## Documentation

- [Quickstart](docs/quickstart.md) — zero to first green run
- [Configuration](docs/configuration.md) — every `smoke.config.js` option
- [Writing your own tests](docs/writing-your-own.md) — extend for your site
- [Troubleshooting](docs/troubleshooting.md) — the failures everyone hits

## From the course

This is the built, maintained version of the suite you assemble in the CraftQuest
course. The course teaches the *why* behind each test file; this artifact is the
finished thing, kept current so you can skip the assembly. Each spec's header
comments point back to the concept it comes from — read the lessons for the
reasoning, run this for the result.

## License & maintenance

This suite is provided under the [member license](LICENSE.md): active members may
use it on unlimited projects including client work; no redistribution or resale;
code already deployed to client repos keeps working, but **updates require an
active membership**. See the [maintenance promise](MAINTENANCE.md) for exactly
what "maintained" commits to — and what it explicitly does not — plus how to
report a break.
