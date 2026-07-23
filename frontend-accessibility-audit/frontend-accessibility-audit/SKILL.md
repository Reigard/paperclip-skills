---
name: frontend-accessibility-audit
description: Basic accessibility check on loaded page via chrome-devtools-mcp lighthouse_audit (accessibility category). Not a full WCAG audit. Sub-skill merged by frontend-audit.
compatibility: "Requires chrome-devtools-mcp with lighthouse_audit. Page loaded on current viewport."
---

# Frontend Accessibility Audit

Sub-skill for **Front-end / Browser Health Agent**. **Basic** accessibility — Lighthouse a11y score and top failing audits. Not a manual WCAG 2.x audit.

**MCP guide:** [../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md](../../frontend-audit/frontend-audit/references/chrome-devtools-mcp.md)

## Output

```txt
<task-folder>/artifacts/frontend-audit/partials/frontend-accessibility-audit.json
```

## Procedure

### 1) Lighthouse accessibility

On current page (after orchestrator navigation + emulate):

```
lighthouse_audit { "device": "desktop", "mode": "snapshot" }
```

Repeat logic for mobile when orchestrator is on mobile viewport (`device`: `mobile`).

**Note:** `lighthouse_audit` in chrome-devtools-mcp covers accessibility, SEO, best practices — **use only accessibility results** from this skill.

### 2) Extract

- `lighthouse_accessibility_score` (0–100)
- Top failing audits (max 10) — title + brief description
- Do not copy entire Lighthouse HTML into findings

Optional: `take_snapshot` with `verbose: false` for critical missing names/contrast hints — use sparingly.

### 3) Build partial

`pages[].data.accessibility`:

```json
{
  "lighthouse_accessibility_score": 87,
  "issues": [
    "Buttons must have discernible text",
    "Links do not have a discernible name"
  ]
}
```

Findings:

- Score < 80 on production important pages → `warning` or `high` depending on issue severity list
- `evidence_type`: `accessibility`
- Never claim "WCAG AA compliant"

`summary.accessibility_issue_pages` — increment when score below threshold or issues non-empty.

## Do not

- Replace dedicated accessibility engagements or manual screen-reader testing
- Fail pass solely on minor Lighthouse nitpicks on dev/staging without production scope
