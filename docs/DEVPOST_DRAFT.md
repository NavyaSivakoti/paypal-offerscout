# OfferScout

**Your AI guide to cashback and discount offers.**

## Inspiration

An attractive cashback percentage does not tell a shopper what they will actually save. Caps, minimums, exclusions and shipping can change the result. OfferScout makes those conditions visible before a shopper approves a payment.

## What it does

OfferScout combines a searchable Savings directory with a floating AI assistant. Describe a footwear purchase, browse fictional merchants, narrow a budget, compare offer types, or ask about a selected offer's terms. The prototype contains 150 fictional merchants and 600 sample offers across percentage cashback, fixed-dollar cashback, percentage discounts and fixed-dollar discounts.

The assistant shows payment due before tax, instant discounts, estimated cashback and estimated cost after rewards separately. A $110 example with 15% cashback capped at $5 costs an estimated $105. A $108 example with 10% uncapped cashback costs an estimated $97.20. The lower advertised rate wins that comparison.

A buyer can open a sample purchase and explicitly approve a PayPal sandbox checkout. The server creates the order, captures the approved payment and validates the amount, currency and completed status before showing a receipt. All fictional merchants use one configured sandbox seller. No real merchant purchase, goods or reward payout occurs.

## How we built it

TypeScript, React and Vinext power the app. Zod validates API input and model plans. The OpenAI Responses API uses strict structured outputs to interpret shopping requests, help questions and follow-up changes. The configured model is gpt-6.1-sol; current planner source version is offerscout-plan-v21. Bounded context contains the previous search filters, catalog IDs and any pending comparison, rather than raw conversation history.

Deterministic code matches catalog offers, checks eligibility and calculates money in integer cents. The model cannot choose a charge amount, establish verified eligibility or execute payment. The PayPal Orders API integration uses sandbox endpoints, server-derived totals, a signed HttpOnly checkout binding and idempotent capture requests. A failed or pending capture is not displayed as completed.

## Challenges

We keep today's payment separate from deferred estimated cashback, preserve budgets across follow-ups and require explicit consent before showing price-only comparisons when unsupported product attributes were requested. Unknown new-customer eligibility receives no benefit from restricted offers. The catalog uses a frozen reference date, so the assistant discloses that it cannot verify seasonal or future-date deals and offers reference-date sample comparisons after a budget reply or consent, instead of treating old offers as valid for the future purchase.

## What we are proud of

An end-to-end comparison-to-payment prototype with transparent sample terms, inspectable AI plans and independently computed payment amounts. The shopper remains in control of checkout.

## What we learned

Useful shopping assistance requires explicit limits as much as ranking. A rate, a payment amount and an estimated reward are different facts. A historical offer snapshot cannot establish future availability.

## Validation

277 automated tests pass against the current source, with mocked provider responses. TypeScript strict checks and changed-file lint pass. Historical hosted AI evaluations and user-operated $106/$108 sandbox captures are documented separately; those runs are not a full live evaluation of the current planner. The final video must show an actual approved capture from the running app before claiming that observed result. Evaluation fixtures are synthetic development cases, not a general model-accuracy benchmark.

## Limitations and next steps

All merchants, products and offer terms are fictional. The catalog is evaluated at October 17, 2026 for reproducibility; it is not a live PayPal feed or a forecast of Black Friday deals. Activation is assumed, tax is excluded and customer status is self-declared. No fulfillment, refunds, real reward issuance or durable order history is implemented. Saved merchants and chat state last only for the current page visit. OfferScout is an independent hackathon prototype, not an official PayPal product.

Future work: authorized live offer data, merchant-specific eligibility, broader product data and feedback from real shoppers. These are future integrations, not demonstrated capabilities.

## Built with

PayPal Sandbox Orders API, OpenAI Responses API (gpt-6.1-sol), TypeScript, React, Vinext, Zod, Tailwind CSS, ChatGPT Sites. AI assistance was used during development and QA. No optional sponsor integration is claimed.

## Submission links and final gates

- Source: https://github.com/NavyaSivakoti/paypal-offerscout — MIT license.
- Hosted app: https://offerlens.lakshminavya104.chatgpt.site — currently owner-private; do not describe this URL as judge-accessible yet.
- Setup instructions: README.md. Entrants/judges supply their own sandbox and AI credentials for local live integrations; offline demo mode is separately labeled.
- Add the actual public YouTube video URL in Devpost after recording; do not submit a placeholder.
- Verify entrant eligibility, project fields, judge access, actual configured model and successful submission confirmation before submitting.
