# Labeled evaluation data

Download `/data/offerscout-labelled-examples.json` from the app or read `public/data/offerscout-labelled-examples.json` in this repository. All merchants, prices and offers are fictional. These examples are not evidence of current PayPal offers.

There are 11 offer fixtures, 15 independently authored calculation labels, one ranking comparison, and 10 assistant prompts with expected behaviors. Monetary labels are integer US cents. The reference date is October 17, 2026; expiry is inclusive. Activation is an explicit assumption for estimates and is not verified by the prototype.

Run `node --experimental-strip-types --test tests/*.test.mjs`. Calculation and ranking labels are executable tests against the calculator. The assistant labels describe desired behaviors and do not all map one-to-one to API fields. On October 20, 2026, the ten assistant prompts and two additional integration cases were exercised against the actual hosted AI connection. See [the live acceptance report](LIVE_ACCEPTANCE_RESULTS.json) for the exact assertions and observed responses. All 12 acceptance checks passed with `gpt-4o-mini` and `offerscout-intent-v4`; this does not assert every descriptive label field or establish general model accuracy. Prompt and eligibility fixes used observed development failures, so the result is not an untouched holdout benchmark. No model has been trained or fine-tuned on this dataset. The original dataset execution-status fields describe the standalone dataset harness; the dated report is the current hosted execution record.

## Demo example

A $110 purchase at 15%, capped at $5, costs an estimated $105 after rewards. A $108 purchase at 10%, uncapped, costs an estimated $97.20. Highest percentage favors the first; lowest estimated cost favors the second. Neither estimate reduces the amount charged today.

## Cases requiring future implementation

Product exclusions, coupon stacking, personalized eligibility, activation confirmation, per-user redemption history, tax calculation, and real offer retrieval are not implemented or certified by these tests. The model must flag missing information rather than invent eligibility. Expand the schema and independent labels before supporting these conditions.
