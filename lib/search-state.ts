import { intentSchema, normalizeIntent, type ShoppingIntent } from './intent.ts';
import { offers, productNames } from './offers.ts';
import type { ChatContext } from './chat.ts';
import { parseMoney, parseRate, requireEvidence, RequestClarification, validateBudgetEvidence, type RequestPlan } from './request-plan.ts';

export function emptyIntent(customer: boolean | null): ShoppingIntent {
  return intentSchema.parse({ intent: 'search', merchant: null, merchantSet: [], merchantPrefix: null, category: null, searchText: null, maximumPayableCents: null, minimumPayableCents: null, maximumEffectiveCents: null, sort: 'effective-cost', newCustomer: customer, offerType: null, benefitAmountCents: null, ratePercent: null, minimumRatePercent: null, maximumRatePercent: null, budgetBasis: 'payable', freeShipping: false, newCustomerOffersOnly: false, view: 'purchases' });
}
export function applySearchPlan(plan: RequestPlan, prompt: string, customer: boolean | null, context?: ChatContext): ShoppingIntent {
  if (plan.scope === 'refine' && !context) throw new RequestClarification('Which previous offers do you mean? Tell me the merchant, product or category first.');
  const previous = plan.scope === 'refine' && context ? intentSchema.parse(context.intent) : emptyIntent(customer);
  const result: ShoppingIntent = { ...previous, intent: 'search', newCustomer: customer };
  let payment = previous.budgetBasis === 'effective' ? null : previous.maximumPayableCents;
  let effective = previous.maximumEffectiveCents ?? (previous.budgetBasis === 'effective' ? previous.maximumPayableCents : null);
  const seen = new Set<string>();
  for (const change of [...plan.updates].sort((a, b) => Number(b.field === 'offerType') - Number(a.field === 'offerType'))) {
    if (seen.has(change.field)) throw new RequestClarification('I found conflicting changes to the same filter. Please state the final condition you want.');
    seen.add(change.field);
    requireEvidence(change.evidence, prompt);
    const raw = plan.filters[change.field];
    const clear = change.operation === 'clear';
    if ((clear && raw !== null) || (!clear && raw === null)) throw new RequestClarification('I could not determine whether to replace or remove a filter. Your previous search has been kept.');
    if (!clear && ['maximumPayment', 'minimumPayment', 'maximumEffective', 'benefit', 'rate'].includes(change.field) && typeof raw === 'string') requireEvidence(raw, change.evidence);
    switch (change.field) {
      case 'merchants': {
        const value = clear ? [] : plan.filters.merchants!;
        for (const merchant of value) requireEvidence(merchant, change.evidence);
        result.merchantSet = value; result.merchant = value.length === 1 ? value[0] : null; result.merchantPrefix = null;
        break;
      }
      case 'merchantPrefix':
        result.merchantPrefix = clear ? null : plan.filters.merchantPrefix;
        if (!clear) { requireEvidence(plan.filters.merchantPrefix!, change.evidence); result.merchant = null; result.merchantSet = []; }
        break;
      case 'category': result.category = clear ? null : plan.filters.category; break;
      case 'product': if (!clear) requireEvidence(plan.filters.product!, change.evidence); result.searchText = clear ? null : plan.filters.product; break;
      case 'maximumPayment':
        if (clear) payment = null;
        else { validateBudgetEvidence(plan.filters.maximumPayment!, change.evidence); payment = parseMoney(plan.filters.maximumPayment!, prompt); }
        break;
      case 'minimumPayment':
        if (clear) result.minimumPayableCents = null;
        else { validateBudgetEvidence(plan.filters.minimumPayment!, change.evidence); result.minimumPayableCents = parseMoney(plan.filters.minimumPayment!, prompt); }
        break;
      case 'maximumEffective':
        if (clear) effective = null;
        else { validateBudgetEvidence(plan.filters.maximumEffective!, change.evidence); effective = parseMoney(plan.filters.maximumEffective!, prompt); }
        break;
      case 'offerType':
        result.offerType = clear ? null : plan.filters.offerType;
        // A general/all-types request must not retain an incompatible exact benefit/rate.
        if (clear || !result.offerType?.endsWith('fixed')) result.benefitAmountCents = null;
        if (clear || !result.offerType?.endsWith('percent')) { result.ratePercent = null; result.minimumRatePercent = null; result.maximumRatePercent = null; }
        break;
      case 'benefit': result.benefitAmountCents = clear ? null : parseMoney(plan.filters.benefit!, prompt); break;
      case 'rate': {
        result.ratePercent = null; result.minimumRatePercent = null; result.maximumRatePercent = null;
        if (!clear) {
          const percent = parseRate(plan.filters.rate!, prompt) / 100;
          if (plan.filters.rateComparison === 'at-least') result.minimumRatePercent = percent;
          else if (plan.filters.rateComparison === 'at-most') result.maximumRatePercent = percent;
          else result.ratePercent = percent;
        }
        break;
      }
      case 'rateComparison': break; // The associated rate update is the atomic numeric constraint.
      case 'freeShipping': result.freeShipping = clear ? false : plan.filters.freeShipping!; break;
      case 'newCustomerOffersOnly': result.newCustomerOffersOnly = clear ? false : plan.filters.newCustomerOffersOnly!; break;
      case 'sort': result.sort = clear ? 'effective-cost' : plan.filters.sort!; break;
      case 'view': result.view = clear ? 'purchases' : plan.filters.view!; break;
    }
  }
  // Apply semantic dependencies after all operations, independent of their order.
  if (seen.has('offerType') && result.offerType === null) { result.benefitAmountCents = null; result.ratePercent = null; result.minimumRatePercent = null; result.maximumRatePercent = null; }
  if (seen.has('product') && result.searchText) result.category = offers.find(offer => offer.product === result.searchText)?.category ?? result.category;
  if (seen.has('category') && !seen.has('product') && result.searchText && offers.find(offer => offer.product === result.searchText)?.category !== result.category) result.searchText = null;
  if (payment !== null && result.minimumPayableCents != null && result.minimumPayableCents > payment) throw new RequestClarification('The lower price bound exceeds the upper budget. Which price range should I use?');
  result.maximumEffectiveCents = effective;
  result.maximumPayableCents = payment ?? effective;
  result.budgetBasis = payment === null && effective !== null ? 'effective' : 'payable';
  if (result.searchText && !productNames.some(name => name === result.searchText)) throw new RequestClarification('That product is not in the sample catalog.');
  return intentSchema.parse(normalizeIntent(result));
}
