---
name: frontend-browser-console
description: Collect JavaScript console errors and relevant warnings from a loaded page using chrome-devtools-mcp (list_console_messages, get_console_message). Sub-skill of the Front-end / Browser Health Agent — partial output merged by frontend-audit.
compatibility: "Requires chrome-devtools-mcp. Page must be navigated and selected by frontend-audit orchestrator."
---

# Frontend Browser Console

Sub-skill for **Front-end / Browser Health Agent**. Detects **JavaScript console errors** (and selected warnings) on the current page/viewport.

**Orchestrator:** `frontend-audit` — do not write `findings/frontend-audit.json` from this skill alone.

**MCP guide:** [../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md](../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md)

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-browser-console.json
```

## Procedure

### 1) Preconditions

- `chrome-devtools-mcp` available
- Orchestrator has `select_page` + `navigate_page` to target URL
- Viewport already set via `emulate` when checking mobile

If preconditions fail → `{ "blocked": true, "blocked_reason": "..." }`, stop.

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

- `severity`: `high` for uncaught exceptions on audited pages
- `red_flag`: `true` on **important pages** (homepage, issue-scoped landing) per agent rules
- `source`: `chrome-devtools-mcp`
- `evidence_type`: `browser-smoke`

`summary.console_error_count` — total errors for this page/viewport.

### 5) Clean pass

When zero errors → optional `info` finding documenting clean console for evidence.

## Severity

| Case | Severity | red_flag |
| --- | --- | --- |
| Uncaught error on homepage / critical URL | high | true |
| Error on secondary page | high | false |
| Warning only | info / warning | false |
