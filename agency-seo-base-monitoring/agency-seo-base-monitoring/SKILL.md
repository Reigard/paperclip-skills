---
name: agency-seo-base-monitoring
description: >-
  Read-only Tier 1 SEO baseline for a Support run. Resolves the SEO URL list
  from the routine (SEO scope, then multi-page scope, then the main site URL),
  runs seo-baseline, and writes findings/seo-baseline.json for the ingest
  collection seo. Not a deep site analysis. Does not use the frontend crawl
  manifest.
---

# Agency SEO base monitoring

_version: 1.0 · updated: 2026-09-25_

Basic SEO baseline for **SEO Baseline Agent**. Indexability, canonicals, titles, headings, sitemap presence, and a light CWV snapshot when the runner includes it. Not a content strategy audit, not a full-site render, and not `frontend-audit`.

Canonical JSON shape: [references/contract.md](references/contract.md).

## Who owns what

| Role | Owns |
| --- | --- |
| **Maintenance Orchestrator** | Scope, child issue, rollup, copying this file onto ingest key `seo`, **`dit-ingest-diff`**, **`al-push-result`** |
| **SEO Baseline Agent** | URL resolution, `seo-baseline` runner, `findings/seo-baseline.json`, `reports/seo-baseline.html` |
| **Front-end / Browser Health Agent** | Does not read or write this check |

Do **not** attach `al-parse-command`, `al-push-result`, `dit-ingest-diff`, `frontend-site-crawl`, or `frontend-audit`.

## Inputs

Required on the child issue: `client_slug`, `project_slug`, `environment`, check `seo-baseline`, Paperclip child issue, orchestrator task folder, and a public production URL.

If the client, project, or environment is missing, **block** and ask one question. Do not guess a host. Do not read a skill-local `.env`.

## URL scope (priority)

Resolve **only** the list this check will audit. Do not open `artifacts/frontend-crawl-manifest.json`. Do not copy the browser child's homepage-only `scope` when a wider list exists above it.

1. **SEO scope** on the routine or child: `seo.scope` / `seo.priority_urls` / `seo.limits`. If `seo.scope.rules` includes `site_discovery`, expand the sitemap over HTTP and cap at `seo.limits.max_pages` (default **15**). This is a sample, not every URL on the host.
2. **Multi-page site scope** on the routine payload (not the single-URL browser block): `scope.priority_urls` or `scope.rules` whose include targets resolve to **more than one** URL.
3. **Main site URL** — the routine production URL (one page).

Write the chosen list and which step won into `seo.scope_source`: `seo_scope` | `site_pages` | `main_url`. If step 1 names `site_discovery` and the sitemap is missing, fall through to step 3 and set `scope_source` to `main_url` with a finding `seo.sitemap:missing` (`follow_up: true`). Do not invent URLs.

## Runner

Read-only. Never write to the client site. Never print secrets.

```bash
seo-baseline run --client <client_slug>
```

| Child asks | Command |
| --- | --- |
| `seo-baseline` (default) | `seo-baseline run --client <client_slug>` |
| `seo-baseline-no-cwv` | add `--skip cwv` |
| `seo-baseline-cwv-only` | add `--only cwv` |

Pass only the resolved URL list. Do not pass the browser homepage list beside it. Map runner **WARN** to `"verdict": "warn"` and `"status": "completed"`. WARN is review-needed, not a failed run. A runner failure or unreachable host is `status: blocked`, not `warn`.

## Outputs

Write only:

```txt
<task-folder>/findings/seo-baseline.json
<task-folder>/reports/seo-baseline.html
<task-folder>/artifacts/seo-baseline/
```

Do not write `findings.json`, `final-report.html`, `slack-summary.txt`, or `artifacts/frontend-crawl-manifest.json`.

`findings/seo-baseline.json` is the object the parent copies onto ingest **`seo`**. Keep findings inside `seo.findings` (stable `seo.*` ids). Do not emit those ids on a top-level `findings[]` array in this file.

Publish HTML and JSON with `paperclip-publish-artifact`, then copy the HTTPS URLs into `report_url` and `report_json_url` before `done`. HTML is the primary work product. Do not mark `done` if publish failed.

## Do not

- Treat this as a deep crawl, link-equity study, or content audit
- Follow the front child's `max_pages: 1` homepage rule when SEO scope or a multi-page list exists
- Reuse `front.*` finding ids (`front.seo:crawlable`, `front.lcp:*`)
- Stamp `weeks_observed` (that is **`dit-ingest-diff`** on the parent)
