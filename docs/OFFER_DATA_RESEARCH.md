# Footwear offer research and synthetic catalog

Researched October 20, 2026. Dataset `offerscout-footwear-v1` contains **150 fictional merchants and 600 sample purchase offers**. It is a reproducible test catalog, not 150 real merchant integrations, a live price feed, or a copy of PayPal consumer offers. Merchant names, rates, prices, codes, and dates are invented. No third-party logos or product photography are included.

## Sources and patterns

- [Rakuten footwear directory](https://www.rakuten.com/shoes): footwear merchants, percentage cashback, “up to” rates, and category browsing. These inspired category and rate variety rather than copied current rates.
- [Rakuten Nike listing](https://www.rakuten.com/shop/nike): product/new-release exclusions, shipping information, and separate cashback versus promotional discounts. The sample catalog models a product exclusion flag, not Nike's entire policy.
- [Rakuten exclusions help](https://www.rakuten.com/help/exclusions.htm): shipping/tax exclusions and restrictions on combining promotions. Gift-card payment tracking is not implemented.
- [RetailMeNot public app description](https://apps.apple.com/us/app/retailmenot-rewards-codes/id521207075): cashback, coupon codes, dollar-denominated bonuses, and discount comparisons. This is a public description, not a merchant-rate feed.
- [Ziff Davis terms covering RetailMeNot](https://www.ziffdavis.com/terms-of-use): qualifying purchases, promotion-specific conditions, minimum purchase amounts, and bonus rewards.

RetailMeNot merchant detail pages were not readable through the research tool. We do not claim their current merchant rates were verified. The “save $5” fixtures are invented common promotion patterns. Dollar cashback and checkout discounts are deliberately separate.

## Supported behavior

| Offer kind | Example | Checkout payment | Estimated reward |
| --- | --- | --- | --- |
| Percentage cashback | 10% back, optionally capped | Merchandise + shipping | Percentage of eligible merchandise, subject to cap |
| Fixed cashback | Get $5 back | Merchandise + shipping | Fixed eligible amount |
| Fixed discount | Save $5 now | Merchandise − eligible $5 discount + shipping | $0 |
| Percentage discount | 20% off | Merchandise − eligible percentage discount + shipping | $0 |

Minimum spend uses the merchandise price before this offer's discount, excluding shipping. Benefits cannot exceed merchandise cost. Expiry is inclusive. Expired, below-minimum, excluded, or unverified new-customer offers provide zero benefit. A buyer can still test paying the ordinary sample price when a benefit is ineligible; the interface says why. New-customer restrictions are confined to cashback offers so the sandbox discount amount does not depend on an unverified client declaration.

One offer applies to a sample purchase. Coupon codes are fictional explanatory labels automatically applied by our sandbox catalog logic when eligible. No external code redemption, affiliate activation verification, coupon stacking, gift-card tracking, returns adjustment, real merchant checkout, or reward fulfillment is implemented. All sample merchants pay the same configured sandbox seller.

## Reproduction and labels

- `lib/merchants.ts`: 3 original demo names plus 147 combinations of 21 prefixes and 7 footwear store formats.
- `lib/offers.ts`: stable IDs and deterministic prices, shipping, percentages, fixed benefits, minimums, caps, exclusions, customer conditions, and expirations; no random generation or network dependency.
- `pnpm catalog:export`: writes `public/data/offerscout-catalog.json`, including provenance and all 600 offers. The generated export is ignored by Git and regenerated for dev/build; all generator source is public.
- `public/data/offerscout-mixed-offer-cases.json`: 28 hand-labeled calculations and 12 assistant intent examples. Monetary expectations are written independently of the production calculator. These are development tests, not a holdout benchmark.
- `tests/catalog.test.mjs`: schema/uniqueness coverage, all 600 payment-body amounts, financial conservation, filter/ranking boundaries, bounded assistant results, and invalid merchant rejection.

Estimates use the fixed demo date October 17, 2026, disclosed in the UI. Mixed expiry dates intentionally include expired test offers. Data volume is for testing; it is not evidence of customer adoption, commercial partnerships, or product impact.

Structured intent canonicalization maps equivalent family-plus-dollar filters to a fixed benefit kind, and highest-cashback sorting to percentage cashback. It preserves the payment budget, dollar amount, merchant, and category.
