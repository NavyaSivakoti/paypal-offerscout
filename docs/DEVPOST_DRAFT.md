# OfferScout

**Your AI guide to cashback offers.**

Status: working submission draft. Live AI acceptance checks and actual PayPal sandbox order creation are verified. An interactive buyer run returned a confirmed $106 sandbox capture. Remaining submission gates are tracked in SUBMISSION_READINESS.md.

## Inspiration

A shopper can know what they want to buy and still miss a relevant cashback offer. Once they find offers, the largest advertised percentage can hide a reward cap, a minimum purchase, or an eligibility restriction. OfferScout explores how an assistant can make those conditions easier to understand before checkout.

## What it does

OfferScout opens with Home and a Savings directory of fictional merchant cashback offers. A floating assistant is available on each screen: shoppers can ask about a merchant, compare cashback rates, or describe a sample purchase in natural language. Merchant cards show rates and conditions first; purchase examples and checkout live inside the details dialog. Shoppers can filter by merchant and category, save merchants during the current page session, or ask a budget-specific question to compare payment due today and estimated cost after rewards.

A $110 shoe with 15% cashback capped at $5 has an estimated cost of $105. A $108 shoe with 10% uncapped cashback has an estimated cost of $97.20. The payment remains $108; estimated rewards are not deducted at checkout.

The implemented checkout creates an order with the PayPal sandbox, asks the buyer to approve it, and validates a completed capture before displaying a test-payment receipt. Every fictional merchant card uses the same configured demo seller. It does not purchase from real retailers or issue cashback.

## How we built it

The application uses TypeScript, React, Vinext, and Zod. In live mode, the OpenAI Responses API converts a shopping request into a strict, validated intent schema. The verified configuration is `gpt-4o-mini` with `offerscout-intent-v4`. Deterministic code selects matching offers, checks the sample conditions, grounds customer status in explicit declarations or the user setting, and calculates amounts in integer cents. The model cannot establish customer eligibility, choose a charge amount, or approve a payment.

The server-side PayPal Orders integration uses only sandbox endpoints, derives amounts from the catalog, binds checkout to a signed HttpOnly cookie, and validates order identity, currency, amount, and completed capture status. Provider failures appear as errors, rather than silently becoming successful payments or demo answers.

## Challenges and decisions

We separated intent interpretation from money calculations and treated unknown eligibility conservatively. Shipping is charged today but excluded from estimated cashback and merchandise minimums. Unknown new-customer status produces no estimated reward for restricted offers. The interface distinguishes the actual payment from hypothetical rewards.

## Validation so far

102 automated checks pass, including hand-labeled calculations, merchant/product matching, customer-status handling, four benefit kinds, exact-dollar filters, all 600 catalog order-body amounts, amount tampering, pending captures, signed checkout bindings, and redirect restrictions. Provider responses in unit tests are mocked. Separately, 14 bounded hosted checks passed against the actual OpenAI service on the expanded catalog with gpt-4o-mini and offerscout-intent-v6. Three actual PayPal sandbox orders were created for the new fixed cashback and discount kinds. No new-kind buyer approval/capture was performed. User-operated runs of the original cashback examples produced completed $106 and $108 capture receipts. These screenshots establish the observed happy path; seller dashboard reconciliation and real cancellation/failure paths are not independently verified. The evaluation is a development set, not a general accuracy estimate.

## Scope and limitations

The catalog and offer terms are synthetic and clearly labeled. Estimates use a fixed, visible October 17, 2026 reference date; tax is excluded and activation is assumed. The AI interprets each question independently; prior chat history is not model context, and arbitrary real-world offer extraction is not implemented. There is no live PayPal cashback feed, reward payout, fulfillment, or refund handling. OfferScout is an independent prototype, not an official PayPal product.

## Next development steps

Validate the live integrations, collect shopper feedback, and explore authorized merchant offer feeds. Future support for personalized eligibility and additional exclusions would require explicit data sources and new evaluation cases.

## Publication gates

Before copying to Devpost: verify live behavior, record the actual configured model and prompt version, publish the source with its MIT license, provide working judge access, and attach the public YouTube video. Do not include API secrets in the submission.

### Expanded test catalog

The current prototype has 150 fictional footwear merchants and 600 sample offers across percentage/fixed cashback and percentage/fixed instant discounts. This is synthetic test scale, not real merchants onboarded. Eligibility and money remain deterministic; instant discounts affect the sandbox payment while deferred cashback stays an estimate. Research sources and limits are documented in OFFER_DATA_RESEARCH.md. The previous 12-case live evaluation used the original catalog and v4 prompt; source now uses v6.
