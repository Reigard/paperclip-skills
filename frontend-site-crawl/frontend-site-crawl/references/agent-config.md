# Frontend Site Crawl — Agent configuration guide

Use this when **creating or configuring** a Paperclip **Front-end / Browser Health Agent** routine. Copy the preset that matches your goal, then adjust paths and limits.

Full schema: [contract.md](contract.md). Discovery MCP providers: [discovery-mcp.md](discovery-mcp.md). Examples: [examples.md](examples.md).

---

## MCP configuration (Paperclip agent)

Attach MCP servers in **Paperclip agent settings**, then reference their **exact server ids** in the routine JSON.

Discovery (URL search) and audit (browser health) may use **different** MCP servers.

**Cost priority (cheapest first):** `http_only` → `crawlbase-mcp` *(planned)* → `firecrawl-mcp` *(planned)* → `chrome-devtools-mcp`

Use `"auto"` to pick the first connected provider in the chain. Extend the list when new crawl MCPs are attached in Paperclip — see [discovery-mcp.md](discovery-mcp.md).

```json
{
  "mcp": {
    "discovery": "auto",
    "audit": "chrome-devtools-mcp"
  },
  "discovery": {
    "mcp_server": "auto",
    "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
    "mcp_required": false,
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"]
  }
}
```

| Field | When to set |
|---|---|
| `mcp.discovery` | Default discovery MCP id, or `"auto"` |
| `mcp.audit` | Default MCP for `frontend-audit` (usually `chrome-devtools-mcp`) |
| `discovery.mcp_priority` | **Cheapest-first** fallback chain — reorder for your billing |
| `discovery.mcp_server` | Override for one run, or `"auto"` |
| `discovery.mcp_required` | `true` if scope must not fall back to HTTP-only |
| `discovery.mcp_fallback` | Last resort — usually `http_only` |

### Common MCP setups

| Setup | `mcp.discovery` | `mcp.audit` | Notes |
|---|---|---|---|
| Auto cost-optimized | `auto` | `chrome-devtools-mcp` | Tries Crawlbase/Firecrawl when attached |
| Standard (today) | `chrome-devtools-mcp` | `chrome-devtools-mcp` | Until crawl MCPs are attached |
| Cheap crawl, full audit | `http_only` or `firecrawl-mcp` | `chrome-devtools-mcp` | Discovery-only MCPs |
| Sitemap smoke | `http_only` | `chrome-devtools-mcp` | Free discovery |

**Planned providers:** `crawlbase-mcp`, `firecrawl-mcp` — stubs in [discovery-mcp.md](discovery-mcp.md); fill in tool names when Paperclip packages exist.

---

## Quick reference — what to set

| Goal | Set these |
|---|---|
| Fewest pages / tokens | `crawl_preset: "smoke"`, explicit `path` rules, `mcp.discovery: "http_only"` |
| Standard maintenance | `crawl_preset: "maintenance"`, `mcp.discovery: "chrome-devtools-mcp"` |
| Section + all children | `path_tree` rule + `max_pages: 15` on rule |
| Blog listing + sample posts | `path_sample` rule — **never** full `path_tree` on `/blog/` |
| Full site (rare) | `site_discovery` + `crawl_preset: "full"` + explicit issue approval |
| Homepage always audited | `priority_urls: ["https://example.com/"]` |
| No browser MCP for discovery | `mcp.discovery: "http_only"`, `sources: ["sitemap"]` |

---

## Presets (`crawl_preset`)

### `smoke` — post-deploy (5 pages max)

```json
{
  "mcp": { "discovery": "http_only", "audit": "chrome-devtools-mcp" },
  "crawl_preset": "smoke",
  "scope": {
    "instruction": "Homepage and key landing pages",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "path", "value": "/contact/" }
    ],
    "priority_urls": ["https://example.com/"]
  },
  "discovery": {
    "mcp_server": "http_only",
    "sources": []
  },
  "limits": { "max_pages": 5, "max_depth": 1, "max_discovery_candidates": 20 }
}
```

### `maintenance` — scheduled check (default)

```json
{
  "mcp": { "discovery": "chrome-devtools-mcp", "audit": "chrome-devtools-mcp" },
  "crawl_preset": "maintenance",
  "scope": {
    "instruction": "Primary site pages from sitemap and main nav",
    "rules": [
      { "action": "include", "target": "url", "value": "https://example.com/" },
      { "action": "include", "target": "site_discovery", "value": "seed", "max_pages": 9 }
    ],
    "priority_urls": ["https://example.com/"],
    "exclude_patterns": ["/tag/", "/category/", "/author/", "/blog/page/"]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "mcp_required": false,
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"],
    "nav_scope": "primary_only",
    "no_pagination": true
  },
  "limits": { "max_pages": 10, "max_depth": 2, "max_discovery_candidates": 100 }
}
```

### `section` — one area + cap

```json
{
  "crawl_preset": "section",
  "scope": {
    "instruction": "All service pages under /services/, max 15",
    "rules": [
      {
        "action": "include",
        "target": "path_tree",
        "value": "/services/",
        "discover_children": true,
        "max_pages": 15,
        "max_depth": 2
      }
    ]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "sources": ["sitemap", "nav_links"]
  },
  "limits": { "max_pages": 15, "max_depth": 2 }
}
```

### `full` — entire site (use sparingly)

```json
{
  "crawl_preset": "full",
  "scope": {
    "instruction": "Full site crawl — all internal pages",
    "rules": [
      { "action": "include", "target": "site_discovery", "value": "seed" }
    ]
  },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "sources": ["sitemap", "nav_links", "same_origin_links"],
    "nav_scope": "all_nav",
    "no_pagination": false
  },
  "limits": { "max_pages": 50, "max_depth": 3, "max_discovery_candidates": 500 }
}
```

---

## Scenario recipes

### Homepage + named pages (no discovery)

```json
"scope": {
  "instruction": "Homepage, /about/, /services/",
  "rules": [
    { "action": "include", "target": "url", "value": "https://example.com/" },
    { "action": "include", "target": "path", "value": "/about/" },
    { "action": "include", "target": "path", "value": "/services/" }
  ]
},
"limits": { "max_pages": 5 }
```

Issue text equivalent: *Check homepage, /about/, and /services/.*

---

### Blog index + 2 random posts

```json
"scope": {
  "instruction": "Blog listing + 2 random posts",
  "rules": [
    {
      "action": "include",
      "target": "path_sample",
      "value": "/blog/",
      "sample": {
        "include_index": true,
        "match_pattern": "/blog/*/",
        "max": 2,
        "strategy": "random",
        "seed": "<paperclip-issue-id>"
      }
    }
  ],
  "exclude_patterns": ["/tag/", "/category/", "/author/", "/blog/page/"]
},
"limits": { "max_pages": 5 }
```

Issue text: *Check /blog/ and a couple of random post pages.*

**Do not** use `path_tree` on `/blog/` — WordPress sitemaps can list 1000+ posts.

---

### Blog index + 1 post (minimal)

```json
"sample": { "include_index": true, "match_pattern": "/blog/*/", "max": 1, "strategy": "first" }
```

---

### Products / CPT — sample 3 items

```json
"scope": {
  "rules": [
    {
      "action": "include",
      "target": "path_sample",
      "value": "/products/",
      "sample": {
        "include_index": true,
        "match_pattern": "/products/*/",
        "max": 3,
        "strategy": "spread"
      }
    }
  ]
}
```

Or global cap after discovery:

```json
"template_caps": [
  { "pattern": "/products/*/", "max": 3, "strategy": "random", "always_include": ["/products/"] }
]
```

---

### Sitemap only — no browser MCP

```json
"mcp": { "discovery": "http_only", "audit": "chrome-devtools-mcp" },
"discovery": {
  "mcp_server": "http_only",
  "sources": ["sitemap"],
  "sitemap_filter": "page-sitemap"
},
"scope": {
  "rules": [{ "action": "include", "target": "site_discovery", "value": "seed", "max_pages": 10 }]
}
```

Cheapest discovery — good when nav is JS-heavy but sitemap is reliable.

---

### Primary navigation only

```json
"mcp": { "discovery": "chrome-devtools-mcp", "audit": "chrome-devtools-mcp" },
"discovery": {
  "mcp_server": "chrome-devtools-mcp",
  "sources": ["nav_links"],
  "nav_scope": "primary_only"
},
"scope": {
  "rules": [{ "action": "include", "target": "url", "value": "https://example.com/" }]
}
```

Loads homepage in Chrome, extracts main menu links only — ignores footer “Recent posts”.

---

### Tight allowlist

```json
"scope": {
  "include_patterns": ["/", "/about/", "/services/", "/contact/"],
  "rules": [{ "action": "include", "target": "site_discovery", "value": "seed" }]
},
"limits": { "max_pages": 8 }
```

Discovery may find 50 URLs; allowlist keeps 4–8.

---

### Mixed: homepage + services tree + blog sample

```json
"scope": {
  "instruction": "Homepage, all /services/, blog + 2 posts",
  "priority_urls": ["https://example.com/"],
  "rules": [
    { "action": "include", "target": "url", "value": "https://example.com/" },
    {
      "action": "include",
      "target": "path_tree",
      "value": "/services/",
      "discover_children": true,
      "max_pages": 10
    },
    {
      "action": "include",
      "target": "path_sample",
      "value": "/blog/",
      "sample": { "include_index": true, "match_pattern": "/blog/*/", "max": 2, "strategy": "random" }
    }
  ]
},
"limits": { "max_pages": 15 }
```

---

## Issue template (for humans writing tasks)

Paste into Paperclip issue body when agents parse prose:

```txt
Target: https://example.com/
Environment: staging

URL scope:
- Always include: homepage, /contact/
- Section: all pages under /services/ (max 10)
- Blog: /blog/ listing + 2 random posts (not all posts)
- Exclude: /tag/, /category/, /author/, pagination

Discovery:
- MCP for URL search: chrome-devtools-mcp (attach in agent settings)
- MCP for audit: chrome-devtools-mcp
- Sources: sitemap + primary nav
- Fallback: http_only if discovery MCP unavailable
- Max audited pages: 12
```

Structured routine JSON overrides this when both are present.

---

## Parameter cheat sheet

| Parameter | Values | Effect |
|---|---|---|
| `limits.max_pages` | integer | URLs passed to audit |
| `limits.max_depth` | 0–5 | Link-follow depth |
| `limits.max_discovery_candidates` | integer | Stop collecting URLs early |
| `mcp.discovery` | server id or `auto` | MCP for URL search |
| `discovery.mcp_priority` | id[] | Cheapest-first: `http_only`, `crawlbase-mcp`, `firecrawl-mcp`, `chrome-devtools-mcp` |
| `mcp.audit` | server id | MCP for `frontend-audit` |
| `discovery.mcp_server` | server id | Per-run discovery MCP override |
| `discovery.mcp_required` | boolean | Block if discovery MCP missing |
| `discovery.mcp_fallback` | `http_only` | Fallback when MCP unavailable |
| `discovery.use_browser_mcp` | boolean | **Deprecated** — use `mcp_server` |
| `discovery.sources` | `sitemap`, `nav_links`, `same_origin_links` | Where URLs come from |
| `discovery.nav_scope` | `primary_only`, `all_nav` | Menu breadth |
| `discovery.no_pagination` | boolean | Skip archive page 2+ |
| `discovery.strip_query_params` | boolean | Dedupe tracking URLs |
| `discovery.sitemap_filter` | string \| null | Substring filter on sitemap URLs |
| `path_sample.sample.max` | integer | Cap repetitive templates |
| `path_sample.sample.strategy` | `random`, `first`, `last`, `spread` | Which URLs to pick |
| `template_caps[].pattern` | glob | Group URLs by template |
| `scope.priority_urls` | URL[] | Never dropped on truncation |
| `scope.include_patterns` | path[] | Allowlist after discovery |
| `scope.exclude_patterns` | path[] | Blocklist |

---

## Token budget tips

1. **`max_pages` is the main lever** — each page × desktop + mobile × 5+ sub-skills.
2. Prefer **`path_sample`** over **`path_tree`** for blogs, news, products.
3. Keep **`same_origin_links` disabled** unless doing a rare full crawl.
4. Use **`smoke` preset** for post-deploy; **`maintenance`** for weekly runs.
5. Set **`priority_urls`** so truncation never drops homepage.
6. Record **`info` findings** when pages excluded — visible in crawl findings JSON.
