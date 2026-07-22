# Frontend Audit — Filled Report Examples

## Example A — Single homepage, PASS (no Figma)

### findings/frontend-audit.json (excerpt — full structure)

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
        "inp_ms": null,
        "source": "lab_trace",
        "rating": "good"
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
      "title": "Homepage loaded without console errors",
      "evidence": "Desktop and mobile viewports checked. Zero console errors, zero failed requests.",
      "recommendation": "No action required.",
      "owner": "agency",
      "follow_up": false,
      "red_flag": false,
      "page_url": "https://paperclip-test.designingit.co/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "browser-smoke"
    }
  ],
  "figma_comparison": {
    "status": "skipped",
    "skip_reason": "No Figma URL in issue scope.",
    "figma_url": null,
    "figma_node_id": null,
    "tool_available": false,
    "mismatches": []
  },
  "tooling": {
    "browser_tool": "chrome-devtools-mcp",
    "browser_tool_available": true,
    "lighthouse_available": false,
    "figma_mcp_available": false
  },
  "human_verification": [
    {
      "item": "Visual design approved by client?",
      "owner": "client",
      "due": null
    },
    {
      "item": "Forms submit to correct destination?",
      "owner": "agency",
      "due": null
    }
  ]
}
```

---

## Example B — Multi-page crawl, FAIL (console errors on /about)

### findings/frontend-audit.json (excerpt)

```json
{
  "check": "frontend-audit",
  "verdict": "FAIL",
  "generated_at": "2026-07-21T14:22:00Z",
  "target": {
    "issue": "SUP-4900-child-3",
    "environment": "development",
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
      "title": "JavaScript console error on /about/",
      "evidence": "Uncaught ReferenceError: analytics is not defined (about.js:42)",
      "recommendation": "Fix script load order or guard analytics call.",
      "owner": "dev",
      "follow_up": true,
      "red_flag": false,
      "page_url": "https://paperclip-test.designingit.co/about/",
      "source": "chrome-devtools-mcp",
      "evidence_type": "browser-smoke"
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
  "figma_comparison": {
    "status": "skipped",
    "skip_reason": "Figma URL provided but Figma MCP not available in agent session.",
    "figma_url": "https://www.figma.com/design/abc123/Site?node-id=1-2",
    "figma_node_id": "1:2",
    "tool_available": false,
    "mismatches": []
  },
  "tooling": {
    "browser_tool": "paperclip-qa-visual-check",
    "browser_tool_available": true,
    "lighthouse_available": true,
    "figma_mcp_available": false
  },
  "human_verification": []
}
```

---

## Example C — HTML report skeleton (self-contained)

The agent fills this template. Inline CSS only; no external dependencies.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Frontend Audit — paperclip-test (development)</title>
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
    .screenshots img { max-width: 320px; border: 1px solid #ccc; margin: 0.5rem; }
    .human-verify { background: #f0f4ff; padding: 1rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Frontend Audit Report</h1>
  <p><strong>Verdict:</strong> <span class="verdict-pass">PASS</span></p>
  <p><strong>Issue:</strong> SUP-4821-child-2</p>
  <p><strong>Environment:</strong> development</p>
  <p><strong>Seed URL:</strong> https://paperclip-test.designingit.co/</p>
  <p><strong>Scope mode:</strong> single_page — 1/1 pages audited</p>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Console error pages</td><td>0</td></tr>
    <tr><td>Failed request pages</td><td>0</td></tr>
    <tr><td>Broken image pages</td><td>0</td></tr>
    <tr><td>Poor CWV pages (lab)</td><td>0</td></tr>
    <tr><td>Critical / High / Warning findings</td><td>0 / 0 / 0</td></tr>
  </table>

  <h2>Tooling</h2>
  <table>
    <tr><th>Tool</th><th>Available</th></tr>
    <tr><td>Browser (chrome-devtools-mcp)</td><td>Yes</td></tr>
    <tr><td>Lighthouse</td><td>No</td></tr>
    <tr><td>Figma MCP</td><td>No — comparison skipped</td></tr>
  </table>

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
      <td>LCP 1840ms, CLS 0.04 — good</td>
    </tr>
  </table>

  <h2>Screenshots</h2>
  <div class="screenshots">
    <figure>
      <figcaption>Desktop 1440×1100</figcaption>
      <img src="../artifacts/frontend-audit/home-desktop.png" alt="Desktop screenshot">
    </figure>
    <figure>
      <figcaption>Mobile 390×844</figcaption>
      <img src="../artifacts/frontend-audit/home-mobile.png" alt="Mobile screenshot">
    </figure>
  </div>

  <h2>Findings</h2>
  <table>
    <tr><th>Severity</th><th>Page</th><th>Title</th><th>Evidence</th><th>Recommendation</th></tr>
    <tr class="sev-warning">
      <td>info</td>
      <td>/</td>
      <td>Homepage loaded without console errors</td>
      <td>Zero console errors on desktop and mobile.</td>
      <td>No action required.</td>
    </tr>
  </table>

  <h2>Figma Comparison (optional)</h2>
  <p><em>Skipped — no Figma URL in issue scope.</em></p>

  <section class="human-verify">
    <h2>⚠️ Human Verification Required</h2>
    <ul>
      <li>Visual design approved by client? <strong>Owner:</strong> client</li>
      <li>Forms submit to correct destination? <strong>Owner:</strong> agency</li>
    </ul>
  </section>
</body>
</html>
```

Save as `reports/frontend-audit.html`. Screenshot paths are relative to the report file location.
