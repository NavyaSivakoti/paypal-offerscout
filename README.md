# OfferScout

**Your AI guide to cashback offers.**

Independent PayPal AI Hackathon prototype for discovering fictional merchant cashback offers, checking their conditions, and demonstrating sandbox checkout.

## Status

Home, merchant Savings directory, floating chatbot, deterministic reward calculations, structured AI backend, server-side PayPal sandbox order/capture flow, and payment result page are implemented. **Live OpenAI extraction passed 12 bounded acceptance checks, and actual PayPal sandbox order creation was verified on October 20, 2026. An interactive buyer run also returned a confirmed $106 sandbox capture, documented from the user-provided receipt.** Missing configuration leaves live features disabled; the rule-based demo remains explicitly labeled. No real purchases or rewards are issued.

## Try the interface

1. Open Home and select **Explore savings**, or use **Savings** in the bottom navigation.
2. Browse merchant offers, filter by category or merchant, inspect terms, or save a merchant.
3. Select **Ask OfferScout** at the bottom right on any screen. Ask which merchants have the highest cashback, or try “Running shoes under $120” to compare a sample purchase.
4. Open a chat result or merchant card to see conditions. Sample purchases and sandbox checkout are inside the details dialog.

The floating assistant is part of this app. It is not installed inside PayPal. Its current rule-based demo is explicitly labeled; live mode becomes available after server configuration.

## Run locally

Requires Node 22.13+ and pnpm 11.25.0. Run:

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local` instead of `cp`. Use the local URL printed by the development server and set `APP_ORIGIN` to that exact origin. Environment files are ignored by Git. Restart the server after changing configuration.

Set `OPENAI_API_KEY` and `OPENAI_MODEL` to enable live AI. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `APP_ORIGIN` to enable sandbox checkout. Use sandbox-only PayPal credentials; live API endpoints are deliberately unsupported. Create a separate sandbox Personal buyer account to approve test purchases. All fictional merchant cards pay the one configured demo seller, not real retailers.

For the hosted Site, configure runtime secrets separately from local files. Do not place credentials in source, public testing instructions, or client bundles. Arrange private delivery of any test buyer logins needed by judges.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

The 49 automated tests use injected fake provider responses; they do not spend API credit or contact PayPal. Separate [hosted live acceptance results](docs/LIVE_ACCEPTANCE_RESULTS.json) record 12 checks against `gpt-4o-mini` with `offerscout-intent-v4`. These are a small development acceptance set, not a general accuracy estimate or proof of completed payment.

## Architecture

- `lib/intent.ts`: strict intent schema and explicitly labeled demo parser.
- `lib/customer-status.ts`: grounds eligibility in an explicit supported first-person declaration or the user's setting. Model-inferred eligibility cannot override these inputs; contradictory declarations become unknown.
- `lib/server/assistant.ts`: one bounded Responses API call with structured outputs; rejects refusals, malformed output and provider errors. No silent demo fallback. Model name and prompt version are returned to the UI.
- `lib/recommend.ts`, `lib/offers.ts`: deterministic matching, sorting and integer-cent arithmetic. The AI never sets a payment amount or invokes checkout.
- `lib/server/paypal.ts`: sandbox-only API adapter; order amounts derived from catalog; signed HttpOnly checkout binding; capture idempotency; amount/status validation before success.
- `app/api`: bounded JSON requests, same-origin checks, server-only credentials, sanitized errors.
- `app/checkout`: explicit user capture after PayPal approval, cancellation/error states and verified sandbox receipt.

## Data and limitations

All data is fictional. Estimates assume activation and use a visible fixed demo date of October 17, 2026 so judging after offer expiry remains reproducible. Tax is excluded. New-customer eligibility is user-declared, not externally verified. Supported first-person declarations, such as “I am a returning customer,” override the user setting; other phrasing uses the setting, and contradictory declarations remain unknown. Merely requesting new-customer deals does not establish eligibility. Saved merchants and displayed chat history remain in current-page memory. Each question is interpreted independently; prior chat messages are not sent to the model, so include the merchant, product, or budget in each question. The AI extracts intent; arbitrary real-world offer-term extraction is not implemented.

One checkout cookie per browser means starting another checkout replaces the previous binding. No durable order history, webhook reconciliation, fulfillment, reward payout or refunds exists. A failed or pending capture never appears as paid. Hosted access remains owner-private; public access requires a separate review of authentication and persistent usage limits before enabling paid AI calls.

[Dataset documentation](docs/LABELLED_DATA.md) · [Submission readiness](docs/SUBMISSION_READINESS.md) · [Submission draft](docs/DEVPOST_DRAFT.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Verification record](docs/VERIFICATION.md)

Official integration sources: [PayPal Orders flow](https://developer.paypal.com/api/rest/integration/orders-api), [PayPal sandbox](https://github.com/paypaldev/getting-started-with-paypal-sandbox), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

MIT license. Not affiliated with or endorsed by PayPal.
