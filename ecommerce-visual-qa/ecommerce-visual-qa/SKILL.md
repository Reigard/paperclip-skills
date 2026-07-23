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

## eCommerce Flow QA (flow-smoke-basic)

When the run scope specifies `flow-smoke-basic`, the target is an eCommerce or booking site.

1. Locate the client's flow configuration at `config/{client_slug}/flow-smoke-basic.json` (see Config Discovery above).
2. Do not rely on static screenshots. You MUST exercise the defined critical flows:
   - Adding a product to the cart.
   - Viewing the cart and validating the total.
   - Proceeding to the checkout page.
3. **Strict Constraint**: Do not process real payments or submit production orders. Only verify that the checkout renders payment fields in Sandbox/Test mode.
4. Capture evidence (screenshots, network requests, console errors) at each state transition.
5. If any pass criteria in the flow config fails (e.g., fatal error, missing payment fields, live payment gateway detected), the verdict is `FAIL` with `red_flag: true`.
6. Output findings to paths defined in the config's `report` block (`report.html` and `report.json`). Default: `reports/flow-smoke-basic.html` and `findings/flow-smoke-basic.json`.

## eCommerce Full E2E Checkout (flow-full-checkout)

When the run scope specifies `flow-full-checkout` or a flow config sets `"boundary": "full_checkout"`, execute a complete end-to-end transactional flow using Stripe test mode.

### Safety Gate (MANDATORY — check this first)

Before entering ANY payment data, confirm Stripe test mode is active:
- Look for: test mode badge, `pk_test_` key in page source/network, or `stripe.com/v3` with test indicators.
- If a **live gateway** is detected (`pk_live_`), **immediately ABORT** the flow, set `red_flag: true`, verdict `FAIL`, and do NOT enter any card data.

### Flow Execution

1. Locate the client's flow configuration at `config/{client_slug}/flow-full-checkout.json` (see Config Discovery above).
2. Use the `qa_persona` block from the config for **all** form fields (name, email, address, phone, country). Do not invent data.
3. Execute each step defined in the flow's `steps` array using the browser.
4. **Billing / Account fields**: Fill using `qa_persona`. If guest checkout is available, prefer it. If account creation is required, use `qa_persona.email` and a throwaway password (e.g. `QaTest2024!`).
5. **Stripe card fields**: Enter exactly as specified in `payment_sandbox.test_card`:
   - Card number: `4242 4242 4242 4242` (type digit by digit into the Stripe iframe)
   - Expiry: `12/29` (or any valid future MM/YY)
   - CVV: `123` (any 3-digit code)
6. Click the Pay / Place Order / Bestellen button once all fields are filled.
7. Wait for the order confirmation page. Capture: order number, success message, any receipt details.
8. Capture evidence (screenshots) at each state transition: cart, checkout, payment fields, confirmation.
9. If any `fail_criteria` is triggered, set verdict `FAIL` with `red_flag: true`.
10. Output findings to paths defined in the config's `report` block. Default: `reports/flow-full-checkout.html` and `findings/flow-full-checkout.json`.

### qa_persona

The `qa_persona` in the config provides all test identity data. Always source form values from there — never hardcode values in the skill itself. This allows the config to be client-specific without changing the skill.

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
