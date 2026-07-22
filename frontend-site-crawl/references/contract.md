# Frontend Site Crawl — Manifest Contract

## Output path

```txt
<task-folder>/artifacts/frontend-crawl-manifest.json
<task-folder>/findings/frontend-site-crawl.json    ← crawl metadata + scope findings
```

`frontend-audit` reads `frontend-crawl-manifest.json` in step 0.

---

## frontend-crawl-manifest.json schema

```json
{
  "check": "frontend-site-crawl",
  "generated_at": "ISO-8601",
  "seed_url": "string",
  "environment": "development | staging | production",
  "scope": {
    "mode": "single_page | site_crawl | child_pages_only",
    "mode_source": "issue_explicit | issue_default | blocked",
    "crawl_allowed": true,
    "crawl_instruction": "string | null"
  },
  "discovery": {
    "sources_used": ["sitemap", "nav_links", "same_origin_links"],
    "sitemap_url": "string | null",
    "sitemap_available": false
  },
  "limits": {
    "max_pages": 50,
    "max_depth": 3,
    "same_origin_only": true
  },
  "pages": [
    {
      "url": "string",
      "normalized_path": "string",
      "source": "seed | sitemap | nav | internal_link",
      "depth": 0,
      "include_reason": "string"
    }
  ],
  "excluded": [
    {
      "url": "string",
      "reason": "auth_required | out_of_scope | duplicate | over_limit | disallowed_pattern"
    }
  ],
  "stats": {
    "discovered": 12,
    "included": 5,
    "excluded": 7
  }
}
```

### scope.mode values

| Mode | Meaning |
|---|---|
| `single_page` | Audit exactly one URL — no link discovery |
| `site_crawl` | Discover internal pages from seed (homepage typical) |
| `child_pages_only` | From non-homepage seed, include seed + descendants under path prefix only |

### pages[] fields

| Field | Description |
|---|---|
| `url` | Absolute URL, normalized (no hash, trailing slash policy consistent) |
| `normalized_path` | Pathname only, e.g. `/about/` |
| `source` | How the URL was discovered |
| `depth` | Hops from seed (seed = 0) |
| `include_reason` | Human-readable why this URL is in scope |

---

## findings/frontend-site-crawl.json

Lightweight findings for crawl-stage issues only (not page QA):

```json
{
  "check": "frontend-site-crawl",
  "verdict": "PASS | BLOCKED",
  "generated_at": "ISO-8601",
  "manifest_path": "artifacts/frontend-crawl-manifest.json",
  "findings": [
    {
      "severity": "warning | info | high",
      "category": "frontend",
      "title": "string",
      "evidence": "string",
      "recommendation": "string",
      "owner": "agency",
      "follow_up": false,
      "red_flag": false,
      "source": "curl | browser-mcp | manual",
      "evidence_type": "http"
    }
  ]
}
```

Crawl skill does **not** produce HTML report — `frontend-audit` owns the user-facing HTML.

---

## Scope resolution decision table

Parse issue title + body (case-insensitive). Explicit instruction beats default.

| Seed URL type | Issue text signals | Result mode |
|---|---|---|
| Homepage (`/` or domain root) | No crawl mention | `single_page` — seed only |
| Homepage | `crawl`, `all pages`, `site-wide`, `обход страниц`, `проход по страницам` | `site_crawl` |
| Homepage | `homepage only`, `only homepage`, `do not crawl`, `single page`, `только главная`, `без обхода` | `single_page` |
| Non-homepage path | No child/crawl mention | `single_page` — seed only |
| Non-homepage path | `child pages`, `subpages`, `descendants`, `дочерние страницы` | `child_pages_only` |
| Any | Ambiguous ("check the site") without crawl yes/no | `BLOCKED` — ask orchestrator |
| Any | Conflicting (`crawl` + `homepage only`) | `BLOCKED` — ask orchestrator |

When `frontend-site-crawl` is **not** invoked and issue defaults to single page, `frontend-audit` applies the same table internally.

---

## Discovery rules (when mode ≠ single_page)

1. **Same origin only** — scheme + host must match seed.
2. **Sources** (in order):
   - `sitemap.xml` / `sitemap_index.xml` if HTTP 200
   - Primary nav links from seed page HTML
   - Same-origin `<a href>` from seed (and child pages for `site_crawl`, depth-limited)
3. **Always include seed URL** in `pages[]`.
4. **Exclude by default:**
   - `/wp-admin/`, `/wp-login.php`, `/cart/`, `/checkout/`, `/my-account/`
   - URLs with `#` fragments (strip fragment)
   - `mailto:`, `tel:`, `javascript:`
   - External domains
   - Binary/media direct links unless issue scopes them
5. **child_pages_only:** include URLs whose path starts with seed path prefix (e.g. seed `/services/` → `/services/web-design/` yes, `/about/` no).
6. **Limits:** default `max_pages: 50`, `max_depth: 3` — over-limit URLs go to `excluded[]` with reason `over_limit`.

---

## Auth / blocked discovery

If seed returns login gate and credentials are not in issue scope:

- `verdict: BLOCKED` in `findings/frontend-site-crawl.json`
- Manifest may contain seed only with note in `excluded[]`

Do not guess credentials.
