# The Maintenance Promise

The maintenance is the product. This page defines it precisely — what is
committed, what is deliberately not, and which configurations are in scope at
v1.0. These are commitments that can be kept on roughly one day a week, so they
are stated conservatively and honestly.

## Committed

- **Verified against every new Craft GA minor release within 14 days**, with a
  [changelog](CHANGELOG.md) entry either confirming compatibility or shipping the
  fixes required.
- **Playwright and dependency updates at least quarterly.**
- **Security-relevant dependency patches as needed.**
- **Breaking changes in the suite are announced in the changelog with migration
  notes** (and bump the major version — see the versioning section below).

## Explicitly not committed

Saying this in writing is what keeps the suite maintainable:

- **No custom test development for individual member sites.** Writing the tests
  specific to your templates and flows is yours — see
  [writing-your-own](docs/writing-your-own.md).
- **No debugging of member-specific CI environments** beyond the documented
  platforms.
- **Unsupported configurations are roadmap items, not obligations.**

## Supported configurations at v1.0

- Single-site Craft installs, **versions 3 through 6**, with standard front-end
  login patterns.
- **GitHub Actions** as the CI runner.
- Deploy triggers: **Servd, Buddy, Forge, DeployHQ, and custom script** — the
  five debugged in the course.

## Documented as unsupported at launch

These are roadmap candidates, not commitments:

- Multi-site installs
- Headless / decoupled front ends
- GitLab CI / Bitbucket Pipelines
- SSO or custom control-panel authentication

## Versioning

The suite follows [semver](https://semver.org/), **decoupled from Craft's
version numbers** — there is no "Smoke Suite 5.x for Craft 5". A compatibility
matrix (top of the [README](README.md)) communicates Craft support instead.

- **MAJOR** — breaking changes to `smoke.config.js` format, or required
  Node/Playwright version bumps.
- **MINOR** — new tests, new CI/trigger integrations, new config options.
- **PATCH** — fixes, Playwright bumps, compatibility updates for new Craft
  releases.

## Reporting a break

Members don't have repo access, so there are no GitHub Issues. Use the support
form on the suite's member page and pick the right category — **bug in the
suite**, **compatibility report**, or **roadmap request**. Reported bugs that get
fixed become entries on the public changelog.

Include: the failing test name, the full error output, your `smoke.config.js`
(redact secrets), your Node version, and whether it's local or CI. The common
first-wave failures are already answered in
[troubleshooting](docs/troubleshooting.md) — check there first.
