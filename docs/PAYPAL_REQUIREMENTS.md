# PayPal implementation and submission requirements

Verified October 17, 2026 against:
- https://paypalaihackathon.devpost.com/rules
- https://paypalaihackathon.devpost.com/resources
- https://developer.paypal.com/platforms/checkout/standard/integrate/
- https://developer.paypal.com/api/rest/reference/idempotency
- https://github.com/paypal/AI-Toolkit/blob/main/README.md

## Submission
- Meaningful working PayPal sandbox integration and real AI integration are required.
- A labeled local rule-based assistant is a development preview, not the final AI integration.
- Public open-source repository with visible license and complete setup instructions.
- Hosted functional demo or complete reproducible setup. Keep access available through December 15, 2026.
- Public YouTube demo shorter than three minutes, matching actual functionality.
- Authorized third-party data, assets and trademarks only.
- Submit by November 12 at 1 PM America/Phoenix.

## Payment design
- Server owns the trusted catalog, currency and total; never trust browser or model amounts.
- Use sandbox endpoints and separate buyer/merchant accounts.
- Create order, obtain buyer approval, capture on server and verify final capture status.
- Use supported idempotency headers with stable per-operation keys on retry.
- Keep client secrets and access tokens server-side.
- Handle cancellation, declined funding, pending captures, timeouts and duplicate requests explicitly.
- Persist ownership bindings and verify orders belong to this checkout before capture.
- No live-money transactions or real PayPal Rewards claims in the demo.

## Resources and gaps
The official resource list provides checkout, SDK v6, REST, sandbox, AI Toolkit, Agent Toolkit and MCP guidance. No personalized offers feed is listed. This does not prove no partner access exists. The current implementation uses the REST Orders API directly, with the official Orders flow and idempotency documentation as references. AI Toolkit adoption is not required for this implementation. See SUBMISSION_READINESS.md and VERIFICATION.md for the current verification limits.
