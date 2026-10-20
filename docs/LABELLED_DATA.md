# Labeled evaluation data

Download `/data/offerscout-labelled-examples.json` from the app or read `public/data/offerscout-labelled-examples.json` in this repository. All merchants, prices and offers are fictional. These examples are not evidence of current PayPal offers.

There are 11 offer fixtures, 15 independently authored calculation labels, one ranking comparison, and 10 assistant prompts with expected behaviors. Monetary labels are integer US cents. The reference date is October 17, 2026; expiry is inclusive. Activation is an explicit assumption for estimates and is not verified by the prototype.

Run `node --experimental-strip-types --test tests/*.test.mjs`. Calculation and ranking labels are executable tests against the calculator. Assistant labels are acceptance examples for the future AI connection, **not passed AI evaluations**. Development and evaluation splits prevent using every example as a demonstration prompt. No model has been trained or fine-tuned on this dataset.

## Demo example

A $110 purchase at 15%, capped at $5, costs an estimated $105 after rewards. A $108 purchase at 10%, uncapped, costs an estimated $97.20. Highest percentage favors the first; lowest estimated cost favors the second. Neither estimate reduces the amount charged today.

## Cases requiring future implementation

Product exclusions, coupon stacking, personalized eligibility, activation confirmation, per-user redemption history, tax calculation, and real offer retrieval are not implemented or certified by these tests. The model must flag missing information rather than invent eligibility. Expand the schema and independent labels before supporting these conditions.
