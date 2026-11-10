# OfferScout — finish and submit November 10, 2026

## Prepared

- Public MIT-licensed repository with setup instructions.
- Updated submission copy: DEVPOST_DRAFT.md.
- Target 150-second recording script: DEMO_SCRIPT.md.
- Current source: 270 passing automated tests, strict TypeScript, changed-file lint and production build.
- Fictional-data, fixed-reference-date, one-sandbox-seller and simulated-reward disclosures.
- Purchase-date limitation: future/seasonal availability is not inferred from the frozen catalog.

## Final actions in order

1. Open the deployed app as owner. Try a category/budget search, a follow-up budget, an offer-detail question, a seasonal-date question, and a deliberately unsupported merchant. Confirm usable chat and honest limits.
2. In the same running build, approve one PayPal sandbox purchase using a sandbox buyer. Confirm COMPLETED status, expected paid amount and separately labeled estimated rewards. Verify the transaction in the sandbox seller dashboard. Test cancellation separately; it must not display a paid receipt.
3. Choose a judge-access route. The hosted app is currently owner-private. Either arrange supported judge access and verify it without the owner session, or rely on the complete repository setup route allowed by the supplied requirements. Do not submit an inaccessible hosted URL as the sole functional demo. Public paid-AI hosting needs persistent usage protection before exposure.
4. Record the actual flow using DEMO_SCRIPT.md, under three minutes. Keep sample/sandbox labels visible. Do not record secrets, login fields, personal chat or invented success states. Upload publicly to YouTube and verify playback signed out.
5. Copy the reviewed DEVPOST_DRAFT.md text into the project submission. Add source URL, actual demo access instructions, screenshots, public YouTube URL and tools used. Remove editing notes/final-gate sections from the public project narrative.
6. Entrant verifies eligibility and accepts required declarations. Submit today and save the actual Devpost submission confirmation.

## Verification limits

The 270 tests mock provider responses. Historical live AI audits and $106/$108 sandbox captures are separate evidence, not verification of a new buyer capture on this build. The hosted URL showed a sign-in gate to the browser used for QA. A local browser preview navigation timed out, so a final desktop/mobile browser walkthrough remains unverified. No claim of a prize or final organizer acceptance is made.
