# OfferScout submission readiness

Reviewed October 18, 2026 against https://paypalaihackathon.devpost.com/rules and https://paypalaihackathon.devpost.com/resources. This is an engineering checklist, not organizer approval or a prediction of a prize.

Integration and source-publication evidence updated October 20, 2026; see VERIFICATION.md and LIVE_ACCEPTANCE_RESULTS.json.

## Required gates

| Requirement | Current evidence | Remaining gate |
| --- | --- | --- |
| Central PayPal sandbox integration | Server order/capture flow implemented; actual sandbox authentication and order creation verified | Buyer approval, completed capture, and seller account verification |
| Meaningful AI | Actual OpenAI service passed 12 bounded acceptance checks with gpt-4o-mini and offerscout-intent-v4; code controls eligibility and money | Verified for the recorded cases; preserve access during judging and accurately disclose evaluation limits |
| Working prototype | Home, merchant Savings, floating chat, terms, live AI, and sandbox order creation | Verify hosted end-to-end AI to approved sandbox payment |
| Judge access | Owner-private preview deployed | Provide judge-accessible hosting or complete reproducible setup; verify without owner session |
| Public source + license | Public NavyaSivakoti/paypal-offerscout repository with source, setup instructions, tests, and MIT LICENSE | Verify final submitted commit and license display before submission |
| Text description + tools | README and architecture documents | Final Devpost description identifying model, prompt version, synthetic data and actual capabilities |
| Under-three-minute public YouTube demo | Suggested sequence below | Record actual working app, upload publicly, verify playback signed out |
| Availability through judging | Not yet arranged | Keep working demo and funded AI access available free through December 15, 2026 |
| Original work / authorized third-party use | Fictional data; custom SVG illustrations | Review dependencies/assets and final recording; disclose tools used |
| On-time submission | No submission completed | Submit before November 12, 2026, 1 PM Phoenix time; verify confirmation |
| Participant eligibility | Not independently verified | Entrant reviews age/residence/conflict rules and confirms eligibility |

## Judging evidence to build

- Technological implementation: structured model output validated server-side, deterministic financial math, real PayPal sandbox order/capture IDs, decline and retry handling, labeled evaluation results.
- Design: one coherent ask → compare → terms → approve → receipt journey, usable on mobile; honest unavailable/error states.
- Impact: obtain feedback from 3–5 shoppers on finding caps and exclusions; report observed feedback, never invented conversion or savings statistics.
- Innovation: demonstrate why the highest advertised rate loses; explain eligibility and uncertainty with exact sample clauses. A cashback directory or generic shopping chat alone is a weak differentiator. The current model extracts intent; it does not yet extract arbitrary offer fine print.
- Presentation: show the working transaction, clear sample-data disclosure, and one memorable before/after comparison.

## Proposed 150-second video

0–20s: missed-offer discovery problem, described as personal motivation.
20–55s: ask for shoes under $120; compare rates and payable prices.
55–85s: 15% capped at $5 versus 10% uncapped; inspect the sample clause.
85–125s: buyer approves actual PayPal sandbox checkout; show completed capture.
125–150s: demonstrate an ineligible offer; state prototype limits and who benefits.

## Unresolved and nonclaims

The reviewed rules do not explicitly prohibit synthetic offers or require advance approval. This supports proceeding with labeled fictional data; it is not a guarantee of final eligibility. No official PayPal consumer cashback feed was found in the reviewed resources. The app issues no cashback, places no orders at real retailers, and is not an official PayPal product. One configured sandbox seller receives all test payments; displayed fictional merchants are comparison personas, not onboarded sellers. No refunds integration is in scope.

Sponsor tools are optional. Channel3 may provide product discovery but does not establish access to PayPal reward data. No sponsor integration is currently implemented. Under current rules a project may win one grand OR one honorable-mention prize plus at most one sponsor prize.
