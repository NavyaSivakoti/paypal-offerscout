# OfferScout verification record

Updated October 20, 2026. Hosted AI and sandbox order creation have been checked with actual credentials. A user-operated buyer run returned a completed $106 sandbox capture receipt.

## Automated results

- 147 tests passed; zero failures, skips, or cancellations.
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
- The programmatic $108 order check did not perform buyer approval or capture. Separately, the user supplied screenshots of a $106 PayPal Sandbox checkout ($99 item + $7 shipping), the return to OfferScout, and the completed capture receipt on October 20, 2026 at approximately 3:28 PM America/Phoenix. This verifies the user-observed happy path through approval, browser return, checkout-cookie continuity, and completed capture. It is not an independent seller-dashboard reconciliation.
- The user-observed receipt showed order `64J48416CX676231A`, capture `9BP92328W5735391M`, and $106.00 paid. No real purchase or reward was issued.
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

## Checkout interface refresh — October 20, 2026

- Replaced the left-aligned checkout with a centered responsive shell, branded header, checkout progress, clear pending state, and structured capture receipt.
- Desktop and a 390 × 844 iframe viewport displayed the new confirmation controls without horizontal overflow. This is layout QA, not a physical-device test.
- In the unconfigured local preview, confirmation displayed an explicit error and returned the button to its usable state; it did not show payment success. The cancellation route displayed its no-capture explanation.
- Strict TypeScript compilation and all 49 existing automated tests passed after the interface change. The successful $106 hosted receipt above predates this visual refresh; the PayPal adapter is unchanged.

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

Seller-dashboard reconciliation, real provider failure handling, deployed cancellation/failure navigation, and judge access are not verified. Successful buyer approval, deployed return navigation, and capture are supported by the user-provided receipt described above. The 12-case AI acceptance run is limited to its recorded assertions. Do not claim the prototype is submission-ready until the remaining submission gates are closed.

## Expanded catalog — October 20, 2026

- 150 unique fictional merchants, 600 unique sample purchase offers, four offer kinds, and 28 independently hand-labeled mixed-benefit calculations. The original 15 calculation labels remain executable.
- All 102 automated tests passed, including schema checks, original offer stability, all 600 PayPal order-body amounts, discounted receipts, family/exact-dollar filters, and bounded results.
- Local browser QA confirmed 150 merchants, 24 initially rendered cards, 48 after Show more, dollar-discount filtering, search for Brook Footwear Outlet, and generated merchant terms. A rule-based chat request for save $5 applied the fixed-dollar discount filter and a $5 benefit constraint. The v4 live report describes the earlier catalog; current hosted results are below.

- [Current hosted acceptance report](CATALOG_LIVE_ACCEPTANCE_RESULTS.json): 14/14 bounded checks passed against actual gpt-4o-mini with offerscout-intent-v6. They cover new merchants (including names containing category words), four offer kinds, separate benefit/payment amounts, unknown real merchants, and false-reward requests.
- The first expanded v5 run passed 12/14 exact field checks. Two remaining responses used equivalent family filters (cashback + $5, or headline-rate + no offer type). Matching results were already constrained correctly. Deterministic canonicalization now normalizes those forms; the v6 rerun passed all 14 without relaxing the expected field assertions. This is development validation, not a holdout benchmark.
- Three actual PayPal sandbox orders were created for fixed cashback, fixed-dollar discounts, and percentage discounts. All returned sandbox approval URLs. These order-creation results are retained from the preceding v5 run; the PayPal adapter did not change for the v6 canonicalization. No buyer approval/capture was performed on these new orders. Do not imply every new offer was captured end-to-end.
- A subsequent user-provided screenshot of the refreshed receipt showed a completed $108 sandbox capture on the original Trail & Field purchase. Seller-account reconciliation remains unverified.

## Checkout regression expansion and estimated cashback receipt — October 20, 2026 (America/Phoenix)

- Added 45 tests, bringing the suite to 147 passing tests. New cases exercise the actual checkout orchestration with injected provider responses: approval, completed-order retry without recapture, unapproved/voided orders, pending/declined captures, provider failures, wrong order identity, and tampered amounts.
- Four new regression checks initially failed: direct validation helpers did not explicitly reject currency mismatches (the network adapter already enforced USD), checkout sessions remained valid at the exact expiry instant, and the JSON media-type check accepted application/jsonp. Added explicit currency guards and corrected expiry and media-type matching.
- A shared strict receipt schema checks completed status, balanced payment/estimate amounts, nonnegative integer cents, no benefit on ineligible offers, and the no-stacking rule. All 600 offers were exercised under unknown, returning, and self-declared-new customer states: 1,800 receipt scenarios.
- Customer status is saved in the signed HttpOnly checkout binding; the capture endpoint ignores client-supplied estimate amounts. Legacy bindings conservatively use unknown status. This is self-declared demo eligibility, not external merchant verification.
- Confirmed receipts now display simulated estimated cashback, instant discount applied, and estimated cost after cashback. Cashback does not change the amount captured. Expired, excluded, below-minimum, or unverified-customer offers display zero benefit and the reason.
- A local QA fixture displayed $108 paid, $10.80 estimated cashback, and $97.20 estimated cost at desktop and 390 × 844 iframe widths. The fixture route and harness were removed before publication. This is rendering evidence, not a new real PayPal capture.
- Strict TypeScript compilation passed. The previous 14-case live AI report remains historical evidence for the unchanged v6 AI pipeline. A fresh user-operated sandbox capture is still needed to verify the newly added receipt fields through the deployed happy path.

- [Deployed HTTP checks](RECEIPT_HTTP_VERIFICATION.json): 8/8 passed, including JSON/origin/input guards, forged-session rejection, actual sandbox order creation with saved customer context, and rejection of an unapproved order without issuing a receipt or estimate. No buyer approval/capture was performed by this check.
