---
name: frontend-audit
description: Run browser-based frontend audit for one or more pages — console errors, failed requests, broken images, desktop/mobile screenshots, Core Web Vitals (lab). Optional Figma comparison when Figma MCP is available. Produces findings/frontend-audit.json and reports/frontend-audit.html. Use with frontend-site-crawl when multi-page scope is required. Read-only — no writes to the site.
compatibility: "Requires a browser tool (Chrome DevTools MCP, Playwright, or paperclip-qa-visual-check). Figma comparison is optional."
---

# Frontend Audit

Browser QA gate for frontend health. Audits the page(s) resolved by the issue or by `frontend-site-crawl`.

**Load `frontend-site-crawl` first** when the issue requires discovering URLs beyond a single page.

## When to use

- Maintenance check `frontend-audit` or `frontend-basic` extended audit
- Post-deploy smoke on a URL or crawl set
- Issue asks for console/network/screenshot/CWV evidence

This skill is **read-only**. No form submits, no load tests, no destructive actions.

## Core rule

QA is a gate. If the target is unreachable, tooling is missing for required checks, or material defects exist, return `FAIL` or `BLOCKED`. Never `PASS with gaps`.

Allowed verdicts: `PASS`, `FAIL`, `BLOCKED`, `PARTIAL` (only when issue explicitly scopes partial).

## Inputs required

| Input | Source |
|---|---|
| Target URL(s) | Issue body **or** `artifacts/frontend-crawl-manifest.json` |
| Environment | `development`, `staging`, or `production` |
| Issue id | Paperclip child issue |
| Crawl scope | Resolved by `frontend-site-crawl` or issue text (see linked skill) |
| Figma URL + node | Optional — only when issue includes design reference |

Out-of-scope domains must not be audited. If the issue names one environment/URL, do not flag other environments.

## Procedure

### 0) Resolve pages to audit

1. If `artifacts/frontend-crawl-manifest.json` exists → use its `pages[]` list and `scope.mode`.
2. Else run scope resolution from issue text (same rules as `frontend-site-crawl` § Scope resolution) for a single seed URL.
3. If scope is ambiguous (e.g. "check the site" with no crawl keyword) → `BLOCKED`, request clarification.

Default viewports: `1440x1100` (desktop), `390x844` (mobile).

### 1) Verify browser tooling

Preferred order:

1. **Chrome DevTools MCP** — console, network, performance trace, emulation
2. **`paperclip-qa-visual-check`** — Playwright screenshots + basic pass
3. **Playwright / browser-mcp** — if available

If no browser tool is available → entire check `BLOCKED`. Record in `tooling.browser_tool_available: false`.

Lighthouse is optional enrichment when `lighthouse_audit` or DevTools Lighthouse tools exist.

### 2) Per-page audit loop

For each URL in scope:

1. Navigate and record `final_url`, HTTP status, page title.
2. Hard gate: 404, login page, password gate, wrong domain → mark page `blocked`, add finding, continue other pages if any.
3. Capture **desktop + mobile** screenshots → save under `artifacts/frontend-audit/`.
4. Collect **console errors** (level `error`; include `warning` as `info` findings).
5. Collect **failed network requests** (4xx/5xx on document, script, stylesheet, image, font).
6. Detect **broken images** (`naturalWidth === 0` or failed image requests).
7. Capture **Core Web Vitals proxy** (lab):
   - LCP, CLS, INP when trace available
   - Label source: `lab_trace` (Chrome DevTools MCP) or `lighthouse_lab`
   - Never report field/CrUX data without explicit field source
8. Do **not** submit forms, add to cart, or run load tests unless a different skill scopes that.

CWV thresholds (lab):

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | < 2.5s | 2.5s – 4.0s | > 4.0s |
| CLS | < 0.1 | 0.1 – 0.25 | > 0.25 |
| INP | < 200ms | 200ms – 500ms | > 500ms |

Poor CWV on production → `high` finding; on dev/staging → `warning` unless issue scopes performance out.

### 3) Optional Figma comparison (not required)

Run **only when all** are true:

1. Issue includes a Figma design URL and (preferably) node id.
2. Figma MCP or equivalent is available in the agent session (`get_design_context`, `get_screenshot`, etc.).

If Figma URL present but MCP unavailable:

- Set `figma_comparison.status: "skipped"`
- Set `skip_reason: "Figma MCP not available"`
- **Do not** fail the audit for missing Figma tooling.

When Figma comparison runs:

1. Capture Figma node screenshot or design context.
2. Compare implementation screenshots (desktop + mobile) against Figma for layout, spacing, typography, color, imagery, CTA presence.
3. Record mismatches in `figma_comparison.mismatches[]`:

```json
{
  "area": "hero spacing",
  "expected": "64px padding per Figma",
  "observed": "~24px on implementation",
  "severity": "warning"
}
```

Material Figma mismatches → `warning` or `high` findings with `category: "frontend"`. Missing Figma MCP → skip section only.

### 4) Build findings JSON

Write `findings/frontend-audit.json` **before** HTML.

Full schema, field definitions, and verdict rules: [references/contract.md](references/contract.md).

Filled examples: [references/examples.md](references/examples.md).

Each finding object:

```json
{
  "severity": "critical | high | warning | info",
  "category": "frontend",
  "title": "<short title>",
  "evidence": "<what you observed>",
  "recommendation": "<action>",
  "owner": "dev | client | agency",
  "follow_up": true,
  "red_flag": false,
  "page_url": "<url or null>",
  "source": "chrome-devtools-mcp | paperclip-qa-visual-check | playwright | curl",
  "evidence_type": "browser-smoke | screenshot | performance-trace | http"
}
```

**Red flags** (`red_flag: true`):

- Login/password gate on a page that should be public
- HTTP 5xx on primary content page
- Poor CWV (lab) on production homepage when performance is in scope

Do **not** red-flag: uptime checks, staging-only content drift, skipped Figma comparison.

### 5) Build HTML report

Write self-contained `reports/frontend-audit.html` with sections:

1. **Header** — verdict, issue, environment, seed URL, scope mode, pages audited/blocked
2. **Summary table** — error counts, CWV pages, finding severities
3. **Tooling** — browser tool used, Lighthouse, Figma MCP status
4. **Pages table** — per URL: status, HTTP, console count, failed requests, CWV
5. **Screenshots** — desktop + mobile per page (relative paths)
6. **Findings table** — severity-colored rows
7. **Figma comparison** — results or skip reason
8. **Human verification** — mandatory checklist (see below)

HTML template and filled example: [references/examples.md](references/examples.md).

### 6) Publish and close

```bash
paperclip-publish-artifact \
  --issue <child-issue> \
  --file <task-folder>/reports/frontend-audit.html \
  --label "Frontend Audit" \
  --summary "<one line, e.g. '4/5 pages PASS, 1 console error on /about/'>"
```

Then:

```bash
paperclip-update-issue-status --issue <child-issue> --status done
```

Child is not complete until published artifact + `done` status exist.

## Output contract

```txt
<task-folder>/findings/frontend-audit.json
<task-folder>/reports/frontend-audit.html
<task-folder>/artifacts/frontend-audit/*.png   ← screenshots
```

Do not write rollup files (`findings.json`, `final-report.html`) — Maintenance Orchestrator owns those.

## Human verification (mandatory in HTML)

Append `## ⚠️ Human Verification Required` with assignable items:

- Visual design approved by client?
- Forms submit to correct CRM/email?
- Checkout/payment flow tested (if applicable)?
- Analytics (GA4/GTM) firing?
- Cookie consent correct for jurisdiction?
- Interactive features (sliders, maps, video) manually verified?

Each item: `Owner:` and `Due:` fields.

## Severity guide

| Severity | When |
|---|---|
| `critical` | 5xx on public page; auth wall on page that must be public |
| `high` | Console errors affecting UX; failed critical assets; poor CWV on prod |
| `warning` | Non-critical console warnings; 404 on secondary asset; poor CWV on dev |
| `info` | Clean pass evidence; expected staging behaviour |

## CLI fallback (when MCP unavailable)

```bash
paperclip-qa-visual-check \
  --issue <ISSUE-ID> \
  --client-slug <client> \
  --project-slug <project> \
  --env <dev|staging|prod> \
  --url <path-or-url> \
  --viewports 1440x1100,390x844 \
  --out-dir <task-folder>/artifacts/frontend-audit
```

Use CLI output for screenshots; supplement with `curl` for HTTP status only. If CLI cannot capture console/network → mark those checks `blocked` in JSON, do not invent errors.

## Related skills

- **`frontend-site-crawl`** — discover URLs and write `frontend-crawl-manifest.json`
- **`agency-visual-qa`** — task-level visual QA gate with stricter Figma requirements
- **`ecommerce-visual-qa`** — transactional flows (cart, checkout)

## Schedule / routine trigger

```json
{
  "client_slug": "<client>",
  "project_slug": "<project>",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "crawl_scope": "single_page"
}
```

When routine includes only homepage with no crawl keywords → run `frontend-audit` alone with `single_page` scope.
