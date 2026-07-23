# Frontend Site Crawl — Discovery MCP providers

Paperclip agents may attach **multiple MCP servers**. URL discovery and browser audit can use **different** providers — configure both in the agent routine.

Agent-level template: [agent-config.md](agent-config.md) § MCP configuration.

Audit MCP workflow (separate): [../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md](../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md).

**This registry is extensible** — add rows when new crawl MCPs are attached in Paperclip. Use the **exact server id** from agent settings.

---

## Routine / manifest fields

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
    "mcp_fallback": "http_only"
  }
}
```

| Field | Scope | Description |
|---|---|---|
| `mcp.discovery` | Routine (agent default) | MCP server id for URL discovery, or `"auto"` |
| `mcp.audit` | Routine (agent default) | MCP for **`frontend-audit`** (usually `chrome-devtools-mcp`) |
| `discovery.mcp_server` | Routine or manifest | Specific id, or `"auto"` — pick from `mcp_priority` |
| `discovery.mcp_priority` | Routine or manifest | **Cheapest first** — try in order until one is connected |
| `discovery.mcp_required` | Routine or manifest | `true` → `BLOCKED` if no provider in chain is available |
| `discovery.mcp_fallback` | Routine or manifest | Last resort when chain exhausted (usually `http_only`) |

**Precedence:** `discovery.mcp_server` (if not `auto`) → else first available in `mcp_priority` → `mcp.discovery` → preset default.

Echo in manifest: `mcp_server`, `mcp_resolved`, `mcp_available`, `mcp_priority_attempted[]`.

**Deprecated:** `discovery.use_browser_mcp` — use `mcp_server` / `mcp_priority` instead.

---

## Provider registry (cost priority — cheapest first)

Default **`discovery.mcp_priority`** order. Reorder per agent if your Paperclip billing differs.

| Priority | `mcp_server` id | Status | Relative cost | Discovery capabilities | Audit |
|---|---|---|---|---|---|
| 1 | `http_only` | **Active** | Free (shell/curl) | Sitemap XML, explicit `url`/`path` rules only | No |
| 2 | `crawlbase-mcp` | **Planned** | Low (API credits) | Crawl/scrape URLs, sitemap-like lists, paginated fetch | No |
| 3 | `firecrawl-mcp` | **Planned** | Low–medium (API credits) | Site map, crawl map, structured link discovery | No |
| 4 | `chrome-devtools-mcp` | **Active** | High (LLM + browser session) | Nav links, same-origin BFS, `evaluate_script` | **Yes** (default audit MCP) |
| 5 | `playwright-mcp` | Optional | High | Nav/links if attached | Possible |
| 6 | `puppeteer-mcp` | Optional | High | Nav/links if attached | Possible |
| — | `<custom-id>` | When attached | Varies | Per server tool docs | Per server |

**Audit always uses `mcp.audit`** — typically `chrome-devtools-mcp`. Crawl MCPs above are **discovery-only** unless you explicitly adapt sub-skills.

### Adding a new provider later

1. Attach MCP in Paperclip agent settings; note the **server id** string.
2. Add a row to this table (and [contract.md](contract.md) if schema fields change).
3. Insert id into agent `discovery.mcp_priority` at the correct **cost rank**.
4. Document which `discovery.sources` the provider supports.
5. Do **not** hardcode secrets — API keys live in Paperclip project secrets / MCP env.

---

## Planned providers (stub — fill in when MCP is available)

### `crawlbase-mcp` (planned)

**Expected use:** cheap HTTP crawl / scrape for URL lists when sitemap is missing or JS-rendered nav is not needed.

| `discovery.sources` | Support (expected) |
|---|---|
| `sitemap` | Via API fetch of `/sitemap.xml` or crawl endpoint |
| `nav_links` | Limited — depends on MCP tools |
| `same_origin_links` | If MCP exposes link extraction |

**Routine placeholder:**

```json
"mcp": { "discovery": "crawlbase-mcp", "audit": "chrome-devtools-mcp" }
```

Tool names and parameters: document here when the Paperclip MCP package is confirmed.

---

### `firecrawl-mcp` (planned)

**Expected use:** map site URLs, crawl sections, return normalized link lists without a full browser audit session.

| `discovery.sources` | Support (expected) |
|---|---|
| `sitemap` | Map/crawl API may replace or supplement sitemap |
| `site_discovery` | Primary fit for `path_tree` / section discovery |
| `path_sample` | Sample URLs from crawl map output |

**Routine placeholder:**

```json
"mcp": { "discovery": "firecrawl-mcp", "audit": "chrome-devtools-mcp" }
```

Tool names and parameters: document here when the Paperclip MCP package is confirmed.

---

## Auto-selection algorithm (`mcp_server: "auto"`)

1. Read `discovery.mcp_priority` (default chain below if omitted).
2. List MCP servers connected in the Paperclip session.
3. Pick the **first** id in priority that is connected **and** supports at least one requested `discovery.sources` entry.
4. If none connected and `mcp_required: false` → `mcp_fallback` (usually `http_only`); skip unsupported sources.
5. If none and `mcp_required: true` → `BLOCKED`.

**Default `mcp_priority` (cheapest first):**

```json
["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"]
```

Skip `http_only` in step 3 when sources require browser/API crawl only if a later provider is connected — e.g. only `nav_links` needs rank ≥ 4 unless Crawlbase/Firecrawl add nav support.

Record in manifest:

```json
"mcp_priority_attempted": ["http_only", "crawlbase-mcp", "firecrawl-mcp"],
"mcp_resolved": "firecrawl-mcp",
"mcp_available": true
```

---

## Provider → discovery source mapping

| `discovery.sources` | `http_only` | `crawlbase-mcp` | `firecrawl-mcp` | `chrome-devtools-mcp` |
|---|---|---|---|---|
| `sitemap` | `curl` | API (planned) | Map API (planned) | `curl` preferred |
| `nav_links` | No | TBD | TBD | `navigate_page` + DOM |
| `same_origin_links` | No | TBD | TBD | BFS + `evaluate_script` |
| `site_discovery` | sitemap only | TBD | **Good fit** (planned) | sitemap + nav + links |

When a source is unsupported by the resolved provider:

- `mcp_required: false` → skip source, `info` finding
- `mcp_required: true` → `BLOCKED`

---

## chrome-devtools-mcp — discovery tool subset

When `discovery.mcp_resolved: "chrome-devtools-mcp"`:

1. **`list_pages`** / **`new_page`** / **`select_page`**
2. **`navigate_page`** `{ "url": "<seed>" }`
3. **`evaluate_script`** — extract same-origin hrefs (see prior examples in git history / chrome-devtools-mcp.md)
4. **Primary nav** — `nav`, `header nav`, `[role="navigation"]` when `nav_scope: primary_only`

Do **not** run audit sub-skills during discovery.

---

## http_only — no MCP

```bash
curl -sS -o /tmp/sitemap.xml -w "%{http_code}" "https://example.com/sitemap.xml"
```

Explicit `url` / `path` rules need no MCP. Cheapest option — use for smoke tests and when API crawl MCPs are not yet attached.

---

## Recommended agent setups

### Cost-optimized (when Crawlbase/Firecrawl attached)

```json
{
  "mcp": { "discovery": "auto", "audit": "chrome-devtools-mcp" },
  "discovery": {
    "mcp_server": "auto",
    "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "site_discovery"]
  }
}
```

### Current default (Crawl MCPs not yet attached)

```json
{
  "mcp": { "discovery": "chrome-devtools-mcp", "audit": "chrome-devtools-mcp" },
  "discovery": {
    "mcp_server": "chrome-devtools-mcp",
    "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
    "mcp_fallback": "http_only",
    "sources": ["sitemap", "nav_links"]
  }
}
```

### Sitemap-only (minimal cost today)

```json
{
  "mcp": { "discovery": "http_only", "audit": "chrome-devtools-mcp" },
  "discovery": { "mcp_server": "http_only", "sources": ["sitemap"] }
}
```

---

## Manifest echo (traceability)

```json
"discovery": {
  "mcp_server": "auto",
  "mcp_priority": ["http_only", "crawlbase-mcp", "firecrawl-mcp", "chrome-devtools-mcp"],
  "mcp_priority_attempted": ["http_only", "crawlbase-mcp"],
  "mcp_resolved": "crawlbase-mcp",
  "mcp_available": true,
  "mcp_fallback": "http_only",
  "sources_used": ["sitemap"]
}
```

---

## Validation

| Condition | Result |
|---|---|
| `mcp_required: true` and no provider in chain available | `BLOCKED` |
| Planned provider configured but not attached | Skip in chain; try next; `info` if skipped |
| Unknown `mcp_server` id (not in registry or agent attachments) | `BLOCKED` |
| Discovery MCP ≠ audit MCP | Allowed — `frontend-audit` uses `mcp.audit` only |
