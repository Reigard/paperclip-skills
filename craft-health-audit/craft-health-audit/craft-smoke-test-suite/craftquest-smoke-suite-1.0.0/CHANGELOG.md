# Changelog

All notable changes to the CraftQuest Smoke Suite are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
— versioned independently of Craft (see [MAINTENANCE.md](MAINTENANCE.md)).

Every entry says **why**, not just what: this changelog is the visible proof
that maintenance is happening.

## [Unreleased]

This section doubles as the public roadmap — what's being considered next.
Unsupported configurations are candidates here, not commitments.

### Considering
- Multi-site install support (currently unsupported — see MAINTENANCE.md).
- GitLab CI / Bitbucket Pipelines trigger guides, so the suite isn't
  GitHub-Actions-only.
- Headless / decoupled front-end coverage.
- Automated release pipeline (tag → build zip → push to member area), replacing
  the manual v1.0 upload.

## [1.0.0] - 2026-07-17

Initial public release of the maintained suite. Shipping at 1.0 (not 0.x)
because this code already ran in the course and in production client work —
0.x would undersell a maintained artifact.

### Added
- `smoke.config.js` — the single file members edit, so the plug-and-play promise
  lives in one annotated place instead of scattered across test files.
- Seven test suites: `availability`, `templates`, `console`, `links`, `seo`,
  `forms`, `cp` — each guarding a distinct "the deploy looked fine but…" failure.
- `playwright.config.js` that reads all its meaningful defaults from
  `smoke.config.js`, so members never touch Playwright directly.
- GitHub Actions workflows: `smoke-on-deploy.yml` (fires on `repository_dispatch`
  from your deploy platform) and `smoke-scheduled.yml` (cron uptime monitoring).
- Copy-paste, pre-debugged deploy triggers for Servd, Buddy, Forge, DeployHQ, and
  any custom bash deploy.
- Slack notifications via `ci/notify.js` and `notifications/slack.md` — included
  in 1.0 rather than held back, since it's already debugged and is a visible
  differentiator.
- Optional authenticated control-panel check in `cp.spec.js`, **off by default**
  and opt-in via CI secrets, so the quickstart stays friction-free.
- Documentation: quickstart (zero-to-green under 10 minutes), full configuration
  reference, writing-your-own, and a troubleshooting guide seeded from the ten
  failures course members actually hit.

[Unreleased]: https://github.com/CraftQuest/craftquest-smoke-suite/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CraftQuest/craftquest-smoke-suite/releases/tag/v1.0.0
