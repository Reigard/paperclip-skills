---
name: frontend-audit
description: Orchestrator for the Front-end / Browser Health Agent — merges sub-skill partials (console, network, CWV, third-party, a11y, regression), sets verdict, writes findings/frontend-audit.json and reports/frontend-audit.html. Requires chrome-devtools-mcp and Browser Health sub-skills. Use with frontend-site-crawl when multi-page scope is needed.
compatibility: "Requires chrome-devtools-mcp and Browser Health sub-skills attached to the agent. See paperclip/agents/frontend-browser-health-agent/AGENT.md."
---

# Frontend Audit (orchestrator)

**Skill id:** `frontend-audit` — **not** the agent name. This skill **orchestrates** the [Front-end / Browser Health Agent](../../../agents/frontend-browser-health-agent/AGENT.md): it does not replace the focused sub-skills.

**Agent:** Front-end / Browser Health Agent — real Chrome via **chrome-devtools-mcp**.

**Load `frontend-site-crawl` first** when the issue requires URLs beyond a single page.

## Sub-skills (run via this orchestrator)

| Skill | Partial file |
| --- | --- |
| `frontend-browser-console` | `partials/frontend-browser-console.json` |
| `frontend-network-health` | `partials/frontend-network-health.json` |
| `frontend-performance-cwv` | `partials/frontend-performance-cwv.json` |
| `frontend-third-party-scripts` | `partials/frontend-third-party-scripts.json` |
| `frontend-accessibility-audit` | `partials/frontend-accessibility-audit.json` |
| `frontend-deploy-regression` | `partials/frontend-deploy-regression.json` |

MCP workflow: [references/chrome-devtools-mcp.md](references/chrome-devtools-mcp.md). Partial schema: [references/partial-contract.md](references/partial-contract.md). Merged output: [references/contract.md](references/contract.md).

## When to use

- Maintenance check `frontend-audit` or post-deploy browser health smoke
- All Browser Health sub-skills are attached to the agent

Read-only — no form submits, load tests, or destructive actions.

## Core rule

Browser health is a gate. Missing MCP, unreachable target, or material defects → `FAIL` or `BLOCKED`. Never `PASS with gaps`.

Verdicts: `PASS`, `FAIL`, `BLOCKED`, `PARTIAL` (issue explicitly scopes partial only).

## Procedure

### 0) Resolve pages

1. `artifacts/frontend-crawl-manifest.json` → use `pages[]`; copy `scope` and discovery MCP settings into merged JSON
2. Bootstrap browser session using routine **`mcp.audit`** (not discovery MCP) — see [chrome-devtools-mcp.md](references/chrome-devtools-mcp.md)
3. Else resolve scope with the same flexible parser as `frontend-site-crawl`
4. Ambiguous scope → `BLOCKED`

Audit **only** URLs in manifest `pages[]`. Discovery MCP (`mcp.discovery`) is not used in this step.

### 1) Bootstrap chrome-devtools-mcp

Follow [chrome-devtools-mcp.md § Session bootstrap](references/chrome-devtools-mcp.md#session-bootstrap-once-per-audit-run).

If no MCP → `BLOCKED`, write minimal JSON with `tooling.browser_tool_available: false`, stop.

### 2) Per-page loop

For each URL in scope:

1. **Desktop viewport** — `emulate` → `navigate_page` → run sub-skills in order:
   - `frontend-browser-console`
   - `frontend-network-health`
   - `frontend-performance-cwv` (trace with reload on desktop)
   - `frontend-third-party-scripts`
   - `frontend-accessibility-audit`
   - `take_screenshot` → `artifacts/frontend-audit/<slug>-desktop.png`
2. **Mobile viewport** — `emulate` → `navigate_page` (same URL) → repeat console, network, third-party, a11y; performance trace optional; screenshot → `<slug>-mobile.png`
3. Gate: 404, login, 5xx on primary content → page `status: "blocked"`, findings, continue other URLs

Each sub-skill writes its partial JSON under `artifacts/frontend-audit/partials/`.

### 3) Regression pass

After all pages audited, run **`frontend-deploy-regression`** once (loads prior `findings/frontend-audit.json` baseline if available). Writes `partials/frontend-deploy-regression.json`.

### 4) Merge partials

Build merged structure for **`findings/frontend-audit.json`** (ingest shape — see `paperclip-dit-monitoring` [schema.md](../../paperclip-dit-monitoring/paperclip-dit-monitoring/references/schema.md)):

**Per page (`pages[]`)** — merge by URL from partials:

| Partial | Fields merged into `pages[]` |
| --- | --- |
| `frontend-browser-console` | `console_error_count`, `console_errors[]` |
| `frontend-network-health` | `failed_request_count`, `failed_requests[]`, `broken_image_count`, `broken_images[]` |
| `frontend-performance-cwv` | `core_web_vitals` (incl. `tbt_ms` when captured), `performance` |
| `frontend-third-party-scripts` | `third_party_scripts[]` |
| `frontend-accessibility-audit` | `accessibility` |

Also set page-level `url`, `final_url`, `http_status`, `title`, `status`, `blocked_reason`, screenshot artifact URLs from the orchestrator loop.

**Summary (`summary`)** — aggregate:

- `console_error_pages`, `failed_request_pages`, `broken_image_pages`, `poor_cwv_pages` — count pages with issues from merged pages
- `third_party_issue_pages` — pages where any `third_party_scripts[].status` is not `ok` / `allowed`
- `accessibility_issue_pages` — pages where `accessibility.issues[]` is non-empty
- `regression_count` — length of `baseline_comparison.regressions[]` (or `0` when unavailable)
- `critical_findings`, `high_findings`, `warning_findings`, `red_flags` — from merged `findings[]`

**Root fields:**

- `findings[]` — union all partial findings; dedupe by `title` + `page_url`
- `baseline_comparison` — from `frontend-deploy-regression` partial only; omit when sub-skill blocked/skipped
- `human_verification[]` — union orchestrator checklist + partial items
- `tooling` — from session bootstrap (`browser_tool`, `browser_tool_available`, `lighthouse_available` only — never Figma)
- `verdict` — worst partial verdict + red-flag rules

Omit keys when a sub-skill did not run, was blocked, or produced empty data — do not send null placeholders.

**Red flags** on important pages: JS console error; CWV degradation vs baseline; HTTP 5xx; public page behind login.

Write **`findings/frontend-audit.json`** before HTML. The merged file is the **only** correct source for DIT `frontend_audit` ingest — it must keep `pages[]`, `summary{}`, `findings[]`, `human_verification[]`, and `tooling` (when produced). Do **not** replace it with a compact rollup-style stub (`core_web_vitals_lab` / top-level Lighthouse scores without `pages[]`). Compact summaries belong in parent rollup `findings.json` only (orchestrator-owned).

### 5) HTML report

Self-contained `reports/frontend-audit.html` — header, summary, tooling, baseline, pages table, screenshots, findings, human verification. Template: [references/examples.md](references/examples.md).

### 6) Publish and close

```bash
paperclip-publish-artifact \
  --issue <child-issue> \
  --file <task-folder>/reports/frontend-audit.html \
  --label "Frontend Audit" \
  --summary "<one line>"
paperclip-update-issue-status --issue <child-issue> --status done
```

## Output contract

```txt
<task-folder>/findings/frontend-audit.json
<task-folder>/reports/frontend-audit.html
<task-folder>/artifacts/frontend-audit/
<task-folder>/artifacts/frontend-audit/partials/*.json
```

## Human verification (mandatory in HTML)

Forms/CRM, checkout, analytics firing, cookie consent, interactive widgets — assign Owner/Due. No Figma sign-off (use `agency-visual-qa`).

## Related

- **Agent overview:** [frontend-browser-health-agent/AGENT.md](../../../agents/frontend-browser-health-agent/AGENT.md)
- **`frontend-site-crawl`** — URL scope
- **`paperclip-dit-monitoring`** — DIT ingest mapping
- **`agency-visual-qa`** — visual/design (separate agent)
