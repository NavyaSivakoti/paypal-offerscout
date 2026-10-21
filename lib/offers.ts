import { merchantNames, type Merchant } from './merchants.ts';
export type { Merchant } from './merchants.ts';
export const OFFER_KINDS = ['cashback-percent', 'cashback-fixed', 'discount-fixed', 'discount-percent'] as const;
export type OfferKind = typeof OFFER_KINDS[number];
export const OFFER_FILTERS = [...OFFER_KINDS, 'cashback', 'discount'] as const;
export type OfferFilter = typeof OFFER_FILTERS[number];
export interface Offer {
  id: string; merchant: Merchant; product: string; category: 'Road' | 'Trail' | 'Walking';
  price: number; shipping: number; rate: number; cap: number | null; minimum: number;
  newCustomerOnly: boolean; expires: string; color: string; terms: string;
  kind?: OfferKind; amountOff?: number; rewardExcluded?: boolean; exclusionReason?: string; couponCode?: string;
}
export interface Evaluation {
  subtotal: number; discount: number; payable: number; reward: number; effective: number; eligible: boolean; reason: string;
}
export const money = (cents: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const offerKind = (offer: Offer): OfferKind => offer.kind ?? 'cashback-percent';
export function offerHeadline(offer: Offer): { value: string; label: string } {
  switch (offerKind(offer)) {
    case 'cashback-fixed': return { value: money(offer.amountOff ?? 0), label: 'estimated cash back' };
    case 'discount-fixed': return { value: money(offer.amountOff ?? 0), label: 'off at test checkout' };
    case 'discount-percent': return { value: `${offer.rate}%`, label: 'off at test checkout' };
    default: return { value: `${offer.rate}%`, label: 'estimated cashback' };
  }
}
export function offerSummary(offer: Offer): string {
  const headline = offerHeadline(offer);
  return `${headline.value} ${headline.label}${offer.cap === null ? '' : `, capped at ${money(offer.cap)}`}${offer.minimum ? `; minimum merchandise spend ${money(offer.minimum)}` : ''}${offer.newCustomerOnly ? '; new customers only' : ''}${offer.rewardExcluded ? `; ${offer.exclusionReason ?? 'sample product excluded'}` : ''}; expires ${offer.expires}.`;
}
export function evaluate(offer: Offer, newCustomer: boolean | null, now = '2026-10-17'): Evaluation {
  const eligible = now <= offer.expires && offer.price >= offer.minimum && !offer.rewardExcluded && (!offer.newCustomerOnly || newCustomer === true);
  const reason = now > offer.expires ? 'Offer expired' : offer.rewardExcluded ? (offer.exclusionReason ?? 'Product excluded from this offer') : offer.price < offer.minimum ? 'Minimum spend not met' : offer.newCustomerOnly && newCustomer === null ? 'New-customer eligibility unverified' : offer.newCustomerOnly && !newCustomer ? 'New customers only' : 'Meets the sample offer conditions';
  const kind = offerKind(offer);
  const rawBenefit = kind.endsWith('fixed') ? (offer.amountOff ?? 0) : Math.round(offer.price * offer.rate / 100);
  // Benefits cannot exceed eligible merchandise; shipping never earns or funds a benefit.
  const benefit = eligible ? Math.min(rawBenefit, offer.cap ?? Number.MAX_SAFE_INTEGER, offer.price) : 0;
  const discount = kind.startsWith('discount') ? benefit : 0;
  const reward = kind.startsWith('cashback') ? benefit : 0;
  const payable = offer.price - discount + offer.shipping;
  return { subtotal: offer.price, discount, payable, reward, effective: payable - reward, eligible, reason };
}
export const productNames = ['Cloudstep Road Runner', 'Ridgeline Trail Shoe', 'Everyday Walking Shoe', 'Tempo Road Runner'] as const;
const products = productNames;
const colors = ['#dce8c9', '#ead9cc', '#d7e3f0', '#eee2c9', '#e2d9ee', '#d6e8e2'];
// Preserve original IDs and amounts: existing sandbox checkout bindings remain valid.
export const demoOffers: Offer[] = merchantNames.slice(0, 3).flatMap((merchant, m) => products.map((product, p) => ({
  id: `offer-${m}-${p}`, merchant, product, category: p === 1 ? 'Trail' : p === 2 ? 'Walking' : 'Road', price: [11000, 10800, 9900][m] + p * 800, shipping: m === 2 ? 700 : 0, rate: [15, 10, 8][m], cap: m === 0 ? 500 : null, minimum: p === 3 ? 15000 : 0, newCustomerOnly: m === 2 && p === 1, expires: '2026-11-30', color: colors[m],
  terms: `${[15, 10, 8][m]}% estimated rewards on eligible merchandise subtotal, excluding shipping and tax.${m === 0 ? ' Maximum reward $5 per order.' : ''}${p === 3 ? ' Minimum merchandise spend $150.' : ''}${m === 2 && p === 1 ? ' New customers only.' : ''} Activate before purchase. Sample offer expires November 30, 2026. No real rewards are issued.`,
})));
function expandedOffers(): Offer[] {
  return merchantNames.slice(3).flatMap((merchant, index) => products.map((product, p): Offer => {
    const kind = OFFER_KINDS[index % 4];
    const price = 6000 + ((index * 137 + p * 1700) % 15001);
    const shipping = [0, 0, 495, 700, 995, 1200][index % 6];
    const rate = kind.endsWith('percent') ? [2, 3, 5, 7.5, 8, 10, 12, 15, 20][(index + p) % 9] : 0;
    const amountOff = kind.endsWith('fixed') ? [500, 1000, 1500, 2000, 2500][(index + p) % 5] : undefined;
    const cap = kind === 'cashback-percent' && index % 3 === 0 ? [300, 500, 1000, 2000][p] : null;
    const minimum = [0, 5000, 7500, 10000, 15000][(index + p) % 5];
    const newCustomerOnly = kind.startsWith('cashback') && (index + p) % 7 === 0;
    const expires = index % 17 === 0 ? '2026-10-10' : ['2026-10-31', '2026-11-12', '2026-11-30', '2026-12-15'][index % 4];
    const rewardExcluded = (index * 4 + p) % 23 === 0;
    const exclusionReason = rewardExcluded ? 'This sample product is a new release excluded from the offer' : undefined;
    const couponCode = kind.startsWith('discount') ? `SCOUT${amountOff ? amountOff / 100 : rate}` : undefined;
    const offer: Offer = { id: `catalog-${String(index + 3).padStart(3, '0')}-${p}`, merchant, product, category: p === 1 ? 'Trail' : p === 2 ? 'Walking' : 'Road', price, shipping, rate, cap, minimum, newCustomerOnly, expires, color: colors[index % colors.length], kind, amountOff, rewardExcluded, exclusionReason, couponCode, terms: '' };
    offer.terms = `${offerSummary(offer)} Benefits apply to eligible merchandise only; shipping and tax are excluded. Minimum spend is checked before this offer's discount and excludes shipping. ${couponCode ? `Sample code ${couponCode} is applied automatically only when eligible in our sandbox demo. This is an immediate discount, not cashback.` : 'Activate before purchase; activation is assumed. Cashback is estimated after payment, not deducted at checkout.'} Cannot be combined with another offer in this prototype. No real purchase, coupon redemption, or rewards are issued.`;
    return offer;
  }));
}
export const offers: Offer[] = [...demoOffers, ...expandedOffers()];
