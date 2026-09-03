---
name: dit-ingest-diff
description: >-
  Diff two DIT Monitoring ingest snapshots (findings, plugins, themes,
  frontend_audit) and write top-level `diff` plus weeks_observed / unresolved_risk
  before al-push-result. Use after ingest mapping, never on arbitrary specialist
  findings arrays.
owner: support
authors:
  - Alex Dehtiarov
maintainers:
  - Alex Dehtiarov
status: active
version: 0.1.0
last_reviewed: 2026-08-30
last_meaningful_update: 2026-08-30
categories:
  - support
  - maintenance
  - paperclip
  - dit-monitoring
metadata:
  short-description: Diff DIT ingest vs previous ingest
---

# Skill: dit-ingest-diff

Universal **DIT Monitoring ingest diff** for Paperclip Support runs.

Compares **two snapshots of the same contract** — current business object vs previous ingest — and writes a top-level `diff` on the current object. It does **not** scan every `findings[]` under the orchestrator.

Works for these collections when they are present:

- `findings[]`
- `plugins[]`
- `themes[]`
- `frontend_audit` (object; arrays inside it are `findings[]` and, per the front contract, `pages[]`)

Known specialist shapes (WordPress, frontend-audit) have tighter key rules in `references/`. A future agent under the same parent that also emits `findings[]` is **out of scope** unless that object passes the ingest gate below.

This skill does **not** replace `frontend-deploy-regression` (page baseline inside `frontend_audit.baseline_comparison`).

Full algorithm and JSON: `references/diff-contract.md`.  
WordPress keys: `references/wordpress-contract.md`.  
Frontend keys: `references/frontend-audit-contract.md`.

## When to use

Last step on the **mapped DIT ingest JSON**:

1. Orchestrator built ingest (`support-maintenance-orchestration` → `references/report-contract.md` → DIT Monitoring ingest mapping).
2. Run **this skill** (write `diff` and stamp `weeks_observed` / `unresolved_risk` on entities).
3. Then **`al-push-result`** if the routine delivers via Access Layer.

If there is **no** AL path, still write `diff` on the result when previous ingest exists.

Do **not** run on a specialist child issue. Do **not** treat `findings/<check>.json`, `dashboard-summary.json`, or rollup stubs as input unless that file **is** the mapped ingest object.

Missing `diff` must **never** block Access Layer push. `al-push-result` sets `_al.hasDiff` true/false.

## Who runs this skill

| Agent | Role |
| ----- | ---- |
| **Maintenance Orchestrator** | Owns the skill. Wake 3: mapping → `dit-ingest-diff` → `al-push-result`. |
| **AL Gateway** | Does **not** attach this skill. Collects ingest from the task folder; pushes with or without `diff`. |
| **WordPress / Frontend children** | Do **not** run this skill. They only emit stable ids / slugs so ingest match works. |

## Input identity (gate)

The current object must look like DIT ingest / mapped specialist result — the inner business object (`requestBody.result` / `body.result`), **not** the AL envelope (`query`/`params`/`body`, `notify`/`deliveries`).

If the caller handed `body.result` or `requestBody.result`, unwrap first.

Proceed only when **all** of the following hold:

1. Identity marker — at least one of:
   - `run_id` (UUID) **and** `check_type`;
   - `_sync.dit_monitoring_project_id` (or `_sync.dit_monitoring_id`);
   - `site` **and** ingest `verdict` in `pass` \| `warn` \| `fail` \| `unknown`.
2. At least one known collection: array `findings`, array `plugins`, array `themes`, or object `frontend_audit`.
3. Not a reject shape: `dashboard-summary.json`, compact rollup stub, or a foreign specialist JSON that only happens to contain `findings[]`.

If the gate fails → **no-op**. Do not write `diff`. Do not invent collections. Continue the run.

Diff **only collections that exist** on the current object. No `plugins` → do not emit `diff.plugins`. No `frontend_audit` → do not invent front rows.

## Previous ingest

Same contract as current. Lookup order:

1. Caller passed a previous ingest object.
2. Last ingest for the same project (`_sync.dit_monitoring_project_id` or `client` + `site`) **and** the same `check_type`, from a prior task-folder copy or saved `payload.processed`.
3. No previous → **do not** write `diff`. Do not block the run.

Never take previous from specialist child JSON (`findings/wordpress-basic.json`, `findings/frontend-audit.json`) or from AL `deliveries[]`.

## Output

1. Stamp `weeks_observed` and `unresolved_risk` on matched current entities (see `references/diff-contract.md`).
2. Append top-level **`diff` at the end** of the business object (after collections; before `_al` if `_al` is already present).
3. Do **not** mutate `_sync`. Do **not** build or edit `_al` (that is `al-push-result`).

Omit empty `diff` collections. If no previous or the gate failed, leave `diff` absent.

## Rules

- Match on canonical keys, never on `title` alone.
- Split / merge use `related_keys` and `change: split` \| `merged`. Those items are never `resolved`.
- `weeks_observed` increments from the previous ingest of the same `check_type`, not from calendar weeks. A gap (no match last run) resets to `0`.
- `unresolved_risk` is a table of severity × `weeks_observed`. It is not `severity`.
- AL push is independent of `diff`.
