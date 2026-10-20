import { writeFileSync } from 'node:fs';
import { offers, OFFER_KINDS } from '../lib/offers.ts';
import { merchantNames } from '../lib/merchants.ts';
export function exportCatalog(): string {
  return `${JSON.stringify({
    datasetVersion: 'offerscout-footwear-v1', sourceKind: 'synthetic', asOf: '2026-10-17', researchedOn: '2026-10-20',
    disclosure: 'Fictional merchants and invented offers inspired by public offer patterns. Not live offers from Rakuten, RetailMeNot, or PayPal. No affiliation or rewards issued.',
    sources: ['https://www.rakuten.com/shoes', 'https://www.rakuten.com/shop/nike', 'https://www.rakuten.com/help/exclusions.htm', 'https://www.ziffdavis.com/terms-of-use', 'https://apps.apple.com/us/app/retailmenot-rewards-codes/id521207075'],
    merchantCount: merchantNames.length, offerCount: offers.length, supportedOfferKinds: OFFER_KINDS, merchants: merchantNames, offers,
  }, null, 2)}\n`;
}
writeFileSync(new URL('../public/data/offerscout-catalog.json', import.meta.url), exportCatalog());
console.log(`Exported ${merchantNames.length} fictional merchants and ${offers.length} sample purchase offers.`);
