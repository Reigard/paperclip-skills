---
name: agency-visual-qa
description: Run fail-closed Agency OS visual QA for Paperclip frontend, WordPress, Figma-to-code, screenshot comparison, responsive browser QA, image/media checks, and review evidence. Use when checking whether an implementation matches a request, Figma design, preview runtime, staging URL, or production URL.
---

# Agency Visual QA

Use this skill when QA must verify a Paperclip/frontend task with screenshots, Figma references, browser evidence, responsive views, or image/media expectations.

## Core Rule

QA is a gate, not a summary. If the target page, environment, screenshot, Figma reference, or acceptance criteria cannot be verified, return `BLOCKED` or `FAIL`. Do not pass with unresolved visual gaps.

Allowed verdicts:

- `PASS`: all acceptance criteria and design-critical requirements pass for the checked mode.
- `FAIL`: the page is reachable/testable but does not satisfy the request or design.
- `BLOCKED`: the target, credentials, URL, runtime, design reference, or current evidence is unavailable.
- `PARTIAL`: only when the issue explicitly requests a partial check.

Never use `PASS with gaps`, `PASS pending`, or `probably passed`.

## Exercise The Actual Behavior

A screenshot of the default page load does not verify a fix to interactive or state-dependent behavior. Verify the actual thing the ticket changed, in the state where it appears:

- If the fix is a sort, filter, toggle, tab, search, pagination, or form, **trigger that interaction** (click the control, submit the input) and verify the result. Do not pass on the initial render alone.
- Server-rendered and client-side (JS) code paths can diverge. Confirm the behavior in **every path the ticket touches** (e.g. both the initial query order AND the on-click re-sort), not just one.
- Capture evidence of the **post-interaction** state. If the interaction cannot be exercised in the available environment, the verdict is `BLOCKED`, never `PASS`.

## Target Resolution

Before taking screenshots:

1. Identify the requested environment: preview runtime, staging/dev, or production.
2. Identify the exact target URL or page path from the issue.
3. Identify the exact Figma node when a Figma link is present.
4. If the issue does not name the target URL/page, block for clarification. Do not infer a URL from a Figma heading or section title.
5. If the page title, final URL, or visible content shows a 404, password gate, login page, wrong page, or stale route, the verdict is `BLOCKED` or `FAIL`.

## Screenshot Evidence

Use Chromium/Playwright screenshots through the Agency OS helper when available:

```bash
paperclip-qa-visual-check \
  --issue <ISSUE-ID> \
  --client-slug <client> \
  --project-slug <project> \
  --env <dev|staging|prod> \
  --url <path-or-url> \
  --viewports 1440x1100,390x844 \
  --out-dir <task-report-dir>
```

For server-local WordPress QA before deployment, prefer preview runtime:

```bash
paperclip-qa-visual-check \
  --issue <ISSUE-ID> \
  --client-slug <client> \
  --project-slug <project> \
  --env staging \
  --url <path> \
  --viewports 1440x1100,390x844 \
  --preview-runtime \
  --out-dir <task-report-dir>
```

Evidence must be current. If an earlier artifact showed a wrong page or 404 and a later artifact corrected it, label the earlier artifact as superseded and do not use it as approval evidence.

## Image And Media Rules

Classify images/media before deciding pass/fail:

- **Exact required media**: If the issue or Figma requires a specific image, illustration, crop, icon, logo, or media placement, it must match or fail.
- **Representative media**: Different image content may pass only if the issue explicitly allows representative media or CMS population later. Flag the difference in the report.
- **Environment content drift**: Different images between local, staging, and production may be acceptable when the code is correct and the task does not require exact media parity. Flag the source environment and the mismatch.
- **Missing design-critical media**: A blank area, placeholder, fallback image, missing image column, missing arched image treatment, broken image, or absent icon shown in Figma is a failure unless explicitly scoped out.
- **Generated or selectable image options**: If the task asks for options, QA verifies that options are reviewable and labeled; it does not choose silently.

If media is intentionally deferred, the implementation agent must create or reference a follow-up issue before QA passes the parent.

## Figma Comparison

When a Figma link exists:

1. Capture or inspect the target Figma node.
2. Capture implementation screenshots at desktop and mobile viewports.
3. Compare layout, section order, spacing, typography, color, imagery, CTA presence, responsive behavior, and state.
4. Report material mismatches. Do not call visible Figma mismatches "content gaps" unless the ticket explicitly says media/content is separate.

Figma is the visual target. Existing project code patterns are the implementation target. QA should flag unnecessary class bloat or avoidable new component patterns separately from visual fidelity.

## WordPress Visual QA

When the target is a WordPress site, run these additional checks as part of the browser pass:

### WP Version Disclosure

```bash
curl -s <site-url>/ | grep -i 'meta name="generator"'
```

- `<meta name="generator" content="WordPress X.X.X">` found in page source → flag as `warning` in the QA report.
- Not present → OK.

Also check `/?v=` asset versioning in stylesheet/script URLs — if WP version is readable from asset query strings, flag as `warning`.

### Uploads Directory Listing

```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/wp-content/uploads/
```

- HTTP 200 with a directory listing page → verdict contribution: `FAIL` (high severity, security exposure).
- HTTP 403 → OK.

### Lighthouse Score Thresholds

When `lighthouse_audit` is available, apply these minimum thresholds for WordPress sites:

| Category | Minimum passing score |
|---|---|
| SEO | 80 |
| Accessibility | 70 |
| Best Practices | 75 |
| Performance | 50 (lab; flag < 50 as `high`) |

Scores below the threshold contribute to a `FAIL` verdict unless the issue scope explicitly excludes that category.

### Core Web Vitals (lab proxy)

When a performance trace is available, use these thresholds:

| Metric | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | < 2.5s | 2.5s – 4.0s | > 4.0s |
| CLS | < 0.1 | 0.1 – 0.25 | > 0.25 |
| INP | < 200ms | 200ms – 500ms | > 500ms |

Label the source as `lab_trace` (Chrome DevTools MCP) or `lighthouse_lab`. Do not report a metric without its source.

### Admin Path Exposure

Check that WordPress admin is not publicly accessible without auth:

```bash
curl -o /dev/null -s -w "%{http_code}" <site-url>/wp-admin/
```

- HTTP 302 redirect to login → OK (expected).
- HTTP 200 without a login page → flag as `critical`, `red_flag: true`.
- HTTP 403 → OK (extra protection layer).

### WordPress QA Hard Gates

If any of the following are found, the verdict cannot be `PASS`:

- WP version visible in `<meta generator>` (contribute to verdict as `FAIL` only if the issue scope includes security hardening)
- `/wp-content/uploads/` returns directory listing
- `/wp-admin/` returns 200 without a login challenge
- Lighthouse SEO score < 80 (unless explicitly scoped out)

## Required Report Shape

Every visual QA report should include:

```txt
Verdict: PASS | FAIL | BLOCKED | PARTIAL

Target
- Issue:
- Requested URL/path:
- Final URL observed:
- Environment:
- Branch/ref/commit, if known:
- Figma node, if applicable:

Evidence
- Figma reference artifact/link:
- Desktop implementation screenshot:
- Mobile implementation screenshot:
- Report artifact:

Hard Gates
- Correct page reached:
- No 404/login/password gate:
- Evidence is current:
- Requested placement/section order verified:
- Desktop and mobile checked:

WordPress Hard Gates (when target is WordPress)
- WP version NOT exposed in <meta generator>:
- /wp-content/uploads/ directory listing blocked (403):
- /wp-admin/ redirects to login (302) or is gated (403):
- Lighthouse SEO score >= 80:

Visual Comparison
- Layout:
- Spacing:
- Typography:
- Color:
- Interaction/animation, if applicable:

Image And Media Comparison
- Expected media:
- Observed media:
- Difference classification:
- Required follow-up, if any:

Implementation Discipline
- Existing patterns reused:
- New classes/components justified:
- Leaf-node class bloat found:

Recommendation
- Next owner:
- Fix required before deploy/review:
```

If any hard gate fails, the verdict cannot be `PASS`.
