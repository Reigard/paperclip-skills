---
name: frontend-site-crawl
description: Resolve flexible URL scope for the Front-end / Browser Health Agent — parse issue text or routine rules into a composable include list (explicit URLs, path trees, site discovery). Writes artifacts/frontend-crawl-manifest.json before frontend-audit runs chrome-devtools-mcp checks.
compatibility: "Requires HTTP access to seed URL. Browser MCP optional for link discovery. First step in Browser Health Agent — see paperclip/agents/frontend-browser-health-agent/AGENT.md."
---

# Frontend Site Crawl

Determines **which URLs** the **Front-end / Browser Health Agent** should audit in Chrome. Does not run console/network/CWV checks — the **`frontend-audit` orchestrator** and its sub-skills do that after this manifest exists.

**Agent overview:** [../../agents/frontend-browser-health-agent/AGENT.md](../../agents/frontend-browser-health-agent/AGENT.md)

## When to use

- Issue may cover multiple pages or mixed scope (explicit URLs + section crawl)
- Routine includes `frontend-site-crawl` before `frontend-audit`
- Scope must be recorded in manifest before browser checks run

**Skip this skill** when issue clearly scopes exactly one URL with no discovery — `frontend-audit` can build the same single-URL manifest internally.

## Core rule

Scope is **flexible**: parse the issue (or routine `scope.rules[]`) into composable include rules. Union results, apply excludes and limits. Ambiguous instructions → `BLOCKED`, no manifest. Never crawl out-of-scope domains or auth-gated areas without credentials.

## Inputs required

| Input | Description |
|---|---|
| `seed_url` | Primary URL from issue (homepage or inner page) |
| `environment` | `development`, `staging`, or `production` |
| Issue text | Pages to include, path trees, site crawl, exclusions |
| Issue id | Paperclip child issue |
| Routine `scope` (optional) | Structured `instruction`, `rules[]`, `exclude_patterns[]` |

## Scope resolution

Apply [references/contract.md](references/contract.md) § Scope resolution (flexible).

**Always write `scope.mode: "flexible"`** with a populated `scope.rules[]` array.

### Common scenarios → rules

| Scenario | Rules |
|---|---|
| Homepage only | `[{ action: "include", target: "url", value: "<seed_url>" }]` |
| Homepage + `/about/` + `/services/` | Three `url` or `path` include rules |
| `/about/`, `/contact/`, `/blog/`, `/news/` | One `path` rule per path |
| `/services/` and all child pages | `[{ action: "include", target: "path_tree", value: "/services/", discover_children: true }]` |
| Full site crawl | `[{ action: "include", target: "site_discovery", value: "seed" }]` |
| Homepage + all under `/services/` | `url` for homepage + `path_tree` for `/services/` |

Record a one-line `scope.instruction` summarizing what was parsed.

## Procedure

### 1) Parse scope from issue or routine

Build `scope.rules[]`, `scope.instruction`, `scope.exclude_patterns[]`.

If `BLOCKED` → write `findings/frontend-site-crawl.json` with verdict `BLOCKED`, stop. Do not run discovery.

### 2) Execute rules

For each rule in `scope.rules[]`:

| `target` | Action |
|---|---|
| `url` / `path` | Resolve to absolute URL on seed origin; add to candidates |
| `path_tree` | Add seed path; discover same-origin links under prefix (depth-limited) |
| `site_discovery` | Discover via sitemap → nav → same-origin links from seed |

Sitemap probe:

```bash
curl -s -o /tmp/sitemap.xml -w "%{http_code}" <origin>/sitemap.xml
```

Apply exclusions and limits from [references/contract.md](references/contract.md) § Discovery rules.

Default limits: `max_pages: 50`, `max_depth: 3`, `same_origin_only: true`.

### 3) Normalize and dedupe

- Absolute URLs with consistent trailing slash policy
- Strip `#fragment` and tracking params unless issue requires them
- Deduplicate by normalized path
- Record `matched_rule_index` and `include_reason` on each `pages[]` row

### 4) Write manifest

Write `artifacts/frontend-crawl-manifest.json` per [references/contract.md](references/contract.md).

Write `findings/frontend-site-crawl.json`:

- `verdict: PASS` when manifest written successfully
- Include `info` findings for sitemap unavailable, pages excluded by limit, auth-gated paths skipped

Examples: [references/examples.md](references/examples.md).

### 5) Hand off to frontend-audit

**`frontend-audit` reads the manifest in step 0** and audits every URL in `pages[]`.

Do not publish HTML from this skill.

## Output contract

```txt
<task-folder>/artifacts/frontend-crawl-manifest.json   ← required on PASS
<task-folder>/findings/frontend-site-crawl.json        ← crawl-stage metadata
```

No HTML report from this skill.

## Orchestrator integration

Typical Browser Health Agent sequence:

```txt
1. frontend-site-crawl           → manifest (which URLs)
2. frontend-audit (orchestrator) → merge sub-skills → JSON + HTML
   ├─ frontend-browser-console
   ├─ frontend-network-health
   ├─ frontend-performance-cwv
   ├─ frontend-third-party-scripts
   ├─ frontend-accessibility-audit
   └─ frontend-deploy-regression
3. report-triage                 → rollup
```

When issue scopes a single URL with no discovery signals, orchestrator may skip step 1.

Example routine payload (preferred):

```json
{
  "target_url": "https://paperclip-test.designingit.co/",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "scope": {
    "instruction": "Homepage, /about/, and all pages under /services/",
    "rules": [
      { "action": "include", "target": "url", "value": "https://paperclip-test.designingit.co/" },
      { "action": "include", "target": "path", "value": "/about/" },
      { "action": "include", "target": "path_tree", "value": "/services/", "discover_children": true }
    ]
  }
}
```

**Deprecated:** `crawl_scope: "single_page" | "site_crawl" | "child_pages_only"` — convert to equivalent rules per contract § Legacy preset mapping.

## Safety rules

- Same origin as seed only — never follow external domains
- No form submits, no authenticated areas without credentials in issue
- Do not crawl `/wp-admin/`, checkout, cart unless issue explicitly scopes them
- Record every excluded URL in `excluded[]` with reason
- Do not modify rollup files owned by Maintenance Orchestrator

## Related skills

- **`frontend-audit`** — orchestrator; merges sub-skills → `findings/frontend-audit.json`
- **`agency-visual-qa`** — separate visual / design acceptance gate — not used in standard browser health maintenance flow

## BLOCKED conditions

- Cannot parse any include rule from issue or routine
- Conflicting scope instructions
- Seed URL unreachable (5xx, DNS failure)
- Seed behind login and no credentials provided
- Environment/URL mismatch (issue says production, URL is staging)
