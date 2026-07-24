# Frontend Site Crawl — Manifest Contract

## Output path

```txt
<task-folder>/artifacts/frontend-crawl-manifest.json
<task-folder>/findings/frontend-site-crawl.json    ← crawl metadata + scope findings
```

`frontend-audit` reads `frontend-crawl-manifest.json` in step 0.

Human-readable agent setup guide: [agent-config.md](agent-config.md). Discovery MCP providers: [discovery-mcp.md](discovery-mcp.md).

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
    "mode_source": "issue_explicit | issue_default | routine | agent_default",
    "instruction": "string",
    "rules": [],
    "include_patterns": [],
    "exclude_patterns": [],
    "priority_urls": [],
    "template_caps": []
  },
  "discovery": {
    "mcp_server": "auto",
    "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
    "mcp_required": false,
    "mcp_fallback": "http_only",
    "mcp_resolved": "chrome-devtools-mcp",
    "mcp_available": true,
    "use_browser_mcp": true,
    "sources": ["sitemap", "nav_links"],
    "nav_scope": "primary_only",
    "no_pagination": true,
    "strip_query_params": true,
    "exclude_extensions": [".pdf", ".jpg", ".png", ".zip"],
    "sitemap_filter": null,
    "sources_used": [],
    "sitemap_url": null,
    "sitemap_available": false
  },
  "limits": {
    "max_pages": 10,
    "max_depth": 2,
    "max_discovery_candidates": 100,
    "same_origin_only": true
  },
  "pages": [],
  "excluded": [],
  "stats": {
    "discovered": 0,
    "included": 0,
    "excluded": 0,
    "excluded_by_reason": {}
  }
}
```

---

## Agent configuration (routine / issue)

When creating a **Front-end / Browser Health Agent** in Paperclip:

1. Attach MCP servers in agent settings (ids must match routine JSON).
2. Set **`mcp.discovery`** and **`mcp.audit`** in routine — see [discovery-mcp.md](discovery-mcp.md).
3. Set scope, limits, and sources below.

| Field | Purpose |
|---|---|
| `mcp.discovery` | Which MCP collects URLs — id or `"auto"` |
| `mcp.audit` | Which MCP runs `frontend-audit` |
| `discovery.mcp_priority` | **Cheapest-first** chain: `http_only`, `crawlbase-mcp` (planned), `firecrawl-mcp` (planned), `chrome-devtools-mcp` |
| `discovery.mcp_server` | Per-run override for discovery MCP |
| `discovery.mcp_required` | Block run if discovery MCP missing |
| `discovery.mcp_fallback` | `http_only` when MCP unavailable |
| `scope.rules[]` | Which pages/sections to include |
| `limits.max_pages` | Hard cap on URLs sent to `frontend-audit` |
| `limits.max_depth` | Link-follow depth for discovery rules |
| `discovery.sources` | Where to discover URLs (`sitemap` needs no MCP; `nav_links` needs browser MCP) |
| `template_caps[]` | Cap repetitive templates (blog posts, product SKUs) |
| `scope.exclude_patterns` | Paths never audited |

---

## scope.mode

| Mode | Meaning |
|---|---|
| `flexible` | **Default for all new runs.** Built from `scope.rules[]` + discovery limits. |
| `single_page` | **Legacy read-only.** One `url` rule for `seed_url`. |
| `site_crawl` | **Legacy read-only.** One `site_discovery` rule. |
| `child_pages_only` | **Legacy read-only.** One `path_tree` rule. |

New manifests must use `flexible` only.

---

## scope.rules[] — include targets

Union all rules → normalize → apply excludes → apply template caps → apply limits → `pages[]`.

| `target` | `value` | Behaviour |
|---|---|---|
| `url` | Absolute URL or path on seed origin | Exactly this URL |
| `path` | Pathname, e.g. `/about/` | Exactly this path on seed origin |
| `path_tree` | Path prefix, e.g. `/services/` | Prefix URL + descendants (`discover_children: true`) |
| `path_sample` | Path prefix, e.g. `/blog/` | Index/listing URL + **sample N** matching child URLs (see below) |
| `site_discovery` | `"seed"` | Discover from sitemap → nav → links (respects `discovery.sources`) |

### Per-rule optional fields

| Field | Applies to | Description |
|---|---|---|
| `discover_children` | `path_tree` | Must be `true` for tree crawl |
| `sources` | `path_tree`, `site_discovery`, `path_sample` | Override `discovery.sources` for this rule |
| `max_depth` | discovery targets | Override `limits.max_depth` for this rule |
| `max_pages` | discovery targets | Override `limits.max_pages` for this rule |
| `sample` | `path_sample` | Sampling config (required for `path_sample`) |

### `path_sample` — blog posts, products, archives

Use when issue asks for **listing + a few examples**, not every child URL.

```json
{
  "action": "include",
  "target": "path_sample",
  "value": "/blog/",
  "sample": {
    "include_index": true,
    "match_pattern": "/blog/*/",
    "max": 2,
    "strategy": "random",
    "seed": "run-id-or-issue-id"
  }
}
```

| `sample` field | Description |
|---|---|
| `include_index` | Always include the listing URL (`/blog/`) |
| `match_pattern` | Glob on pathname; `*` = one segment. Examples: `/blog/*/`, `/products/*/` |
| `max` | Max URLs matching pattern (excluding index) |
| `strategy` | `random`, `first`, `last`, `spread` (evenly spaced from sorted list) |
| `seed` | Optional — deterministic random for reproducible runs |

**Natural language → `path_sample`:**

| Issue phrase | `sample` |
|---|---|
| «проверь блог и пару случайных постов» | `include_index: true`, `max: 2`, `strategy: random` |
| «blog index + one post» | `max: 1`, `strategy: first` |
| «one post per category» | use multiple rules or `strategy: spread` with higher `max` |

Posts/articles are **non-unique templates** — always cap with `path_sample` or `template_caps`, never full `path_tree` on `/blog/` unless issue explicitly requests all posts.

### scope.include_patterns[]

Allowlist applied **after** rules union. URL must match at least one pattern to stay in scope.

```json
"include_patterns": ["/", "/about/", "/services/", "/contact/"]
```

Use for tight smoke tests: rules discover candidates, allowlist trims.

### scope.priority_urls[]

Always kept in `pages[]` even when `max_pages` truncates others (homepage, checkout landing, issue-critical URL).

```json
"priority_urls": ["https://example.com/", "https://example.com/contact/"]
```

### scope.template_caps[]

Group URLs by pathname template and cap each group **after** discovery, **before** global `max_pages`.

```json
"template_caps": [
  {
    "pattern": "/blog/*/",
    "max": 2,
    "strategy": "random",
    "seed": "issue-123",
    "always_include": ["/blog/"]
  },
  {
    "pattern": "/products/*/",
    "max": 3,
    "strategy": "first"
  }
]
```

| Field | Description |
|---|---|
| `pattern` | Glob on normalized path; `*` = one path segment |
| `max` | Max URLs per template group (excluding `always_include`) |
| `strategy` | `random`, `first`, `last`, `spread` |
| `always_include` | Paths always kept (listing pages) |

Unique marketing pages (`/about/`, `/services/web-design/`) typically need no cap — one URL per path.

### scope.exclude_patterns[]

Path prefixes removed after includes. Merged with default exclusions unless issue overrides.

Default (always apply unless issue says otherwise):

```txt
/wp-admin/, /wp-login.php, /cart/, /checkout/, /my-account/
/tag/, /category/, /author/
/blog/page/, /page/
/feed/, /comments/feed/
```

---

## discovery — URL collection settings

Provider registry and Paperclip agent setup: [discovery-mcp.md](discovery-mcp.md).

| Field | Default (maintenance) | Description |
|---|---|---|
| `mcp_server` | `auto` or server id | Discovery MCP — id must match Paperclip attachment. `"auto"` picks first **connected** id from `mcp_priority` (cheapest first). `http_only` = curl/sitemap only |
| `mcp_priority` | see [discovery-mcp.md](discovery-mcp.md) | Ordered list — **cheapest first**: `http_only` → `crawlbase-mcp` → `firecrawl-mcp` → `chrome-devtools-mcp`. Extend when new crawl MCPs are added |
| `mcp_priority_attempted` | (output) | Ids tried during auto-selection |
| `mcp_required` | `false` | `true` → `BLOCKED` if `mcp_server` not connected |
| `mcp_fallback` | `http_only` | Used when MCP missing and `mcp_required: false` |
| `mcp_resolved` | (output) | Actual provider used after fallback |
| `mcp_available` | (output) | Whether configured MCP was connected at run time |
| `use_browser_mcp` | **deprecated** | `true` when `mcp_server` is set and not `http_only` |
| `sources` | `["sitemap", "nav_links"]` | **`same_origin_links` off by default** |
| `nav_scope` | `primary_only` | `primary_only` \| `all_nav` |
| `no_pagination` | `true` | Skip `/page/2/`, `?page=`, `/blog/page/N/` |
| `strip_query_params` | `true` | Dedupe by path; drop tracking params |
| `exclude_extensions` | `.pdf`, images, `.zip` | Skip direct file URLs |
| `sitemap_filter` | `null` | Optional substring filter on sitemap URLs |

Routine-level defaults (agent creator):

```json
"mcp": {
  "discovery": "auto",
  "audit": "chrome-devtools-mcp"
},
"discovery": {
  "mcp_server": "auto",
  "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"]
}
```

`discovery.mcp_server` overrides `mcp.discovery` for one run (unless both are `auto`).

**Planned crawl MCPs** (`crawlbase-mcp`, `firecrawl-mcp`) — add to agent when available; document tools in [discovery-mcp.md](discovery-mcp.md). Registry is extensible.

### Source order (when enabled)

1. `issue_explicit` — from `url` / `path` rules (no MCP)
2. `sitemap` — HTTP/`curl` (works with `http_only` or any MCP server)
3. `nav_links` — requires browser MCP (`chrome-devtools-mcp` or other attached server)
4. `same_origin_links` — requires browser MCP; **only when explicitly enabled**

### When to set which MCP

| Scenario | `mcp.discovery` | `mcp.audit` | `sources` |
|---|---|---|---|
| Explicit URL list only | `http_only` | `chrome-devtools-mcp` | none |
| Sitemap-only scope | `http_only` | `chrome-devtools-mcp` | `["sitemap"]` |
| Cost-optimized auto | `auto` | `chrome-devtools-mcp` | `mcp_priority` cheapest connected |
| API crawl (when attached) | `crawlbase-mcp` or `firecrawl-mcp` | `chrome-devtools-mcp` | per provider |
| Sitemap + primary nav | `chrome-devtools-mcp` | `chrome-devtools-mcp` | `["sitemap", "nav_links"]` |
| MCP required for nav scope | any browser id + `mcp_required: true` | browser id | includes `nav_links` |

---

## limits — page budget

| Field | Default (maintenance) | Full crawl preset | Description |
|---|---|---|---|
| `max_pages` | `10` | `50` | URLs in final manifest → **audited by frontend-audit** |
| `max_depth` | `2` | `3` | Max link hops during discovery |
| `max_discovery_candidates` | `100` | `500` | Stop discovering after N candidates (before caps/truncation) |
| `same_origin_only` | `true` | `true` | Never follow external domains |

**Token cost:** audit cost ≈ `max_pages × viewports × sub-skills`. Keep `max_pages` low for scheduled maintenance.

### Recommended presets

| Preset name | `max_pages` | `max_depth` | `sources` | Notes |
|---|---|---|---|---|
| `smoke` | `5` | `1` | explicit rules only | Post-deploy homepage + key pages |
| `maintenance` | `10` | `2` | `sitemap`, `nav_links` | Default routine |
| `section` | `15` | `2` | `sitemap`, `nav_links` | One `path_tree` + caps |
| `full` | `50` | `3` | all sources | Rare; issue must say full crawl |

Set preset via routine: `"crawl_preset": "maintenance"` or explicit `limits` + `discovery` objects.

---

## pages[] fields

| Field | Description |
|---|---|
| `url` | Absolute URL, normalized |
| `normalized_path` | Pathname only |
| `source` | `seed`, `issue_explicit`, `sitemap`, `nav`, `internal_link`, `sampled` |
| `depth` | Discovery depth from rule anchor |
| `include_reason` | Human-readable |
| `matched_rule_index` | Index in `scope.rules[]` |
| `template_group` | Optional — matched `template_caps[].pattern` |

---

## excluded[] reasons

| Reason | Meaning |
|---|---|
| `auth_required` | Login wall |
| `out_of_scope` | Fails include_patterns / rule prefix |
| `duplicate` | Normalized path duplicate |
| `over_limit` | Exceeded `max_pages` or `max_discovery_candidates` |
| `over_template_cap` | Exceeded `template_caps` or `path_sample.max` |
| `disallowed_pattern` | Default CMS/admin path |
| `exclude_pattern` | User `exclude_patterns` |
| `pagination` | Skipped by `no_pagination` |
| `file_extension` | Skipped by `exclude_extensions` |
| `not_priority` | Dropped by `max_pages` truncation (not in `priority_urls`) |

Record counts in `stats.excluded_by_reason`.

---

## Scope resolution (flexible)

Parse issue + routine `scope` + agent defaults. Build `scope.rules[]`, merge discovery settings, apply caps.

### Natural language → rules + settings

| User intent | Rules / settings |
|---|---|
| One URL only | `url` rule for seed; `max_pages: 1` |
| Named pages list | One `path`/`url` rule each |
| All under `/services/` | `path_tree` + `max_pages` on rule |
| Full site | `site_discovery` + `crawl_preset: full` |
| Blog + N random posts | `path_sample` with `max: N`, `strategy: random` |
| Blog + one post | `path_sample` with `max: 1` |
| Menu pages only | `discovery.sources: ["nav_links"]`, `nav_scope: primary_only` |
| Sitemap only, no browser MCP | `mcp.discovery: "http_only"`, `sources: ["sitemap"]` |
| Exclude blog archive | `exclude_patterns` + `/tag/`, `/category/` |
| Never more than 8 pages | `limits.max_pages: 8` |
| Homepage always checked | `priority_urls: ["<homepage>"]` |

Keyword hints (EN / RU):

- **Sample:** `couple of posts`, `random posts`, `пара постов`, `случайн`, `one post`, `sample`
- **Cap:** `max N pages`, `no more than`, `не больше`, `limit`, `top 5`
- **No MCP:** `sitemap only`, `no browser crawl`, `без браузера`
- **Nav only:** `main menu`, `primary navigation`, `главное меню`
- **Exclude:** `exclude`, `skip`, `without`, `кроме`, `без`
- **Discovery MCP:** `sitemap only`, `no browser for crawl`, `chrome-devtools-mcp`, `use playwright for crawl`
- **MCP required:** `must use browser for nav`, `do not fall back`

### Routine payload (preferred)

```json
{
  "target_url": "https://example.com/",
  "environment": "development",
  "checks": ["frontend-site-crawl", "frontend-audit"],
  "mcp": {
    "discovery": "chrome-devtools-mcp",
    "audit": "chrome-devtools-mcp"
  },
  "crawl_preset": "maintenance",
  "scope": {
    "instruction": "Homepage, /contact/, blog index + 2 random posts",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/contact/" },
      {
        "action": "include",
        "target": "path_sample",
        "value": "/blog/",
        "sample": {
          "include_index": true,
          "match_pattern": "/blog/*/",
          "max": 2,
          "strategy": "random"
        }
      }
    ],
    "priority_urls": ["https://example.com/"],
    "exclude_patterns": ["/tag/", "/category/", "/author/"]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "mcp_required": false,
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"],
    "nav_scope": "primary_only",
    "no_pagination": true
  },
  "limits": {
    "max_pages": 10,
    "max_depth": 2,
    "max_discovery_candidates": 100
  }
}
```

`crawl_preset` merges defaults then routine `discovery` / `limits` override preset fields.

### Validation

| Condition | Result |
|---|---|
| `rules[]` empty | `BLOCKED` |
| Conflicting instructions | `BLOCKED` |
| 0 URLs after resolution | `BLOCKED` |
| Truncated by limits | `PASS` + `info` finding listing excluded count |
| Clear scope | Write manifest |

Safe default (issue = seed URL only): one `url` rule, `crawl_preset: smoke`.

---

## Rule execution order

1. Resolve each rule → candidate sets (respect per-rule `max_depth`, `sources`)
2. Union candidates; stop at `max_discovery_candidates`
3. Normalize (strip query params if enabled, dedupe by path)
4. Apply `exclude_patterns`, pagination filter, extension filter
5. Apply `include_patterns` if non-empty
6. Apply `template_caps` and `path_sample` limits
7. Apply global `max_pages` — drop non-`priority_urls` first → `excluded[]`
8. Write `pages[]`

---

## Auth / blocked discovery

Seed behind login without credentials → `verdict: BLOCKED`, no manifest (or seed-only with note).

Do not guess credentials.

---

## Legacy preset mapping

| Legacy | Equivalent |
|---|---|
| `single_page` | one `url` rule |
| `site_crawl` | `site_discovery` + full preset limits |
| `child_pages_only` | `path_tree` with `discover_children: true` |
| `crawl_scope` (deprecated) | convert as above |
