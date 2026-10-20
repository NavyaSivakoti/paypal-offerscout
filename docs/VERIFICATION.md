# OfferScout verification record

Updated October 20, 2026. Hosted AI and sandbox order creation have been checked with actual credentials; buyer approval and completed capture are pending.

## Automated results

- 49 tests passed; zero failures, skips, or cancellations.
- TypeScript strict compilation passed with `tsc --noEmit`.
- `git diff --check` passed.
- Dataset checks cover caps, shipping exclusions, minimum spend, new-customer uncertainty, expiration, cent rounding, zero values, and headline versus effective-cost ranking.
- Integration unit tests cover structured model output/refusal/provider errors, combined merchant/product filters, unchanged budgets, trusted catalog amounts, signed checkout binding, capture idempotency, pending capture rejection, and redirect/origin/input validation.
- Provider responses in the unit tests are mocked. Actual hosted-service results are recorded separately below.
- Added coverage for merchant-only answers, unique merchants in headline-rate order, and secure request-ID generation without requiring `crypto.randomUUID` in the preview browser.
- Customer-status checks cover requested deal type, explicit new/returning declarations, negation, conflicting declarations, claims inside instructions, and preservation of the user setting.

## Hosted integration checks — October 20, 2026

- All three credential entries were present as hosted secrets. The approved saved application was deployed with the updated environment configuration.
- `/api/status` returned HTTP 200 with AI and PayPal configured and environment `sandbox`.
- Twelve bounded acceptance checks against the actual OpenAI service passed with `gpt-4o-mini` and `offerscout-intent-v4`. The [machine-readable record](LIVE_ACCEPTANCE_RESULTS.json) contains the exact assertions and responses. This is a development acceptance set, not a general accuracy or security guarantee.
- Initial checks exposed a shopping request misrouted to a cap explanation and a model inference confusing requested deals with customer status. Clearer routing instructions and deterministic customer-status grounding corrected these cases. The model cannot grant eligibility through its output.
- An exact product and merchant may be represented with category null; the acceptance check requires that both constraints are preserved and only the matching catalog item is returned.
- The actual PayPal sandbox adapter authenticated and created an order for the $108 Trail & Field sample purchase. The hosted endpoint returned HTTP 200, order `09B461667F888934R`, and a sandbox approval destination.
- No buyer approval or capture was performed by this check. No completed-payment claim is supported yet. Hosted browser return/cancel behavior and session-cookie continuity still need an interactive buyer run.
- Public source and the MIT license are published at https://github.com/NavyaSivakoti/paypal-offerscout. Credential values were excluded.

## Redesigned interface browser checks — October 20, 2026 (UTC)

- Home displayed a Savings entry point and a bottom-right Ask OfferScout launcher.
- Opening chat focused its input. Rule-based demo mode was explicitly labeled; live AI was unavailable without configuration.
- “Running shoes under $120” opened Savings, applied category/budget filters, and ranked Trail & Field first. The chat result opened the matching sample purchase with $108.00 payable, $10.80 estimated reward, and $97.20 estimated effective cost.
- Merchant details showed cashback terms first, with sample purchases inside an expandable section. Missing sandbox credentials left checkout disabled.
- Asking about Trail & Field returned merchant rates and conditions without an unsolicited sample-product recommendation.
- Saving Trail & Field and opening Saved displayed that merchant.
- A 390 × 844 iframe viewport check confirmed a single-column Savings screen, bottom navigation, floating launcher, usable chat panel, and a completed highest-cashback response. This checks responsive layout, not physical-device or mobile-keyboard behavior.
- Fixed a browser crash caused by unavailable `crypto.randomUUID` on the HTTP preview. Chat message IDs now use a local counter; checkout request IDs use cryptographically random bytes.

## Earlier browser checks — October 18, 2026 (America/Phoenix)

- OfferScout branding and browser title displayed correctly.
- Live AI was disabled and rule-based demo mode was labeled explicitly.
- “Cloudstep Road Runner at Trail & Field” returned one card and retained both merchant and product constraints.
- That card and its terms dialog agreed on $108.00 payable, $10.80 estimated reward, and $97.20 estimated effective cost.
- “Running shoes under $105.99” preserved the decimal budget and returned no offers; the app did not increase the budget.
- “Running shoes under $120” ranked Trail & Field first and displayed three matching offers.
- Saving the winning offer and opening Saved displayed exactly that offer.
- Checkout without configuration was disabled and stated that no payment had been created.
- Visiting the cancellation route settled on “Checkout cancelled” with no capture action.
- The missing-order checkout state had a disabled payment button and explained how to start again.

## Pending integration gates

PayPal buyer approval and completed capture, real provider failure handling, deployed return/cancel navigation, and judge access are not verified. The 12-case AI acceptance run is limited to its recorded assertions. Do not claim the prototype is submission-ready until the remaining submission gates are closed.
