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
    "mode": "flexible",
    "mode_source": "issue_explicit | issue_default | routine",
    "instruction": "string",
    "rules": [
      {
        "action": "include",
        "target": "url | path | path_tree | site_discovery",
        "value": "string",
        "discover_children": false,
        "sources": ["sitemap", "nav_links", "same_origin_links"]
      }
    ],
    "exclude_patterns": ["/wp-admin/", "/cart/"]
  },
  "discovery": {
    "sources_used": ["sitemap", "nav_links", "same_origin_links", "issue_explicit"],
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
      "source": "seed | issue_explicit | sitemap | nav | internal_link",
      "depth": 0,
      "include_reason": "string",
      "matched_rule_index": 0
    }
  ],
  "excluded": [
    {
      "url": "string",
      "reason": "auth_required | out_of_scope | duplicate | over_limit | disallowed_pattern | exclude_pattern"
    }
  ],
  "stats": {
    "discovered": 12,
    "included": 5,
    "excluded": 7
  }
}
```

### scope.mode

| Mode | Meaning |
|---|---|
| `flexible` | **Default for all new runs.** Scope is built from `scope.rules[]` — composable include rules parsed from issue text or routine payload. |
| `single_page` | **Legacy.** Read-only compat for old manifests. Equivalent to one `include` / `url` rule for `seed_url`. |
| `site_crawl` | **Legacy.** Read-only compat. Equivalent to one `site_discovery` rule from seed. |
| `child_pages_only` | **Legacy.** Read-only compat. Equivalent to one `path_tree` rule on seed path with `discover_children: true`. |

New manifests must use `flexible` only. Do not write legacy mode values.

### scope.rules[] — include actions

Each rule adds URLs to scope. **Union** all matching URLs, then dedupe, apply excludes, apply limits.

| `target` | `value` | `discover_children` | Behaviour |
|---|---|---|---|
| `url` | Absolute URL or path resolved against seed origin | `false` | Include exactly this URL |
| `path` | Pathname, e.g. `/about/` | `false` | Include this path on seed origin |
| `path_tree` | Path prefix, e.g. `/services/` | `true` (required) | Include seed path + same-origin descendants under prefix (depth-limited) |
| `site_discovery` | `"seed"` or origin URL | n/a | Discover internal pages from seed via sitemap → nav → same-origin links |

Optional per-rule fields:

| Field | Applies to | Description |
|---|---|---|
| `sources` | `site_discovery`, `path_tree` when discovering | Subset of `sitemap`, `nav_links`, `same_origin_links` |
| `max_depth` | `path_tree`, `site_discovery` | Override default depth for this rule only |

`scope.exclude_patterns[]` — path prefixes excluded after all include rules (default list in § Default exclusions).

### scope.instruction

One-line human summary of resolved scope, copied verbatim from issue when possible. Examples:

- `Homepage, /about/, /services/`
- `/services/ and all child pages under /services/`
- `Full site crawl from homepage`
- `https://example.com/about/, /contact/, /blog/, /news/`

### pages[] fields

| Field | Description |
|---|---|
| `url` | Absolute URL, normalized (no hash, trailing slash policy consistent) |
| `normalized_path` | Pathname only, e.g. `/about/` |
| `source` | How the URL entered scope |
| `depth` | Hops from nearest rule anchor (seed / path_tree root = 0) |
| `include_reason` | Human-readable why this URL is in scope |
| `matched_rule_index` | Index into `scope.rules[]` that included this URL |

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

## Scope resolution (flexible)

Parse issue title + body and optional routine `scope` object. Build `scope.rules[]` — **do not** pick from a fixed 3-mode menu.

### Step 1 — Extract signals from issue text

| User intent (examples) | Rule(s) to add |
|---|---|
| One URL only, no other pages mentioned | `{ action: "include", target: "url", value: "<seed_url>" }` |
| Named pages: "homepage and /about/ and /services/" | One `url` or `path` rule per named page |
| Explicit URL list: `/about/, /contact/, /blog/, /news/` | One `path` or `url` rule per entry |
| "All pages under /services/", "child pages of /services/" | `{ action: "include", target: "path_tree", value: "/services/", discover_children: true }` |
| "Crawl all pages", "site-wide", "full site" | `{ action: "include", target: "site_discovery", value: "seed" }` |
| Combine: "homepage + /about/ + all under /services/" | **Multiple rules** — union results |
| "Do not crawl", "homepage only" | Single `url` rule for seed only; do **not** add discovery rules |
| "Exclude /blog/" | Add `/blog/` to `exclude_patterns` (does not remove explicit include rules) |

Keyword hints (non-exhaustive):

- **Explicit pages:** page names, path lists, bullet lists of URLs
- **Path tree:** `child pages`, `subpages`, `descendants`, `under /path/`, `дочерние страницы`
- **Site discovery:** `crawl`, `all pages`, `site-wide`, `обход`, `проход по страницам`, `все страницы`
- **Single page:** `homepage only`, `single page`, `do not crawl`, `без обхода`, `только главная`

### Step 2 — Routine payload override (optional)

When routine JSON includes structured scope, use it instead of re-parsing issue text:

```json
{
  "target_url": "https://example.com/",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "scope": {
    "instruction": "Homepage, /about/, and all pages under /services/",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/about/" },
      { "action": "include", "target": "path_tree", "value": "/services/", "discover_children": true }
    ],
    "exclude_patterns": ["/wp-admin/"]
  }
}
```

**Deprecated:** `crawl_scope: "single_page" | "site_crawl" | "child_pages_only"` — convert to equivalent rules (see § Legacy preset mapping) when present; prefer `scope.rules[]`.

### Step 3 — Validate

| Condition | Result |
|---|---|
| `rules[]` empty after parsing | `BLOCKED` — cannot determine scope |
| Conflicting instructions unresolved (`crawl all` + `homepage only`) | `BLOCKED` |
| All include rules resolve to 0 URLs | `BLOCKED` |
| Parsed scope is clear | `mode: "flexible"`, `mode_source: "issue_explicit"` or `"routine"` |

**Safe default** when issue gives only `seed_url` and no multi-page signals: one `url` rule for seed (same as legacy `single_page`).

When `frontend-site-crawl` is **not** invoked, `frontend-audit` applies the same flexible resolution internally.

---

## Legacy preset mapping (read + routine compat)

When reading old manifests or deprecated `crawl_scope`:

| Legacy value | Equivalent `flexible` rules |
|---|---|
| `single_page` | `[{ action: "include", target: "url", value: "<seed_url>" }]` |
| `site_crawl` | `[{ action: "include", target: "site_discovery", value: "seed" }]` |
| `child_pages_only` | `[{ action: "include", target: "path_tree", value: "<seed_path>", discover_children: true }]` |

---

## Rule execution order

1. Resolve each rule independently → candidate URL sets
2. **Union** candidates
3. Normalize URLs (absolute, strip `#`, dedupe by path)
4. Apply `exclude_patterns` and default exclusions → `excluded[]`
5. Apply `limits.max_pages` / `limits.max_depth` → overflow to `excluded[]` with `over_limit`
6. Write final `pages[]` with `matched_rule_index` and `include_reason`

---

## Discovery rules (site_discovery and path_tree)

1. **Same origin only** — scheme + host must match seed.
2. **Sources** (in order, unless rule `sources` restricts):
   - `sitemap.xml` / `sitemap_index.xml` if HTTP 200
   - Primary nav links from seed page HTML
   - Same-origin `<a href>` from seed (and child pages when depth allows)
3. **Default exclusions** (also in `exclude_patterns` unless issue overrides):
   - `/wp-admin/`, `/wp-login.php`, `/cart/`, `/checkout/`, `/my-account/`
   - URLs with `#` fragments (strip fragment)
   - `mailto:`, `tel:`, `javascript:`
   - External domains
   - Binary/media direct links unless issue scopes them
4. **Limits:** default `max_pages: 50`, `max_depth: 3`.

---

## Auth / blocked discovery

If seed returns login gate and credentials are not in issue scope:

- `verdict: BLOCKED` in `findings/frontend-site-crawl.json`
- Manifest may contain seed only with note in `excluded[]`

Do not guess credentials.
