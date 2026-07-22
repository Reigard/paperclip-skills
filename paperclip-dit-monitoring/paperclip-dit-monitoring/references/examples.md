# Examples

## Configuration resolution

Values are **not** guaranteed in shell `env`. Example resolution for a CCJ weekly routine:

| Variable | Resolved value | Source used |
| -------- | -------------- | ----------- |
| `DIT_MONITORING_INGEST_URL` | `https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs` | CCJ **project** plain env (or routine payload) |
| `DIT_MONITORING_INGEST_TOKEN` | *(redacted)* | Company secret **`dit_monitoring_ingest_token`** via CCJ project secret binding |
| `DIT_MONITORING_ID` | `9f6f85cb-94ec-465e-9712-c80ae71368d7` | CCJ **project** secret env |

Issue comment (no secrets):

```
DIT Monitoring: config from CCJ project env/secrets + company secret dit_monitoring_ingest_token.
```

Intake payload that supplies project id when project env is empty:

```json
{
  "client_slug": "lime",
  "project_slug": "website",
  "run_type": "maintenance-selected",
  "selected_checks": ["wordpress-basic", "server-infra-basic"],
  "dit_monitoring_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7"
}
```

---

## Environment (when explicitly set)

CCJ **client project** env (all ingest config on the issue project):

```bash
# Plain env
DIT_MONITORING_INGEST_URL=https://dit-monitoring.designingit.co/api/external/v1/paperclip/runs

# Project secrets
DIT_MONITORING_ID=9f6f85cb-94ec-465e-9712-c80ae71368d7
DIT_MONITORING_INGEST_TOKEN=<bound to company secret dit_monitoring_ingest_token>
```

Company secret (Support company settings):

```bash
dit_monitoring_ingest_token=<ingest bearer secret; operator-provisioned; must match DIT Monitoring server ingest auth>
```

---

## Payload before POST (_sync pending)

Use this shape **immediately before** the ingest POST. Do not pre-fill success flags.

```json
{
  "run_id": "7ca841e7-bee1-405d-9db5-d3c7c654e99b",
  "check_type": "maintenance",
  "client": "Lime",
  "site": "li.me",
  "timestamp": "2026-07-14T13:01:30.000Z",
  "last_run_at": "2026-07-14T13:01:30.000Z",
  "verdict": "warn",
  "site_status": "up",
  "http_status": 200,
  "response_ms": 842,
  "tls_days_left": 22,
  "tls_expires": "2026-08-05",
  "findings": [
    {
      "severity": "high",
      "title": "Public wp-config backup exposed",
      "detail": "Found wp-config.php.bak reachable without auth."
    },
    {
      "severity": "medium",
      "title": "TLS certificate expires in less than 30 days",
      "detail": "Certificate valid until 2026-08-05."
    },
    {
      "severity": "low",
      "title": "PageSpeed mobile below target",
      "detail": "Score 68; team target is 75."
    }
  ],
  "wp_version": "6.8.1",
  "plugin_count": 24,
  "pending_updates": 12,
  "plugins": [
    {
      "name": "Advanced Custom Fields Pro",
      "version": "6.2.5",
      "status": "active",
      "update": "available",
      "update_version": "6.2.7",
      "auto_update": "off",
      "last_update_check": "2026-07-12T11:13:00Z",
      "vulnerability_status": "no known issues"
    },
    {
      "name": "Yoast SEO",
      "version": "21.4",
      "status": "active",
      "update": "available",
      "update_version": "22.0",
      "auto_update": "off",
      "last_update_check": "2026-07-11T17:40:00Z",
      "vulnerability_status": "no known issues"
    },
    {
      "name": "WooCommerce",
      "version": "8.0.2",
      "status": "inactive",
      "update": "none",
      "update_version": null,
      "auto_update": "on",
      "last_update_check": "2026-07-12T08:22:00Z",
      "vulnerability_status": "patches available"
    },
    {
      "name": "WP Rocket",
      "version": "3.15.2",
      "status": "active",
      "update": "available",
      "update_version": "3.16.0",
      "auto_update": "off",
      "last_update_check": "2026-07-11T12:50:00Z",
      "vulnerability_status": "no known issues"
    },
    {
      "name": "Contact Form 7",
      "version": "5.8",
      "status": "active",
      "update": "none",
      "update_version": null,
      "auto_update": "on",
      "last_update_check": "2026-07-13T09:35:00Z",
      "vulnerability_status": "no known issues"
    }
  ],
  "themes": [
    {
      "name": "twentytwentyfour",
      "title": "Twenty Twenty-Four",
      "status": "active",
      "version": "1.2",
      "update": "available",
      "update_version": "1.3",
      "auto_update": "on",
      "last_update_check": "2026-07-12T11:13:00Z"
    },
    {
      "name": "twentytwentythree",
      "title": "Twenty Twenty-Three",
      "status": "inactive",
      "version": "1.5",
      "update": "none"
    },
    {
      "name": "twentytwentytwo",
      "title": "Twenty Twenty-Two",
      "status": "inactive",
      "version": "1.6",
      "update": "available",
      "update_version": "1.7",
      "auto_update": "off"
    },
    {
      "name": "lime-brand",
      "title": "Lime Brand Theme",
      "status": "child",
      "parent_theme": "designingit-base",
      "version": "2.4.1",
      "author": "designingIT",
      "update": "none",
      "update_version": null,
      "auto_update": "off"
    },
    {
      "name": "designingit-base",
      "title": "designingIT Base",
      "status": "parent",
      "version": "1.8.0",
      "author": "designingIT",
      "update": "available",
      "update_version": "1.9.0",
      "update_source": "private",
      "last_update_check": "2026-07-10T14:00:00Z"
    }
  ],
  "red_flags": ["Public wp-config backup exposed"],
  "secrets_exposed": false,
  "report_url": "https://paperclip.designingit.co/artifacts/SUP-XX/a1b2c3d4-final-report.html",
  "paperclip_issue_id": "SUP-XX",
  "report_json_url": "https://paperclip.designingit.co/artifacts/SUP-XX/e5f6g7h8-findings.json",
  "_sync": {
    "status": "pending",
    "dit_monitoring_project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "dit_monitoring_posted": false,
    "dit_monitoring_posted_at": null,
    "dit_monitoring_response_status": null,
    "errors": [],
    "warnings": []
  }
}
```

Note: TLS and PageSpeed items belong in `findings[]`, **not** in `_sync.warnings[]`.

When the WordPress check collected full inventory, include **`plugins[]`** and/or **`themes[]`** in this payload (see [SKILL.md — WordPress inventory arrays](../SKILL.md#wordpress-inventory-arrays-plugins-themes)). Omit those keys when only summary counts exist. Full field shapes: [schema.md](../schema.md#wordpress-inventory-plugins-themes).

Publish `findings.json` (or `dashboard-summary.json`) with `paperclip-publish-artifact` before ingest so `report_json_url` is a real Paperclip link.

---

## Full ingest payload (after successful POST)

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "check_type": "maintenance",
  "client": "Lime",
  "site": "example.com",
  "timestamp": "2026-07-14T08:00:00.000Z",
  "last_run_at": "2026-07-14T08:00:00.000Z",
  "verdict": "warn",
  "site_status": "up",
  "http_status": 200,
  "response_ms": 842,
  "tls_days_left": 45,
  "tls_expires": "2026-08-24",
  "findings": [
    {
      "severity": "medium",
      "title": "12 plugin updates pending",
      "detail": "Non-security updates available; security patches applied."
    },
    {
      "severity": "low",
      "title": "PageSpeed mobile 68",
      "detail": "Below team target of 75; no regression vs last month."
    }
  ],
  "wp_version": "6.8.1",
  "plugin_count": 24,
  "pending_updates": 12,
  "red_flags": [],
  "secrets_exposed": false,
  "report_url": "https://paperclip.designingit.co/artifacts/PAP-475/c4d5e6f7-final-report.html",
  "paperclip_issue_id": "PAP-475",
  "report_json_url": "https://paperclip.designingit.co/artifacts/PAP-475/8a9b0c1d-findings.json",
  "_sync": {
    "status": "success",
    "dit_monitoring_project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "dit_monitoring_posted": true,
    "dit_monitoring_posted_at": "2026-07-14T08:00:05.000Z",
    "dit_monitoring_response_status": 201,
    "errors": [],
    "warnings": []
  }
}
```

`plugin_count` is total installed plugins (24); `pending_updates` is how many have updates available (12). The **`plugins[]`** and **`themes[]`** arrays in the first example above are what DIT Monitoring uses for the **WordPress inventory** UI — include them in the ingest POST whenever the run collected that inventory; omit the keys when only counts or highlights exist (see [schema.md](schema.md#wordpress-inventory-plugins-themes)).

When **`frontend-audit`** ran, add **`frontend_audit`** from `findings/frontend-audit.json` (see [schema.md](schema.md#frontend-audit-object)). Example excerpt for a QA-only run:

```json
{
  "run_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "check_type": "qa",
  "client": "Example",
  "site": "example.com",
  "timestamp": "2026-07-21T13:04:12.000Z",
  "last_run_at": "2026-07-21T13:04:12.000Z",
  "verdict": "warn",
  "site_status": "up",
  "findings": [
    {
      "severity": "high",
      "title": "Console errors on /about/",
      "detail": "Uncaught ReferenceError in main.js on the About page."
    }
  ],
  "report_json_url": "https://paperclip.designingit.co/artifacts/SUP-4821/a1b2-findings.json",
  "frontend_audit": {
    "verdict": "fail",
    "generated_at": "2026-07-21T13:04:12Z",
    "environment": "development",
    "seed_url": "https://example.com/",
    "scope_mode": "site_crawl",
    "pages_requested": 5,
    "pages_audited": 4,
    "pages_blocked": 1,
    "summary": {
      "console_error_pages": 1,
      "failed_request_pages": 1,
      "broken_image_pages": 0,
      "poor_cwv_pages": 0,
      "critical_findings": 0,
      "high_findings": 1,
      "warning_findings": 1,
      "red_flags": 0
    },
    "pages": [
      {
        "url": "https://example.com/",
        "final_url": "https://example.com/",
        "http_status": 200,
        "title": "Example homepage",
        "status": "audited",
        "console_error_count": 0,
        "failed_request_count": 0,
        "broken_image_count": 0,
        "core_web_vitals": {
          "lcp_ms": 1840,
          "cls": 0.04,
          "inp_ms": null,
          "source": "lab_trace",
          "rating": "good"
        },
        "desktop_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-4821/c3d4-home-desktop.png",
        "mobile_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-4821/e5f6-home-mobile.png"
      },
      {
        "url": "https://example.com/about/",
        "final_url": "https://example.com/about/",
        "http_status": 200,
        "title": "About",
        "status": "audited",
        "console_error_count": 2,
        "failed_request_count": 1,
        "broken_image_count": 0,
        "console_errors": [
          { "message": "Uncaught ReferenceError: initMap is not defined", "source": "https://example.com/assets/main.js" },
          { "message": "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT" }
        ],
        "failed_requests": [
          { "url": "https://example.com/assets/analytics.js", "status": 404, "resource_type": "script" }
        ],
        "core_web_vitals": {
          "lcp_ms": 2100,
          "cls": 0.06,
          "inp_ms": null,
          "source": "lab_trace",
          "rating": "good"
        },
        "desktop_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-4821/g7h8-about-desktop.png",
        "mobile_screenshot_url": "https://paperclip.designingit.co/artifacts/SUP-4821/i9j0-about-mobile.png"
      },
      {
        "url": "https://example.com/contact/",
        "final_url": "https://example.com/contact/",
        "http_status": 403,
        "title": "Contact",
        "status": "blocked",
        "blocked_reason": "HTTP 403 — staging IP allowlist",
        "console_error_count": 0,
        "failed_request_count": 0,
        "broken_image_count": 0
      }
    ],
    "findings": [
      {
        "severity": "high",
        "title": "Console errors on /about/",
        "evidence": "Uncaught ReferenceError in main.js on the About page.",
        "recommendation": "Fix initMap reference or guard map init when container absent.",
        "page_url": "https://example.com/about/",
        "owner": "dev"
      },
      {
        "severity": "warning",
        "title": "Missing analytics script",
        "evidence": "GET /assets/analytics.js returned 404.",
        "recommendation": "Restore analytics bundle or remove stale script tag.",
        "page_url": "https://example.com/about/",
        "owner": "agency"
      }
    ],
    "human_verification": [
      { "item": "Confirm hero spacing against signed-off Figma on production", "owner": "agency", "due": "2026-07-28T17:00:00Z" }
    ],
    "tooling": {
      "browser_tool": "chrome-devtools-mcp",
      "browser_tool_available": true,
      "lighthouse_available": true,
      "figma_mcp_available": true
    },
    "figma_comparison": {
      "status": "completed",
      "skip_reason": null,
      "figma_url": "https://www.figma.com/design/example-file/Example?node-id=1-2",
      "figma_node_id": "1:2",
      "mismatch_count": 2,
      "mismatches": [
        {
          "area": "hero spacing",
          "expected": "64px padding per Figma",
          "observed": "~24px on implementation",
          "severity": "warning"
        },
        {
          "area": "primary CTA",
          "expected": "Filled button per Figma",
          "observed": "Text link only on mobile",
          "severity": "high"
        }
      ]
    },
    "browser_tool": "chrome-devtools-mcp",
    "report_url": "https://paperclip.designingit.co/artifacts/SUP-4821/k1l2-frontend-audit.html",
    "report_json_url": "https://paperclip.designingit.co/artifacts/SUP-4821/m3n4-frontend-audit.json"
  },
  "_sync": {
    "status": "pending",
    "dit_monitoring_project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "dit_monitoring_posted": false,
    "dit_monitoring_posted_at": null,
    "dit_monitoring_response_status": null,
    "errors": [],
    "warnings": []
  }
}
```

---

## API response (success)

```json
{
  "runId": "7ca841e7-bee1-405d-9db5-d3c7c654e99b",
  "projectId": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
  "matched": true,
  "run": {
    "runId": "7ca841e7-bee1-405d-9db5-d3c7c654e99b",
    "projectId": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "client": "Lime",
    "site": "li.me",
    "verdict": "warn",
    "siteStatus": "up"
  }
}
```

`run` object is abbreviated; the API returns the full stored record.

---

## Minimal payload

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "check_type": "maintenance",
  "client": "Lime",
  "site": "example.com",
  "timestamp": "2026-07-14T08:00:00.000Z",
  "last_run_at": "2026-07-14T08:00:00.000Z",
  "verdict": "pass",
  "site_status": "up",
  "findings": [],
  "report_json_url": "https://paperclip.designingit.co/artifacts/SUP-42/f9e8d7c6-findings.json",
  "_sync": {
    "status": "pending",
    "dit_monitoring_project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "dit_monitoring_posted": false,
    "dit_monitoring_posted_at": null,
    "dit_monitoring_response_status": null,
    "errors": [],
    "warnings": []
  }
}
```

---

## Missing configuration (non-blocking)

When URL or token cannot be resolved:

```json
{
  "_sync": {
    "status": "partial",
    "dit_monitoring_project_id": null,
    "dit_monitoring_posted": false,
    "errors": [],
    "warnings": [
      "DIT Monitoring ingest skipped: DIT_MONITORING_INGEST_TOKEN not resolved (checked company secret dit_monitoring_ingest_token, CCJ project secret env, wake injection)"
    ]
  }
}
```

Issue comment:

```
DIT Monitoring sync skipped — ingest token not found. Maintenance run is complete.
Checked: CCJ project env/secrets, company secret dit_monitoring_ingest_token, routine payload (id/url only).
```

---

## Ingest failure (non-blocking)

After a failed POST, update `_sync` for the issue comment — do not fail the maintenance run:

```json
{
  "_sync": {
    "status": "partial",
    "dit_monitoring_project_id": "9f6f85cb-94ec-465e-9712-c80ae71368d7",
    "dit_monitoring_posted": false,
    "dit_monitoring_posted_at": null,
    "dit_monitoring_response_status": 503,
    "errors": [],
    "warnings": [
      "DIT Monitoring ingest POST failed: HTTP 503 Service Unavailable"
    ]
  }
}
```

Issue comment:

```
DIT Monitoring sync failed (HTTP 503). Maintenance run is complete.
Project ID: 9f6f85cb-94ec-465e-9712-c80ae71368d7
Retry ingest manually or on next scheduled job.
```

---

## Wrong request shape (do not use)

Some HTTP tools wrap the body — the ingest API expects the run object at the root:

```json
{
  "body": { "run_id": "...", "client": "Lime" },
  "query": {},
  "params": {}
}
```

Send the inner object directly instead.

---

## Verify project (curl)

```bash
curl -fsS \
  -H "Authorization: Bearer $DIT_MONITORING_INGEST_TOKEN" \
  "https://dit-monitoring.designingit.co/api/external/v1/paperclip/projects/$DIT_MONITORING_ID"
```

---

## Ingest POST (curl)

```bash
curl -fsS -X POST "$DIT_MONITORING_INGEST_URL" \
  -H "Authorization: Bearer $DIT_MONITORING_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d @paperclip-report.json
```

Do not run with real tokens in shared logs. Use env vars on the Paperclip agent host only.
