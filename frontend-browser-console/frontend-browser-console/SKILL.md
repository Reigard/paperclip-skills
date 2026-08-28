---
name: frontend-browser-console
description: Collect JavaScript console errors and relevant warnings from a loaded page using chrome-devtools-mcp (list_console_messages, get_console_message), or Lighthouse CLI errors-in-console when MCP tools are not in session. Sub-skill of the Front-end / Browser Health Agent — partial output merged by frontend-audit.
compatibility: "Prefers chrome-devtools-mcp after orchestrator navigation. Lighthouse CLI lab fallback when MCP tools are not callable."
---

# Frontend Browser Console

Sub-skill for **Front-end / Browser Health Agent**. Detects **JavaScript console errors** (and selected warnings) on the current page/viewport.

**Orchestrator:** `frontend-audit` — do not write `findings/frontend-audit.json` from this skill alone.

**MCP guide:** follow the chrome-devtools-mcp bootstrap steps in the **frontend-audit** skill (attach both skills to the same agent).

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-browser-console.json
```

## Procedure

### 1) Preconditions

- Orchestrator has loaded the target URL (MCP `navigate_page` **or** Lighthouse CLI JSON for this URL/viewport)
- Viewport already set via `emulate` when checking mobile on the MCP path

If **neither** MCP console tools **nor** Lighthouse JSON exist → `{ "blocked": true, "blocked_reason": "mcp_not_in_session" }`, stop.

### Lab fallback

When `list_console_messages` is not callable, map `audits["errors-in-console"]` from `artifacts/frontend-audit/lighthouse-<slug>-<viewport>.json`. Set `"tool": "lighthouse-cli"`. Finding `source`: `lighthouse`. This is lab evidence, not a live console.

### 2) List errors

```
list_console_messages { "types": ["error"] }
```

Paginate with `pageIdx` / `pageSize` when result set is large. For each critical error, optionally:

```
get_console_message { "msgid": <id> }
```

Capture: message text, source URL, line/column, stack summary.

### 3) List warnings (optional)

```
list_console_messages { "types": ["warn"], "pageSize": 20 }
```

Map to `info` or `warning` findings when they indicate broken UX (not noisy deprecations).

### 4) Build partial

`pages[].data.console_errors[]`:

```json
{ "level": "error", "message": "...", "source": "main.js:42" }
```

`findings[]` — one finding per distinct error on important pages:

- `id`: stable (`front.console:uncaught`) — do not put line numbers in `id` or `title`
- `scope`: `front`
- `severity`: `high` for uncaught exceptions on audited pages
- `recommendation`: concrete fix
- `follow_up`: `true` for real errors; `false` for the optional clean-pass info finding
- `red_flag`: `true` on **important pages** (homepage, issue-scoped landing) per agent rules
- `source`: `chrome-devtools-mcp` (MCP path) or `lighthouse` (lab fallback)
- `evidence_type`: `browser-smoke`

`summary.console_error_count` — total errors for this page/viewport.

### 5) Clean pass

When zero errors → optional `info` finding documenting clean console for evidence (`follow_up: false`, `id`: `front.console:clean`).

## Severity

| Case | Severity | red_flag |
| --- | --- | --- |
| Uncaught error on homepage / critical URL | high | true |
| Error on secondary page | high | false |
| Warning only | info / warning | false |
