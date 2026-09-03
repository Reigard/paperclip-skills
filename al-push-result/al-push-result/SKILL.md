# Skill: al-push-result

Universal **outbound** skill for Access Layer–driven Paperclip agents.

Works in both setups:

- **Domain agent** — after domain skills finish.
- **Access Layer Gateway Orchestrator** — after collecting the routine / sibling result (this agent has no domain skills).

At the end of the run:

1. Take the final business JSON (or build a minimal one).
2. Create or merge **only** the `_al` block (including a short `summary` for Slack).
3. POST the result to Access Layer (`/api/push/run-summary`).

Never rewrite business fields outside `_al`. Never touch `_sync`.

Inbound `input.alNative` (from **al-parse-command**) marks Access Layer–native gateway commands (`al`). Ordinary Paperclip routes have `alNative: false`. Do **not** copy `alNative` into `_al` or invent it on the push payload — it is inbound-only.

## When to use

After domain work finishes (success, partial, or empty). Always push so AL can complete the pending gateway request and notify recipients.

## `_al` block (skill responsibility)

Merge into the result (create if missing). Preserve inbound `_al` keys (especially `request_id`, `gateway_request_id`, `push_url`, **`notify`**), then set/update:

```json
"_al": {
  "request_id": "req_…_<agentPrefix>",
  "gateway_request_id": "req_…",
  "agent_id": "<paperclip-agent-id>",
  "company_id": "<paperclip-company-id>",
  "routine_id": null,
  "command": "audit",
  "summary": "Short human text for Slack / notifications",
  "push_url": "https://example.com/api/push/run-summary",
  "pushed_at": "<ISO-8601 now>",
  "source": "access-layer",
  "direction": "outbound",
  "empty_result": false,
  "hasDiff": false
}
```

### `hasDiff` (required)

Set after the business object is resolved. This skill does **not** compute the ingest `diff` (that is **`dit-ingest-diff`**, run by the orchestrator before this skill).

- `hasDiff: true` — the business object has a non-empty top-level `diff` object (at least `against` plus one collection or `summary`).
- `hasDiff: false` — `diff` is missing, empty, or not an object.

**Missing `diff` is not an error.** Always push. Do not set `empty_result: true` only because `diff` is absent. Do not invent `diff`.

### `summary` (required)

Slack / notifications read **`_al.summary` as the DM body**. It must be human-readable — not JSON, not a file dump.

**Support `/audit` and weekly-health routines** (CCJ and the same orchestration): copy **`slack-summary.txt`** from the task folder (after triage). That file is the DM. Keep Slack mrkdwn (`*bold*`, `•` bullets, short sections). Cap at **3500 characters**; if longer, keep the title line, red flags, and action-needed, then truncate.

Example shape (multi-line is expected):

```txt
*CCJ Weekly Health Check — 2026-07-27* | Status: :eyes: WATCH

*WordPress (production)*
• WP 6.9.x | n plugin updates pending
• TLS certificate expires in 39 days

*Browser Health (homepage)*
• Frontend audit: PASS — no console errors

*Red flags:* None
*Action needed:* Schedule plugin + core updates
```

Omit CMS or front sections that were **not** in `selected_checks` for this run.

**Fallback** (no `slack-summary.txt`): 1–2 lines, then up to three finding titles.

- `audit · example-project · warn · 3 findings`
- `No agent result; context only (orchestrator/issue).`

No secrets or tokens in `summary`.

### Ids

Copy `request_id` and `gateway_request_id` from inbound `_al` (or recovered `meta`). **Never invent new ones.**

### `notify` and `push_url` (Paperclip-native runs)

Access Layer **service name(s)** (`Service.name`). AL POSTs the result to those services’ Result URLs even when there is **no** inbound command from a service.

**When the run did not come through AL** (routine started manually or on a schedule inside Paperclip — no service caller, no AL gateway envelope / no `gateway_request_id` from AL), **always** set on outbound `_al`:

```json
"notify": "DIT Monitoring",
"push_url": "https://dit-al.designingit.co/api/push/run-summary"
```

(`notify` as a one-element array `["DIT Monitoring"]` is also fine.) Use that exact service name; do not invent aliases. Set **`push_url`** explicitly on native runs — there is no inbound envelope to copy it from. Do not rely on env fallbacks when you can stamp this URL on `_al`.

That is how Paperclip-native results reach DIT (Maintenance modal) **through Access Layer**. Do **not** skip `notify` and do **not** POST ingest yourself. Do **not** add Slack (or any chat service) to `notify` — that would dump the run into a DM. `_al.summary` stays the short human text on the push; Slack **command** DMs only apply when the run came from AL (pending `gateway_request_id`).

**When the run came from AL** (inbound `_al` / `meta` with AL `gateway_request_id`, `source: "access-layer"`, etc.): do **not** add `notify` for this reason — AL already delivers via the command’s Result recipients. Preserve inbound **`push_url`** (and `notify` only if already present).

## Steps

### A. Resolve the business result

1. If a JSON object was produced (domain skills or routine handoff) → use it as-is.
2. For Support `/audit` / weekly-health: the business object **must** be the **DIT Monitoring ingest JSON** (`run_id` UUID, `check_type`, `client`, `site`, **`timestamp`**, **`last_run_at`**, **`verdict`** (`pass`|`warn`|`fail`|`unknown` only — map rollup **`watch` → `warn`**, never send `watch`), **`site_status`** (required), **`report_json_url`** (required top-level URL to parent rollup `findings.json`, not child frontend JSON and not only in `_sync`), `findings`, optional `plugins` / `themes` / `frontend_audit`, optional top-level **`diff`** from **`dit-ingest-diff`**, required `_sync`, …). The orchestrator must apply **`support-maintenance-orchestration`** → `references/report-contract.md` → **DIT Monitoring ingest mapping**, then **`dit-ingest-diff`** when a previous ingest exists, before handoff (severity `warning` → `medium`, `update` boolean → `"none"`, required timestamps). Access Layer forwards that object to DIT (`POST /api/external/v1/access-layer/runs`). That is what the Maintenance project modal renders. Map **full** specialist JSON (no compact stubs). Do **not** wrap the ingest object in `{ body }`, `{ payload }`, or the AL run-summary envelope; `payload.processed` in the push body **is** that ingest object (plus `_al`). Do **not** POST the ingest to DIT from Paperclip. **AL HTTP 2xx does not guarantee DIT accepted the payload** — DM may still return 422 on validation. **Do not skip this push when `diff` is missing.**
3. If there is **no** usable result → create `{ "_al": {} }` and set `empty_result: true` later. Optional agent/routine/issue context goes **inside `_al` only**.
4. Do **not** modify `_sync` or any monitoring / business fields. `_sync` is required on the ingest object; leave it as built with the specialist mapping.

### B. Merge `_al`

5. Start from existing `result._al` if present; otherwise `{}`.
6. Ensure correlation ids, `agent_id`, `company_id`, `command`, `pushed_at`, `source`, `direction`, and keep `push_url` when known.
7. If this is a **Paperclip-native** run (not from AL / no service caller), set `notify` to `"DIT Monitoring"` and `push_url` to `https://dit-al.designingit.co/api/push/run-summary` (see above). If the run came from AL, leave `notify` as already present or omit it and preserve inbound `push_url`.
8. Always set `summary` from `slack-summary.txt` when present (see above); generate the fallback if missing.
9. Set `empty_result: true` when step A used the minimal shell.
10. Set **`hasDiff`**: `true` when `result.diff` is a non-empty object; otherwise `false`. Absence of `diff` does not change `empty_result` and does not skip the push.
11. Assign `result._al =` merged object. Touch nothing else.

### C. Resolve auth token

Resolve `AL_INBOUND_TOKEN` in this order (first hit wins):

1. **Top-level orchestrator** — the agent assigned to the Paperclip routine (or otherwise the highest agent in the hierarchy above all other agents in this run). Prefer this agent’s secrets.
2. **AL Gateway** — the agent that owns only the AL bookend skills (`al-parse-command`, `al-push-result`).
3. **Current running agent**, then any other agents in the run that expose the secret.
4. If missing → comment an error on the issue and stop the push (do not invent a token).

### D. Resolve push URL

Resolve the POST URL in this order:

1. **`_al.push_url`** from the inbound envelope / merged `_al` (AL stamps this on AL-originated runs; **Paperclip-native** runs must set `https://dit-al.designingit.co/api/push/run-summary` on `_al` — see **notify and push_url** above).
2. **`AL_CALLBACK_URL`** on the current agent (or orchestrator) — optional **full URL override** (tunnels, alternate hosts). Not read by AL server code.
3. If env `ACCESS_LAYER_PUBLIC_URL` exists: `{ACCESS_LAYER_PUBLIC_URL}/api/push/run-summary`.
4. If none → comment an error; do not guess localhost or production hosts.

#### What is `AL_CALLBACK_URL`?

Optional Paperclip-side override of the push endpoint. Normally **omit it**: AL already puts the correct URL in `_al.push_url`. Use `AL_CALLBACK_URL` only when the stamped URL is unreachable from Paperclip (e.g. temporary tunnel) and you must force another absolute URL.

### E. Push to Access Layer

12. `POST` the resolved URL with headers:

```
Authorization: Bearer <AL_INBOUND_TOKEN>
Content-Type: application/json
```

13. Body:

```json
{
  "runId": "<paperclip-run-id or al_push_<request_id>>",
  "agentId": "<paperclip-agent-id>",
  "companyId": "<paperclip-company-id>",
  "checkType": "<from result.check_type when present, else null>",
  "status": "completed",
  "summary": "<same string as _al.summary>",
  "payload": {
    "processed": { },
    "request_id": "<from _al.request_id>",
    "meta": {
      "request_id": "<from _al.request_id>",
      "gateway_request_id": "<from _al.gateway_request_id>",
      "agent_id": "<agent id>",
      "company_id": "<company id>",
      "finished_at": "<ISO-8601>"
    }
  },
  "finishedAt": "<ISO-8601>"
}
```

`payload.processed` = **full ingest JSON** including `_al` (file links stay URLs; no file bytes). `runId` on the wrapper may be a Paperclip issue id; **`processed.run_id` must be a UUID** (DIT ingest requires it).

On failure of the run use `"status": "error"` but still push when possible.

The top-level `"summary"` field **must equal** `_al.summary` (the Slack DM text when AL originated the command; for Paperclip-native it is still the short human summary on the AL push, not a Slack DM).

14. HTTP 2xx → optional issue comment: `Pushed result to Access Layer`.
15. Non-2xx → warn on the issue; do not fail the Paperclip run solely because of AL HTTP errors.
16. Never put tokens or secrets into the JSON or issue text.

## What AL does after receive

- Persists `RunSummary`.
- Reads correlation from `_al`.
- Enriches **only** `_al` (`received_at`, `delivered_at`, …).
- Delivers to command-route recipients when `gateway_request_id` matches a pending request.
- Also POSTs to HTTP services listed in `_al.notify` (by service name), even with no pending request.
- HTTP Result recipient **DIT Monitoring** POSTs `payload.processed` (the ingest JSON) to `/api/external/v1/access-layer/runs` — that fills the Maintenance project modal.
- Slack / DM (AL-originated commands only) uses `_al.summary` (`slack-summary.txt`), not the JSON. Paperclip-native runs must **not** land in Slack DM — use `notify`: `"DIT Monitoring"` and stamp `push_url`: `https://dit-al.designingit.co/api/push/run-summary`.

## Environment / secrets

| Name | Required | Purpose |
| --- | --- | --- |
| `AL_INBOUND_TOKEN` | Yes (top-level orchestrator, then AL Gateway, then others) | Bearer for push |
| `AL_CALLBACK_URL` | No | Full push URL override if `_al.push_url` unusable |
| `ACCESS_LAYER_PUBLIC_URL` | No | Base URL fallback to build push path |

## Rules

- Only mutate `_al` on the result object.
- Never touch `_sync`.
- Always push, even for empty results.
- Always set `_al.hasDiff` (`true` / `false`). Missing ingest `diff` is not an error and does not block the push.
- Always include `_al.summary` (Slack-readable; prefer `slack-summary.txt` for `/audit`).
- Support `/audit` business JSON is DIT ingest shape so the Maintenance modal can render it.
- Always preserve inbound request ids.
- For Paperclip-native runs (not via AL), set `_al.notify` to `"DIT Monitoring"` and `_al.push_url` to `https://dit-al.designingit.co/api/push/run-summary`.
- Prefer `_al.push_url`; use `AL_CALLBACK_URL` only as override.
- Token: top-level orchestrator → AL Gateway → current / other agents.
- Files are links only — never base64/file bodies in the push.
