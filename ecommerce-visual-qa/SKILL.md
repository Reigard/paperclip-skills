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

## eCommerce Flow QA (flow-smoke-basic)

When the run scope specifies `flow-smoke-basic`, the target is an eCommerce or booking site.

1. Locate the client's flow configuration in `/clients/<client-slug>/config/flow-smoke-basic.json`.
2. Do not rely on static screenshots. You MUST exercise the defined critical flows:
   - Adding a product to the cart.
   - Viewing the cart and validating the total.
   - Proceeding to the checkout page.
3. **Strict Constraint**: Do not process real payments or submit production orders. Only verify that the checkout renders payment fields in Sandbox/Test mode.
4. Capture evidence (screenshots, network requests, console errors) at each state transition.
5. If any pass criteria in the flow config fails (e.g., fatal error, missing payment fields, live payment gateway detected), the verdict is `FAIL` with `red_flag: true`.
6. Output findings to `reports/flow-smoke-basic.html` and `findings/flow-smoke-basic.json` as requested by the orchestrator.

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
