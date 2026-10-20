import type { ShoppingIntent } from './intent.ts';
import { offers, evaluate, money, offerKind, offerSummary, type Offer } from './offers.ts';
export const DEMO_DATE = '2026-10-17';
export function matchingOffers(intent: ShoppingIntent, customer: boolean | null, catalog: Offer[] = offers): Offer[] {
  if (intent.intent !== 'search') return [];
  return catalog.filter(offer => (!intent.merchant || offer.merchant === intent.merchant) && (!intent.category || offer.category === intent.category) && (!intent.offerType || offerKind(offer).startsWith(intent.offerType)) && (intent.benefitAmountCents == null || (offerKind(offer).endsWith('fixed') && offer.amountOff === intent.benefitAmountCents)) && (intent.sort !== 'headline-rate' || offerKind(offer) === 'cashback-percent') && (!intent.searchText || `${offer.product} ${offer.merchant}`.toLowerCase().includes(intent.searchText.toLowerCase())) && (intent.maximumPayableCents === null || evaluate(offer, customer, DEMO_DATE).payable <= intent.maximumPayableCents)).sort((a, b) => {
    const ea = evaluate(a, customer, DEMO_DATE), eb = evaluate(b, customer, DEMO_DATE);
    return (intent.sort === 'headline-rate' ? b.rate - a.rate : intent.sort === 'payable' ? ea.payable - eb.payable : ea.effective - eb.effective) || a.id.localeCompare(b.id);
  });
}
export function explainRecommendation(intent: ShoppingIntent, customer: boolean | null, catalog: Offer[] = offers): { answer: string; offerIds: string[] } {
  if (intent.intent === 'explain-cap') return { answer: 'At $110, 15% would be $16.50, but the $5 cap limits estimated rewards to $5: estimated cost $105. At $108, 10% uncapped gives $10.80 estimated rewards: estimated cost $97.20. The lower rate wins between these two fictional examples; they are not a claim about the entire catalog. No rewards were earned.', offerIds: ['offer-0-0', 'offer-1-0'] };
  if (intent.intent === 'explain-minimum') return { answer: 'Shipping does not count toward minimum merchandise spend in these sample terms. A $140 item plus $20 shipping does not meet a $150 merchandise minimum. Instant-discount minimums use merchandise price before the offer discount.', offerIds: [] };
  if (intent.intent === 'tax-unknown') return { answer: 'Tax is not available in this sample catalog. Prices include listed shipping but exclude tax; I cannot give a total including tax.', offerIds: [] };
  if (intent.intent === 'unsupported') return { answer: 'I can compare the fictional shoe offers in this catalog. I cannot verify real merchant offers, invent cashback, or confirm rewards earned. Try a sample merchant, road shoes, trail shoes, or walking shoes. Offers are not stacked.', offerIds: [] };
  const choices = matchingOffers(intent, customer, catalog), best = choices[0];
  if (!best) return { answer: 'No sample offers match those conditions. Try another budget, offer type, or sample merchant. Your budget has not been increased automatically.', offerIds: [] };
  const note = customer === false ? 'You declared that you are a returning customer. New-customer-only offers are ineligible and receive $0 estimated rewards. ' : '';
  if (intent.maximumPayableCents === null && !intent.category && !intent.searchText) {
    const seen = new Set<string>();
    const representatives = choices.filter(offer => { if (seen.has(offer.merchant)) return false; seen.add(offer.merchant); return true; });
    const summary = representatives.slice(0, 5).map(offer => `${offer.merchant}: ${offerSummary(offer)}`).join('\n');
    return { answer: `${note}${representatives.length} matching fictional merchants. Showing ${Math.min(5, representatives.length)} here; browse all matches in Savings.\n${summary}\nTerms vary by sample purchase. Discounts reduce the test payment; cashback is estimated separately. Activation is assumed. These are fictional offers, not rewards earned.`, offerIds: representatives.slice(0, 12).map(offer => offer.id) };
  }
  const value = evaluate(best, customer, DEMO_DATE);
  const criterion = intent.sort === 'headline-rate' ? 'highest headline cashback rate (percentage cashback only)' : intent.sort === 'payable' ? 'lowest payment today' : 'lowest estimated cost after rewards';
  return { answer: `${note}${best.merchant}’s ${best.product} ranks first by ${criterion}. Pay ${money(value.payable)} today, before tax. Instant discount: ${money(value.discount)}. Estimated rewards: ${money(value.reward)}; estimated cost afterward: ${money(value.effective)}. ${value.reason}. ${offerSummary(best)} ${choices.length} matching sample purchases; the Savings screen shows all matches. Estimates assume activation and use October 17, 2026. Only one offer applies to each sample purchase.`, offerIds: choices.slice(0, 12).map(offer => offer.id) };
}
