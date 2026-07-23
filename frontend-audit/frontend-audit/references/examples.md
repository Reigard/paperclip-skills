# Front-end / Browser Health Agent — Filled Report Examples

## Example A — Single homepage, PASS (no baseline)

### findings/frontend-audit.json (excerpt)

```json
{
  "check": "frontend-audit",
  "verdict": "PASS",
  "generated_at": "2026-07-21T13:04:12Z",
  "target": {
    "issue": "SUP-4821-child-2",
    "environment": "development",
    "seed_url": "https://paperclip-test.designingit.co/",
    "crawl_manifest_path": null
  },
  "scope": {
    "mode": "single_page",
    "pages_requested": 1,
    "pages_audited": 1,
    "pages_blocked": 0
  },
  "summary": {
    "console_error_pages": 0,
    "failed_request_pages": 0,
    "broken_image_pages": 0,
    "poor_cwv_pages": 0,
    "third_party_issue_pages": 0,
    "accessibility_issue_pages": 0,
    "regression_count": 0,
    "critical_findings": 0,
    "high_findings": 0,
    "warning_findings": 0,
    "red_flags": 0
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/",
      "final_url": "https://paperclip-test.designingit.co/",
      "http_status": 200,
      "title": "Paperclip Test Site",
      "status": "audited",
      "viewport_results": [
        {
          "viewport": "1440x1100",
          "screenshot": "artifacts/frontend-audit/home-desktop.png",
          "console_error_count": 0,
          "failed_request_count": 0
        },
        {
          "viewport": "390x844",
          "screenshot": "artifacts/frontend-audit/home-mobile.png",
          "console_error_count": 0,
          "failed_request_count": 0
        }
      ],
      "console_errors": [],
      "failed_requests": [],
      "broken_images": [],
      "core_web_vitals": {
        "lcp_ms": 1840,
        "cls": 0.04,
        "inp_ms": 180,
        "tbt_ms": 120,
        "source": "lab_trace",
        "rating": "good"
      },
      "performance": {
        "lighthouse_performance_score": 92,
        "long_task_count": 0,
        "trace_available": true
      },
      "third_party_scripts": [
        {
          "vendor": "Google Tag Manager",
          "url": "https://www.googletagmanager.com/gtm.js",
          "status": "ok",
          "detail": "Loaded without console errors"
        }
      ],
      "accessibility": {
        "lighthouse_accessibility_score": 96,
        "issues": []
      },
      "screenshots": {
        "desktop": "artifacts/frontend-audit/home-desktop.png",
        "mobile": "artifacts/frontend-audit/home-mobile.png"
      }
    }
  ],
  "findings": [
    {
      "severity": "info",
      "category": "frontend",
      "title": "Homepage passed browser health checks",
      "evidence": "chrome-devtools-mcp: zero console errors, zero failed requests, CWV good on desktop and mobile.",
      "recommendation": "No action required.",
      "owner": "agency",
      "follow_up": false,
      "red_flag": false,
      "page_url": "https://paperclip-test.designingit.co/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "browser-smoke"
    }
  ],
  "baseline_comparison": {
    "available": false,
    "regressions": []
  },
  "tooling": {
    "browser_tool": "chrome-devtools-mcp",
    "browser_tool_available": true,
    "lighthouse_available": true
  },
  "human_verification": [
    {
      "item": "Forms submit to correct destination?",
      "owner": "agency",
      "due": null
    },
    {
      "item": "Analytics (GA4/GTM) firing in network tab?",
      "owner": "agency",
      "due": null
    }
  ]
}
```

---

## Example B — Multi-page crawl, FAIL (console error + CWV regression on homepage)

### findings/frontend-audit.json (excerpt)

```json
{
  "check": "frontend-audit",
  "verdict": "FAIL",
  "generated_at": "2026-07-21T14:22:00Z",
  "target": {
    "issue": "SUP-4900-child-3",
    "environment": "production",
    "seed_url": "https://paperclip-test.designingit.co/",
    "crawl_manifest_path": "artifacts/frontend-crawl-manifest.json"
  },
  "scope": {
    "mode": "site_crawl",
    "pages_requested": 5,
    "pages_audited": 4,
    "pages_blocked": 1
  },
  "summary": {
    "console_error_pages": 2,
    "failed_request_pages": 1,
    "broken_image_pages": 0,
    "poor_cwv_pages": 1,
    "third_party_issue_pages": 1,
    "accessibility_issue_pages": 0,
    "regression_count": 2,
    "critical_findings": 0,
    "high_findings": 2,
    "warning_findings": 1,
    "red_flags": 2
  },
  "pages": [
    {
      "url": "https://paperclip-test.designingit.co/",
      "final_url": "https://paperclip-test.designingit.co/",
      "http_status": 200,
      "title": "Home",
      "status": "audited",
      "console_errors": [
        {
          "level": "error",
          "message": "Uncaught TypeError: app.init is not a function",
          "source": "main.js:88"
        }
      ],
      "failed_requests": [],
      "broken_images": [],
      "core_web_vitals": {
        "lcp_ms": 4200,
        "cls": 0.05,
        "inp_ms": 220,
        "tbt_ms": 680,
        "source": "lab_trace",
        "rating": "poor"
      },
      "third_party_scripts": [
        {
          "vendor": "Intercom",
          "url": "https://widget.intercom.io/widget.js",
          "status": "slow",
          "detail": "Long task 420ms after load"
        }
      ],
      "viewport_results": []
    },
    {
      "url": "https://paperclip-test.designingit.co/about/",
      "final_url": "https://paperclip-test.designingit.co/about/",
      "http_status": 200,
      "title": "About",
      "status": "audited",
      "console_errors": [
        {
          "level": "error",
          "message": "Uncaught ReferenceError: analytics is not defined",
          "source": "about.js:42"
        }
      ],
      "failed_requests": [
        {
          "url": "https://paperclip-test.designingit.co/wp-content/uploads/missing-hero.webp",
          "status": 404,
          "resource_type": "image"
        }
      ],
      "broken_images": [],
      "viewport_results": []
    }
  ],
  "findings": [
    {
      "severity": "high",
      "category": "frontend",
      "title": "JavaScript console error on homepage",
      "evidence": "Uncaught TypeError: app.init is not a function (main.js:88)",
      "recommendation": "Fix init call or bundle load order before next deploy.",
      "owner": "dev",
      "follow_up": true,
      "red_flag": true,
      "page_url": "https://paperclip-test.designingit.co/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "browser-smoke"
    },
    {
      "severity": "high",
      "category": "frontend",
      "title": "CWV regression on homepage after deploy",
      "evidence": "LCP 4200ms (was 1840ms); TBT 680ms (was 120ms). Baseline from 2026-07-14.",
      "recommendation": "Profile main thread and third-party scripts; compare bundle diff.",
      "owner": "dev",
      "follow_up": true,
      "red_flag": true,
      "page_url": "https://paperclip-test.designingit.co/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "regression"
    },
    {
      "severity": "warning",
      "category": "frontend",
      "title": "Blocked page during crawl: /members/",
      "evidence": "HTTP 302 to /wp-login.php — login gate.",
      "recommendation": "Provide credentials or exclude /members/ from crawl scope.",
      "owner": "agency",
      "follow_up": true,
      "red_flag": false,
      "page_url": "https://paperclip-test.designingit.co/members/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "browser-smoke"
    }
  ],
  "baseline_comparison": {
    "available": true,
    "baseline_generated_at": "2026-07-14T10:00:00Z",
    "baseline_source": "artifacts/prior-frontend-audit.json",
    "regressions": [
      {
        "type": "console_errors",
        "page_url": "https://paperclip-test.designingit.co/",
        "title": "New console error after deploy",
        "evidence": "Uncaught TypeError: app.init is not a function (main.js:88)",
        "red_flag": true
      },
      {
        "type": "cwv_degradation",
        "page_url": "https://paperclip-test.designingit.co/",
        "title": "LCP and TBT degraded vs baseline",
        "evidence": "LCP 4200ms (was 1840ms); TBT 680ms (was 120ms)",
        "red_flag": true
      }
    ]
  },
  "tooling": {
    "browser_tool": "chrome-devtools-mcp",
    "browser_tool_available": true,
    "lighthouse_available": true
  },
  "human_verification": []
}
```

---

## Example C — HTML report skeleton (self-contained)

The agent fills this template. Inline CSS only; no external dependencies. **No Figma section.**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Browser Health Audit — paperclip-test (development)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    .verdict-pass { color: #0a7; font-weight: bold; }
    .verdict-fail { color: #c00; font-weight: bold; }
    .verdict-blocked { color: #888; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .sev-critical { background: #fee; }
    .sev-high { background: #ffe8d0; }
    .sev-warning { background: #fff8e0; }
    .red-flag { font-weight: bold; color: #c00; }
    .screenshots img { max-width: 320px; border: 1px solid #ccc; margin: 0.5rem; }
    .human-verify { background: #f0f4ff; padding: 1rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Front-end / Browser Health Audit</h1>
  <p><strong>Verdict:</strong> <span class="verdict-pass">PASS</span></p>
  <p><strong>Tool:</strong> chrome-devtools-mcp</p>
  <p><strong>Issue:</strong> SUP-4821-child-2</p>
  <p><strong>Environment:</strong> development</p>
  <p><strong>Seed URL:</strong> https://paperclip-test.designingit.co/</p>
  <p><strong>Scope mode:</strong> single_page — 1/1 pages audited</p>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Console error pages</td><td>0</td></tr>
    <tr><td>Failed request pages</td><td>0</td></tr>
    <tr><td>Poor CWV pages (lab)</td><td>0</td></tr>
    <tr><td>Regressions vs baseline</td><td>0</td></tr>
    <tr><td>Red flags</td><td>0</td></tr>
  </table>

  <h2>Baseline comparison</h2>
  <p><em>No prior audit baseline available.</em></p>

  <h2>Pages</h2>
  <table>
    <tr>
      <th>URL</th><th>Status</th><th>HTTP</th>
      <th>Console errors</th><th>Failed requests</th><th>CWV (lab)</th>
    </tr>
    <tr>
      <td>https://paperclip-test.designingit.co/</td>
      <td>audited</td><td>200</td>
      <td>0</td><td>0</td>
      <td>LCP 1840ms, CLS 0.04, INP 180ms, TBT 120ms — good</td>
    </tr>
  </table>

  <h2>Findings</h2>
  <table>
    <tr><th>Severity</th><th>Red flag</th><th>Page</th><th>Title</th><th>Evidence</th></tr>
    <tr class="sev-warning">
      <td>info</td><td>—</td><td>/</td>
      <td>Homepage passed browser health checks</td>
      <td>Zero console errors; CWV good.</td>
    </tr>
  </table>

  <section class="human-verify">
    <h2>⚠️ Human Verification Required</h2>
    <ul>
      <li>Analytics (GA4/GTM) firing in network tab? <strong>Owner:</strong> agency</li>
    </ul>
  </section>
</body>
</html>
```

Save as `reports/frontend-audit.html`. Screenshot paths are relative to the report file location.
