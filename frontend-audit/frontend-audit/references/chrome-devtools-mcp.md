# chrome-devtools-mcp — Browser Health workflow

Reference for all **Front-end / Browser Health Agent** sub-skills. Official tool list: [ChromeDevTools/chrome-devtools-mcp tool-reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md).

**Prerequisite:** `chrome-devtools-mcp` server connected in the agent session. If unavailable → sub-skill / run `BLOCKED`; record `tooling.browser_tool_available: false`.

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

## When MCP is missing

Fallback: `paperclip-qa-visual-check` for screenshots only. Mark console, network, CWV, a11y partials as `blocked: true`. Full browser health gate → orchestrator verdict `BLOCKED`.
