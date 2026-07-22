---
name: frontend-site-crawl
description: Resolve frontend audit URL scope from a seed link and issue instructions — single page, full site crawl, or child pages only. Writes artifacts/frontend-crawl-manifest.json for frontend-audit. Use when the issue may require more than one page, or when crawl scope must be explicit before browser QA runs.
compatibility: "Requires HTTP access to seed URL. Browser MCP optional for nav link discovery. Pairs with frontend-audit."
---

# Frontend Site Crawl

Determines **which URLs** `frontend-audit` should check. Does not perform console/network/screenshot QA — that is `frontend-audit`.

## When to use

- Issue may cover multiple pages
- Routine includes `frontend-site-crawl` before `frontend-audit`
- Need explicit crawl vs single-page decision recorded in manifest

**Skip this skill** when issue clearly states one URL and no crawl — `frontend-audit` can resolve `single_page` alone.

## Core rule

Scope must be **explicit or safely defaulted**. Ambiguous instructions → `BLOCKED`, no manifest. Never crawl out-of-scope domains or auth-gated areas without credentials.

## Inputs required

| Input | Description |
|---|---|
| `seed_url` | URL from issue (homepage or inner page) |
| `environment` | `development`, `staging`, or `production` |
| Issue text | Crawl keywords, prohibitions, child-page requests |
| Issue id | Paperclip child issue |

## Scope resolution

Apply the decision table in [references/contract.md](references/contract.md) § Scope resolution decision table.

Summary:

| Situation | Default |
|---|---|
| Homepage, no crawl mention | `single_page` |
| Homepage + explicit crawl request | `site_crawl` |
| Homepage + explicit no-crawl | `single_page` |
| Inner page, no child mention | `single_page` (that URL only) |
| Inner page + "child pages" / "subpages" | `child_pages_only` |
| Ambiguous "check the site" | `BLOCKED` |

**Keyword hints (non-exhaustive):**

- Crawl **on:** `crawl`, `all pages`, `site-wide`, `обход`, `проход по страницам`, `все страницы`
- Crawl **off:** `homepage only`, `single page`, `do not crawl`, `без обхода`, `только главная`
- **Child pages:** `child pages`, `subpages`, `descendants`, `under /path/`, `дочерние страницы`

Explicit instruction always overrides default.

## Procedure

### 1) Parse scope from issue

Record in manifest `scope.mode`, `scope.mode_source`, `scope.crawl_allowed`, `scope.crawl_instruction`.

If `BLOCKED` → write `findings/frontend-site-crawl.json` with verdict `BLOCKED`, stop. Do not run discovery.

### 2) single_page mode

Write manifest with seed URL as the only entry in `pages[]`. Skip discovery.

### 3) site_crawl mode

Discover internal URLs:

```bash
# Sitemap probe
curl -s -o /tmp/sitemap.xml -w "%{http_code}" <origin>/sitemap.xml
```

Discovery order:
1. Sitemap (`sitemap.xml`, index sitemaps if present)
2. Primary navigation links (browser MCP or HTML parse of seed page)
3. Same-origin links from seed, depth-limited

Apply exclusions and limits from [references/contract.md](references/contract.md) § Discovery rules.

Default limits: `max_pages: 50`, `max_depth: 3`, `same_origin_only: true`.

### 4) child_pages_only mode

1. Include seed URL.
2. Discover same-origin links whose path **starts with** seed path prefix.
   - Seed `https://example.com/services/` → include `/services/web-design/`, exclude `/about/`.
3. Apply same exclusions and limits.

### 5) Normalize URLs

- Absolute URLs with consistent trailing slash policy
- Strip `#fragment` and tracking params unless issue requires them
- Deduplicate by normalized path

### 6) Write manifest

Write `artifacts/frontend-crawl-manifest.json` per [references/contract.md](references/contract.md).

Write `findings/frontend-site-crawl.json`:

- `verdict: PASS` when manifest written successfully
- Include `info` findings for sitemap unavailable, pages excluded by limit, auth-gated paths skipped

Examples for all scope modes: [references/examples.md](references/examples.md).

### 7) Hand off to frontend-audit

Comment on child issue or leave manifest in task folder. **`frontend-audit` reads the manifest in its step 0.**

Do not publish HTML from this skill.

## Output contract

```txt
<task-folder>/artifacts/frontend-crawl-manifest.json   ← required on PASS
<task-folder>/findings/frontend-site-crawl.json        ← crawl-stage metadata
```

No HTML report from this skill.

## Orchestrator integration

Typical maintenance sequence:

```txt
1. frontend-site-crawl  → manifest
2. frontend-audit       → JSON + HTML using manifest pages[]
3. report-triage        → rollup
```

When routine scope is homepage-only with no crawl keywords, orchestrator may skip step 1 and run `frontend-audit` directly.

Example routine payload:

```json
{
  "target_url": "https://paperclip-test.designingit.co/",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "crawl_scope": "single_page"
}
```

`crawl_scope` values: `single_page`, `site_crawl`, `child_pages_only`, or omit for issue-text resolution.

## Safety rules

- Same origin as seed only — never follow external domains
- No form submits, no authenticated areas without credentials in issue
- Do not crawl `/wp-admin/`, checkout, cart unless issue explicitly scopes them
- Record every excluded URL in `excluded[]` with reason
- Do not modify rollup files owned by Maintenance Orchestrator

## Related skills

- **`frontend-audit`** — browser QA on manifest URLs; produces HTML + JSON reports
- **`agency-visual-qa`** — task-level visual gate (separate from maintenance crawl)

## BLOCKED conditions

- Conflicting crawl instructions in issue
- Ambiguous scope ("check the site" with no crawl yes/no)
- Seed URL unreachable (5xx, DNS failure)
- Seed behind login and no credentials provided
- Environment/URL mismatch (issue says production, URL is staging)
