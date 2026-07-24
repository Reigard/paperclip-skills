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
- `BLOCKED`: The environment is unreachable or credentials are missing.

## Config Discovery (Multi-Client)

This skill is client-agnostic. All client-specific data (URLs, QA persona, test scope) lives in `config/{client_slug}/` inside this skill folder.

**Config lookup order — use the first match:**
1. `config/{client_slug}/flow-smoke-basic.json` — where `{client_slug}` is provided by the orchestrator in the task context (e.g. `wipptrail`, `shopify-client`)
2. A full config path explicitly provided by the orchestrator
3. If neither exists: set verdict `BLOCKED`, report missing config, and reference `config/_example.json` as the schema for the operator to follow

To add a new client: copy `config/_example.json` → `config/{new-client-slug}/flow-smoke-basic.json`, fill in the URLs and `qa_persona`.

## Execution using Playwright

This skill executes eCommerce checkout flows autonomously using the pre-built Playwright runner [playwright-runner.js](file:///d:/installl/Laragon/www/paperclip-skills/ecommerce-visual-qa/ecommerce-visual-qa/playwright-runner.js). Do NOT use interactive `chrome_devtools` MCP tools step-by-step.

### 1. Preparation
Ensure that the `playwright` npm package and browsers are installed. If not, run:
```bash
npm install playwright
npx playwright install chromium
```

### 2. Running the Flows
Run the automated Playwright runner using the client's configuration file.
Where `{client_slug}` is provided by the orchestrator in the task context:

- For basic smoke check (`flow-smoke-basic`):
  ```bash
  node playwright-runner.js --config config/{client_slug}/flow-smoke-basic.json
  ```

- For full end-to-end checkout (`flow-full-checkout`):
  ```bash
  node playwright-runner.js --config config/{client_slug}/flow-full-checkout.json
  ```

**CRITICAL RULES FOR AI AGENT EXECUTION (TOKEN SAVING):**
1. **DO NOT run `node playwright-runner.js` multiple times**. Run it EXACTLY ONCE.
2. **DO NOT poll the script status** using repeated `cat`, `tail`, or `ls` commands. Run the command and wait for it to finish.
3. **DO NOT read or analyze screenshots** (e.g. using Vision/Image tools). Screenshots are for human operators. To avoid wasting AI tokens, you MUST read ONLY the generated JSON and HTML report files.
4. **DO NOT auto-debug**. If the script throws an error, do not launch into an interactive debugging loop. Output the error and stop.

The script will launch Chromium, perform all configured steps (navigating, adding to cart, filling the billing form, handling Stripe card iframe input, and waiting for the order confirmation), capture screenshots (FOR HUMAN REVIEW ONLY), and output findings.

### 3. Verification & Report Ingestion
Once the script finishes:
1. Verify that the script completed with exit code `0`. If it failed, inspect the console output.
2. Read the generated JSON findings file (path defined in config's `report.json`, e.g., `findings/flow-smoke-basic.json`).
3. Read the generated HTML report file (path defined in config's `report.html`, e.g., `reports/flow-smoke-basic.html`).
4. Output findings and the report summary to the task context exactly as required below.

## Finding JSON Requirements

Each finding must follow the standard contract for `flow-smoke-basic`:

- `severity`: `critical`, `high`, `warning`, or `info`
- `category`: `flow`
- `title`: Description of the flow state
- `evidence`: Detailed summary of what worked and what failed
- `recommendation`: "PASS" or "BLOCKED" (if fail)
- `owner`: Maintenance Orchestrator
- `follow_up`: boolean
- `red_flag`: boolean (`true` if a critical transaction flow failed)
- `source`: e.g. `playwright`, `browser-mcp`
- `evidence_type`: `browser-smoke`

## Required Report Shape

Every eCommerce visual QA report must include:

```txt
Verdict: PASS | FAIL | BLOCKED

Target
- Client:
- Environment: (Must be staging)
- Target Flow Config: 

Evidence
- Flow: Add to Cart
  - Steps executed:
  - Console/Network state:
- Flow: Checkout
  - Steps executed:
  - Payment Sandbox Verified: Yes/No
  - Console/Network state:

Hard Gates
- Correct pages reached:
- Cart persistence verified:
- Sandbox mode verified:
- No real transactions executed:

Recommendation
- Deploy recommendation:
```
