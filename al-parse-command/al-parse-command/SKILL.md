# Skill: al-parse-command

Universal **inbound** skill for Access Layer–driven Paperclip agents.

Works in both setups:

- **Domain agent** (AL called agents) — first skill; then domain skills; then `al-push-result`.
- **Access Layer Gateway Orchestrator** (AL called routines) — first of two skills only; then collect domain result; then `al-push-result`.

Parses the command envelope and exposes context. Does **not** call Access Layer and does **not** build the final business result.

## When to use

Always at the **start** of a run when Access Layer started it. On a **routine** route the envelope is this run’s `triggerPayload` / `payload`: `{ input, meta, _al }`. It is not a fenced JSON block in the issue, and it does not depend on assignee or `originKind`. On a **direct agent** dispatch the same object is a fenced JSON block in the issue description.

**Do not run this skill** when the routine was started inside Paperclip (manual or schedule) with **no** Access Layer envelope. There is nothing to parse; inventing `_al` / `gateway_request_id` would make Access Layer treat the later push as a command Result and dump the payload into Slack DM. Paperclip-native runs skip this skill, do domain work, then **`al-push-result`** with `_al.notify`: `"DIT Monitoring"` and `_al.push_url`: `https://dit-al.designingit.co/api/push/run-summary`.

## Envelope shape (from AL)

```json
{
  "input": {
    "command": "audit",
    "alNative": false,
    "project": {
      "id": "<paperclip-project-id>",
      "name": "Project name",
      "alias": "example-project"
    },
    "flags": ["front"],
    "serviceFlags": [],
    "scopes": ["front"],
    "params": [],
    "messages": []
  },
  "meta": {
    "request_id": "req_…_<agentPrefix>",
    "gateway_request_id": "req_…",
    "sent_at": "…",
    "source": "access-layer-incoming",
    "agent_id": "<paperclip-agent-id>",
    "command": "audit"
  },
  "_al": {
    "request_id": "req_…_<agentPrefix>",
    "gateway_request_id": "req_…",
    "agent_id": "<paperclip-agent-id>",
    "company_id": "<paperclip-company-id>",
    "routine_id": null,
    "command": "audit",
    "summary": "Command /audit for example-project",
    "push_url": "https://example.com/api/push/run-summary",
    "sent_at": "…",
    "source": "access-layer",
    "direction": "inbound"
  }
}
```

Prefer **`_al`** for correlation and **`_al.push_url`** for the later push. Keep legacy `meta` if present; recover `_al` from `meta` when missing.

## Steps

1. On a routine run, read `triggerPayload` / `payload` first (`input` + `_al`). On a direct agent issue, read the fenced ` ```json ` block in the description. Do not treat the routine’s stored `selected_checks` document as the AL envelope.
2. Parse JSON. Require at least `input` (object). Prefer `_al`; if missing, build a working `_al` from `meta` and note that it was recovered.
3. Do **not** invent new `request_id` / `gateway_request_id`.
4. Remember `push_url` from `_al` for **al-push-result** (do not strip it).
5. Detect origin for later push:
   - **From AL** — envelope has AL-stamped `_al` / `meta` with `gateway_request_id` and `source: "access-layer"` (or equivalent) from an Access Layer dispatch.
   - **No AL envelope** — stop this skill immediately. Do not invent `_al` or `gateway_request_id`. The run is Paperclip-native; **al-push-result** sets `notify` (see that skill).
6. Publish a short structured context for later skills, for example:

```json
{
  "al": {
    "input": {},
    "meta": {},
    "_al": {},
    "brief": "Command /audit on example-project; flags: front",
    "audit": {},
    "role": "domain | orchestrator",
    "origin": "access-layer | paperclip-native"
  }
}
```

Set `role` to `orchestrator` when this agent has **only** the AL bookend skills (AL Gateway). Set `domain` when domain skills will run next. Set `origin` to `paperclip-native` when there was no AL inbound command.

7. Field meanings:
   - `input.command` — slash command without `/`
   - `input.alNative` — `true` only for Access Layer–native command `al`; Paperclip domain routes are always `false`
   - `input.project` — resolved project (`id`, `name`, `alias`)
   - `input.flags` / `serviceFlags` / `scopes` / `params` / `messages` — as stamped by AL
   - `_al.*` — correlation + `push_url`; pass through until **al-push-result**

   If `input.alNative` is `true`, this run is a gateway-native AL command (not a normal Paperclip domain dispatch). Domain agents should not see that for ordinary routes.

8. When `input.command` is `audit`, build an **`audit` plan** and include it on the published context. Do **not** invent findings — only map flags to checks and agents.

   Normalize `input.flags` (and `input.scopes` if flags are empty): strip a leading `--`, lowercase, drop blanks. Area flags: `front`, `cms`, `seo`. `infra` is not an area (drop it; do not treat it as a CMS subtype). CMS subtype: the first remaining flag that matches `^[a-z][a-z0-9-]*$` (examples: `wordpress`, `craft`, `ee`). A subtype without `--cms` still implies the CMS area. `seo` is its own area, not a CMS subtype.

   Empty flags mean CMS + front + SEO. Any area flag **limits** the run to the named areas (so `--seo` is SEO only). Combine flags the same way (`--front --seo` is those two, not the full set).

   | Inbound flags | Areas | CMS subtype | `selected_checks` |
   | --- | --- | --- | --- |
   | *(none)* — audit **All** | `cms` + `front` + `seo` | unset (routine/project default) | CMS check + `frontend-audit` + `seo-baseline` |
   | `--front` | `front` | — | `frontend-audit` |
   | `--cms` | `cms` | unset | CMS check only |
   | `--seo` | `seo` | — | `seo-baseline` |
   | `--cms --wordpress` (or `--wordpress`) | `cms` | `wordpress` | `wordpress-basic` |
   | `--cms --craft` (or `--craft`) | `cms` | `craft` | `craft-cms-audit` |
   | `--front --cms` | `cms` + `front` | unset | CMS check + `frontend-audit` |
   | `--cms --seo` | `cms` + `seo` | unset | CMS check + `seo-baseline` |
   | `--front --seo` | `front` + `seo` | — | `frontend-audit` + `seo-baseline` |
   | `--front --cms --seo` | all three | unset | CMS check + `frontend-audit` + `seo-baseline` |
   | `--infra` | *(dropped)* | — | Do not add `server-infra-basic`. Comment that this routine does not run infra |

   CMS check + agent when the CMS area is on:

   | `cms_subtype` | Check | Required agent |
   | --- | --- | --- |
   | `wordpress` | `wordpress-basic` | **WordPress Health Audit Agent** |
   | `craft` | `craft-cms-audit` | **Craft CMS Health Audit Agent** |
   | unset | routine/project default | that CMS’s agent |
   | other known subtype (`ee`, …) | that platform’s check | that platform’s agent |

   **`--wordpress` assertion:** if this flag is present, the CMS child **must** be assigned to **WordPress Health Audit Agent** and the CMS check **must** be `wordpress-basic` (or another `wordpress-*` check). Do **not** create a Craft CMS child. If the routine cannot satisfy that (wrong project CMS, `--craft` also set, Craft-only routine), set `audit.ok` to `false` with a clear `audit.error` — still continue so **al-push-result** can push an empty `_al` error. Front-only (`--front` without CMS) plus `--wordpress` **adds** the WordPress CMS check (the subtype means they asked for WP).

   Publish the plan on the context, for example:

   ```json
   {
     "al": {
       "input": {},
       "meta": {},
       "_al": {},
       "brief": "Command /audit on example-project; flags: cms, wordpress",
       "role": "domain | orchestrator",
       "origin": "access-layer | paperclip-native",
       "audit": {
         "ok": true,
         "error": null,
         "flags": ["cms", "wordpress"],
         "areas": ["cms"],
         "cms_subtype": "wordpress",
         "selected_checks": ["wordpress-basic"],
         "agents": {
           "cms": "WordPress Health Audit Agent",
           "front": null,
           "seo": null
         }
       }
     }
   }
   ```

   Domain / routine orchestration **must** use `audit.selected_checks` (do not ignore flags and always run the full suite).

9. Hand off:
   - **Domain agent** → domain skills (then they finish into **al-push-result**).
   - **Orchestrator / AL Gateway** → apply the audit plan, collect business JSON from routine / sibling agents (do not invent findings); then **al-push-result**.

## Rules

- Only explain / normalize inbound data; no business findings.
- For `/audit`, always publish the `audit` plan (areas, subtype, `selected_checks`, agents). Empty flags mean CMS + front + SEO, not “do nothing”. `--seo` alone is `seo-baseline` only. SEO agent: **SEO Baseline Agent**.
- Never drop or rewrite `_al.request_id` / `_al.gateway_request_id` / `_al.push_url`.
- Do not touch `_sync` or other non-`_al` result fields.
- If JSON parse fails: still produce an error context so **al-push-result** can push `{ "_al": … }`.
