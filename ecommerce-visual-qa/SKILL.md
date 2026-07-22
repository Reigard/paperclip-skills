---
name: ecommerce-visual-qa
description: Run fail-closed Agency OS flow QA for eCommerce and transactional environments. Exercises shopping carts, checkouts, and critical lead capture forms in staging environments (sandbox only) without processing real transactions. Use when the maintenance orchestrator requests a flow-smoke-basic check for an eCommerce client.
---

# eCommerce Visual QA

Use this skill when QA must verify critical transactional workflows (e.g., add to cart, checkout, form submissions) after a WordPress/plugin update.

## Core Rule

QA is a gate, not a summary. If the checkout, payment fields, or add-to-cart actions fail to behave correctly on staging, return `FAIL` and `red_flag: true`. Do not pass if the site relies on untested functionality.

Allowed verdicts:
- `PASS`: All transactional flows execute correctly in a sandbox environment.
- `FAIL`: A critical flow is broken, blocking checkout or form submission.
- `BLOCKED`: The environment is unreachable, credentials are missing, or access preflight fails.

Never use `PASS with gaps`, `PASS pending`, or `probably passed`.

## Step 1: Load the Flow Config

Before doing anything else, locate and read the client's flow configuration:

```
ecommerce-visual-qa/config/flow-smoke-basic.json
```

Where `<client-slug>` comes from the issue payload (`client_slug` field). If the file does not exist, stop immediately with verdict `BLOCKED` and state the exact missing path. Do not guess flows or hardcode URLs.

## Step 2: Access Preflight

Before exercising any flow, verify the staging base URL is reachable:

1. Read `staging_auth` from the flow config. If `type` is `basic`:
   - Resolve `username_ref` and `password_ref` via the 1Password CLI (`op read <ref>`) or the configured runtime auth helper.
   - Pass the resolved credentials to the browser session as HTTP Basic Auth before any navigation.
   - Never print or log the resolved credential values.

2. Attempt to load the first `startUrl` from `critical_flows[0]`. Check the HTTP response:
   - `200` or valid page content → proceed to flow execution.
   - `401 Unauthorized` → credentials missing or wrong. Verdict: `BLOCKED`. Do not attempt further flows.
   - `404` or `5xx` → environment down. Verdict: `BLOCKED`.
   - Password-gate or maintenance page → Verdict: `BLOCKED`.

If preflight fails, write a `BLOCKED` finding and stop. Do not create a specialist child or consume more turns attempting flows that cannot execute.

## Step 3: Execute Each Critical Flow

For each flow defined in `critical_flows`:

1. Navigate to `startUrl` using Chrome DevTools MCP or Playwright.
2. Execute each step defined in `steps` in order.
3. After each step, capture:
   - **Screenshot** of the current page state.
   - **Console log** — list all errors and warnings.
   - **Network log** — list any failed requests (4xx, 5xx) or blocked resources.
4. Evaluate the step result against `pass_criteria` and `fail_criteria`:
   - All pass criteria met → step PASS.
   - Any fail criterion triggered → step FAIL. Stop the flow immediately.

### Payment Boundary Rule

When a flow reaches the checkout/payment step:

- Check for `payment_sandbox.expected_indicators` in the page content (text, badge, or Stripe/PayPal test mode signals).
- If a test-mode indicator is found → record as PASS for the payment step.
- If **no** test-mode indicator is found AND a live payment form is present → verdict `FAIL` with `red_flag: true`. Reason: live payment gateway on staging.
- If the payment page does not render at all (fields missing, "No payment methods" message, JS error) → verdict `FAIL` with `red_flag: true`.
- Per `payment_sandbox.boundary: stop_at_render`: **never click Pay, submit payment, or enter real card data**. Verify render only.
- If the staging site has no payment plugin configured → record finding `payment_sandbox_not_configured` with severity `warning`, not `FAIL`. Flag what must be set up to test deeper.

### Contact / Form Flow Rule

For contact or registration forms:
- Use test data only. Use `qa-test@agency.internal` as the test email address.
- Do not submit forms that create real accounts, trigger real email delivery, or write to production systems.
- Verify only that the form renders, accepts input, and returns a visible confirmation message.

## Step 4: Write Reports

After all flows are complete (or after the first FAIL/BLOCKED), write the output files.

### `findings/flow-smoke-basic.json`

```json
{
  "run_id": "<task-folder-name>",
  "client_slug": "<client>",
  "project_slug": "<project>",
  "check": "flow-smoke-basic",
  "status": "completed",
  "summary": "<one sentence overall result>",
  "report_path": "ecommerce-visual-qa/reports/flow-smoke-basic.html",
  "findings": [
    {
      "severity": "critical | high | warning | info",
      "category": "flow",
      "title": "<flow name> — PASS | FAIL | BLOCKED",
      "evidence": "<what happened at each step, which step failed, exact error or indicator observed>",
      "recommendation": "Deploy recommendation: PASS | BLOCKED",
      "owner": "Maintenance Orchestrator",
      "follow_up": false,
      "red_flag": false,
      "source": "chrome-devtools-mcp | playwright",
      "evidence_type": "browser-smoke"
    }
  ],
  "blocked_checks": []
}
```

Mark `red_flag: true` when any transactional flow (cart, checkout, payment render, form submit) fails. This is the "loses real money" category and must be immediately visible to humans.

### `reports/flow-smoke-basic.html`

Write a structured HTML report. Use sections, status badges, and per-flow cards. Do not make humans read raw JSON or markdown.

Required structure:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Flow Smoke QA — <client> (<environment>)</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; padding: 2rem; max-width: 900px; margin: 0 auto; }
    .verdict-pass  { background: #e6ffed; border-left: 4px solid #28a745; padding: 1rem; margin: 1rem 0; border-radius: 4px; }
    .verdict-fail  { background: #ffeef0; border-left: 4px solid #d73a49; padding: 1rem; margin: 1rem 0; border-radius: 4px; }
    .verdict-blocked { background: #fff3cd; border-left: 4px solid #e0a800; padding: 1rem; margin: 1rem 0; border-radius: 4px; }
    .step-pass { color: #28a745; }
    .step-fail { color: #d73a49; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f6f8fa; }
    .red-flag { background: #d73a49; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>Flow Smoke QA — <client> (<environment>)</h1>
  <p><strong>Run date:</strong> <ISO timestamp></p>
  <p><strong>Config:</strong> ecommerce-visual-qa/config/flow-smoke-basic.json</p>
  <p><strong>Tool:</strong> Chrome DevTools MCP / Playwright</p>

  <!-- Overall verdict card -->
  <div class="verdict-pass|fail|blocked">
    <h2>Overall Verdict: PASS | FAIL | BLOCKED</h2>
    <p><strong>Deploy recommendation:</strong> Safe to proceed | BLOCKED — do not deploy</p>
    [<span class="red-flag">RED FLAG</span> if any flow failed]
  </div>

  <!-- Per-flow result cards -->
  <h2>Flow Results</h2>
  <!-- One card per flow in critical_flows -->
  <h3>Flow: <flow name></h3>
  <div class="verdict-pass|fail">
    <table>
      <tr><th>Step</th><th>Result</th><th>Evidence</th></tr>
      <tr><td>Load page</td><td class="step-pass">✅ PASS</td><td>HTTP 200, no console errors</td></tr>
      <tr><td>Add to cart</td><td class="step-pass">✅ PASS</td><td>Cart counter updated to 1</td></tr>
      <tr><td>Checkout render</td><td class="step-fail">❌ FAIL</td><td>Payment fields missing. Console: "Uncaught ReferenceError: Stripe is not defined"</td></tr>
    </table>
  </div>

  <!-- Hard Gates -->
  <h2>Hard Gates</h2>
  <table>
    <tr><th>Gate</th><th>Status</th></tr>
    <tr><td>Staging environment confirmed (not production)</td><td>✅</td></tr>
    <tr><td>No real transactions executed</td><td>✅</td></tr>
    <tr><td>Sandbox / test mode verified</td><td>✅ | ❌</td></tr>
    <tr><td>No PHP notices in page source</td><td>✅ | ❌</td></tr>
    <tr><td>No JavaScript errors on critical pages</td><td>✅ | ❌</td></tr>
  </table>

  <!-- Console / Network Evidence -->
  <h2>Console & Network Evidence</h2>
  <!-- List errors per flow, per step -->
</body>
</html>
```

## Step 5: Register Paperclip Work Product

After writing the HTML report, if `report.create_work_product` is `true` in the flow config, register the report as a native Paperclip work product:

```bash
paperclip-work-product \
  --issue <child-paperclip-issue> \
  --type document \
  --provider agency-os-support \
  --title "<report.work_product_title from config>" \
  --url "file:///ecommerce-visual-qa/reports/flow-smoke-basic.html" \
  --status ready_for_review \
  --health-status healthy|unhealthy \
  --summary "<one sentence result>" \
  --metadata-json '{"path":"<report path>","check":"flow-smoke-basic","report_type":"specialist"}' \
  --primary
```

Use `--health-status unhealthy` when verdict is `FAIL` or `BLOCKED`.

After successful work-product creation:

```bash
paperclip-update-issue-status --issue <child-paperclip-issue> --status done
```

If the work-product helper fails, mark the issue `blocked` with the exact helper output. Do not inspect helper source or create a fallback SQL/API path.

## Finding JSON Requirements

Each finding entry must include:

- `severity`: `critical` (broken checkout/payment), `high` (partial failure), `warning` (sandbox not configured), `info` (clean pass)
- `category`: `flow`
- `title`: `<flow name> — PASS | FAIL | BLOCKED`
- `evidence`: exact steps executed, which step failed, what error/indicator was observed, screenshot path
- `recommendation`: `"Deploy recommendation: PASS"` or `"Deploy recommendation: BLOCKED. Do not deploy."`
- `owner`: `Maintenance Orchestrator`
- `follow_up`: boolean
- `red_flag`: boolean — `true` for any broken transactional flow (cart, checkout, payment, form submit)
- `source`: `chrome-devtools-mcp` or `playwright`
- `evidence_type`: `browser-smoke`

## Required Report Shape (text summary)

```txt
Verdict: PASS | FAIL | BLOCKED

Target
- Client: <client_slug>
- Environment: staging (confirmed)
- Flow Config: ecommerce-visual-qa/config/flow-smoke-basic.json

Flows Executed
- <Flow 1 name>: PASS | FAIL at step "<step name>"
- <Flow 2 name>: PASS | FAIL at step "<step name>"
- <Flow 3 name>: PASS | FAIL at step "<step name>"

Hard Gates
- Staging confirmed (not production): YES
- No real transactions executed: YES
- Sandbox / test mode verified: YES | NO
- No PHP notices: YES | NO
- No JS errors on critical pages: YES | NO

Evidence
- Screenshots: artifacts/flow-smoke-basic/
- Console logs: logged per step above
- Network failures: listed per step above

Recommendation
- Deploy recommendation: PASS | BLOCKED
- Red flags: <count>
```

## Safety

- Environment must be `staging`. If payload says `production`, stop immediately with `BLOCKED`.
- `no_real_transactions: true` must be present in the config. If missing, treat as `true` and flag the gap.
- Never click Pay, submit payment, create real orders, send real emails, or modify site data.
- Never print or log resolved credential values from 1Password references.
- Do not run load tests, vulnerability scans, or authenticated admin actions.
- Screenshots and traces must be saved to the run task folder, not printed to console.
