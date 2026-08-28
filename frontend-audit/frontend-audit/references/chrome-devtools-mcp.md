# chrome-devtools-mcp — Browser Health workflow

Reference for all **Front-end / Browser Health Agent** sub-skills. Official tool list: [ChromeDevTools/chrome-devtools-mcp tool-reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).

**Prerequisite:** chrome-devtools-mcp tools must be **callable in this agent run** (`navigate_page`, `list_pages`, …). Host CLI `claude mcp list` → Connected is **not** sufficient. If in-session tools are missing → **lab fallback** (below), not an immediate full-run stop.

## Session bootstrap (once per audit run)

1. **`list_pages`** — see open tabs; reuse or create fresh context.
2. **`new_page`** `{ "url": "<seed-or-first-page>" }` — prefer isolated context per audit run when supported.
3. **`select_page`** `{ "pageId": <id> }` — all following tools apply to this page until changed.

Record `tooling.browser_tool: "chrome-devtools-mcp"`.

## Per-page / per-viewport loop

Default viewports (orchestrator):

| Label | `emulate.viewport` |
| --- | --- |
| Desktop | `1440x1100` |
| Mobile | `390x844,mobile,touch` |

Steps for each `(page_url, viewport)`:

1. **`emulate`** `{ "viewport": "<width>x<height>[,mobile,touch]" }` — set device size before navigation when switching viewports.
2. **`navigate_page`** `{ "url": "<absolute-url>" }` — load target; record `final_url` from result.
3. **`wait_for`** `{ "text": ["<expected fragment>"] }` — optional; use sparingly (title or hero text). Timeout → note in page `blocked_reason`, do not hang.
4. Run sub-skills (console, network, performance, …) — each writes a partial JSON file.
5. **`take_screenshot`** `{ "filePath": "artifacts/frontend-audit/<slug>-<viewport>.png", "format": "png" }` — evidence for HTML report.

Hard gate after navigation: HTTP 404/5xx, login wall, wrong domain → mark page `status: "blocked"` in orchestrator; sub-skills may skip or record empty partial with `skipped: true`.

## Tool map by check type

### Navigation & emulation

| Tool | Use |
| --- | --- |
| `navigate_page` | Load URL under test |
| `new_page` / `select_page` / `list_pages` / `close_page` | Tab lifecycle |
| `emulate` | Viewport, network throttling (usually off for health check), user agent |
| `resize_page` | Alternative to `emulate.viewport` when only size matters |
| `wait_for` | Wait for content after navigation |

### Console (`frontend-browser-console`)

| Tool | Use |
| --- | --- |
| `list_console_messages` | `{ "types": ["error"] }` — primary source; paginate with `pageIdx` / `pageSize` if needed |
| `list_console_messages` | `{ "types": ["warn"] }` — map warnings to `info` findings when relevant |
| `get_console_message` | `{ "msgid": <id> }` — full stack / source URL for a specific error |

Filter to messages since last navigation. Set `includePreservedMessages: true` only when debugging flaky loads.

### Network (`frontend-network-health`)

| Tool | Use |
| --- | --- |
| `list_network_requests` | All requests since navigation; filter `resourceTypes`: `document`, `script`, `stylesheet`, `image`, `font`, `xhr`, `fetch` |
| `get_network_request` | `{ "reqid": <n> }` — status, failure reason, CORS / mixed-content details |

Flag: status ≥ 400, `(failed)` status, blocked by CORS, mixed content on HTTPS pages.

**Broken images:** combine failed image requests with:

```javascript
// evaluate_script — function body only
() => Array.from(document.images)
  .filter(img => !img.complete || img.naturalWidth === 0)
  .map(img => ({ url: img.currentSrc || img.src, alt: img.alt || '' }))
```

### Performance & CWV (`frontend-performance-cwv`)

| Tool | Use |
| --- | --- |
| `performance_start_trace` | `{ "reload": true, "autoStop": true }` after `navigate_page` to target URL — lab CWV (LCP, INP, CLS) + long tasks |
| `performance_stop_trace` | When `autoStop` is false |
| `performance_analyze_insight` | Drill into `LCPBreakdown`, `DocumentLatency`, etc. from trace insight set |
| `lighthouse_audit` | Performance category via trace tools; for **accessibility** use `frontend-accessibility-audit` |

Extract from trace results: `lcp_ms`, `cls`, `inp_ms`, `tbt_ms`, `rating` (`good` / `needs_improvement` / `poor`). Label `source: "lab_trace"`. Never label as field/CrUX unless CrUX tooling was explicitly enabled and documented.

### Accessibility (`frontend-accessibility-audit`)

| Tool | Use |
| --- | --- |
| `lighthouse_audit` | `{ "device": "desktop"|"mobile", "mode": "snapshot" }` on loaded page — **accessibility** category score and audit items |
| `take_snapshot` | Optional a11y tree snapshot for manual critical issues (verbose sparingly) |

Do not claim full WCAG compliance — report score + top failing audits only.

### Screenshots & DOM

| Tool | Use |
| --- | --- |
| `take_screenshot` | Desktop/mobile evidence PNGs |
| `take_snapshot` | a11y tree uids if interaction needed (rare in health check) |
| `evaluate_script` | Broken images, third-party script detection helpers |

## Third-party detection helper

```javascript
() => {
  const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean);
  const hosts = [...new Set(scripts.map(u => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean))];
  return { script_count: scripts.length, third_party_hosts: hosts.filter(h => !location.hostname.endsWith(h.replace(/^www\./,''))) };
}
```

Cross-reference hosts with `list_network_requests` failures / long durations for `frontend-third-party-scripts`.

## Safety

- Read-only: no `fill`, `click` (except orchestrator-approved smoke), no form submit, no cart/checkout unless another skill scopes it.
- Same origin as seed only.
- Do not throttle network (`emulate.networkConditions`) unless the issue explicitly requests slow-network testing.

## When MCP is missing (in-session tools)

CLI `claude mcp list` → Connected does **not** count. Tools must be callable in this run (`navigate_page`, `emulate`, `list_console_messages`, `list_network_requests`, `performance_start_trace`, `take_screenshot`, `lighthouse_audit`).

**Lab fallback (weekly-health allowed):**

1. Resolve Chrome-for-Testing from the host chrome-devtools MCP config (`executablePath` / cache under the paperclip user home). Do not invent a browser path.
2. Run Lighthouse CLI once per `(url, viewport)`:

```bash
# Desktop
npx --yes lighthouse "<url>" \
  --output=json --output=html \
  --output-path="artifacts/frontend-audit/lighthouse-<slug>-desktop" \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"

# Mobile
npx --yes lighthouse "<url>" \
  --output=json --output=html \
  --output-path="artifacts/frontend-audit/lighthouse-<slug>-mobile" \
  --form-factor=mobile --screenEmulation.mobile \
  --only-categories=performance,accessibility,best-practices \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"
```

Pass `--chrome-path` when the host config names a Chrome-for-Testing binary. Lighthouse writes `*.report.json` / `*.report.html` (or `.json` / `.html`) next to `--output-path`; sub-skills read those JSON files.

3. Map LH JSON into the same partials:
   - console → `audits["errors-in-console"]` (lab, not live console)
   - network → failed/blocked items from `network-requests` / related audits
   - CWV → LCP / CLS / TBT from performance audits; label `source: "lighthouse_lab"` (never `lab_trace` or field/CrUX). Omit INP when LH did not report it.
   - a11y → accessibility category score + failing audit titles
   - third-party → `third-party-summary` / third-party script hosts when present
4. Screenshots: LH report screenshot, or `paperclip-qa-visual-check`, into `artifacts/frontend-audit/<slug>-desktop.png` / `<slug>-mobile.png`. **Not** Firecrawl or Playwright.
5. Write the same merged JSON/HTML contract. `verdict` is **`PARTIAL`** (or `FAIL` if hard gates fire). Never `PASS`.
6. Add finding `severity: info`, `follow_up: false`, `id: "front.tooling:mcp-not-in-session"`, title like `Browser evidence is Lighthouse CLI (chrome-devtools-mcp not in session)`.

If Lighthouse CLI also fails → orchestrator verdict `BLOCKED`, `tooling.browser_tool_available: false`, `lighthouse_available: false`.
