import { offers, evaluate, money, offerSummary, type Offer, type OfferKind } from './offers.ts';
import type { ShoppingIntent } from './intent.ts';
import type { ChatContext } from './chat.ts';
import { readCustomerDeclaration } from './customer-status.ts';
import { emptyIntent, applySearchPlan } from './search-state.ts';
import { explainRecommendation, DEMO_DATE } from './recommend.ts';
import { parseMoney, parseRate, RequestClarification, type Calculation, type HelpTopic, type RequestPlan } from './request-plan.ts';

export interface AssistantAnswer { answer: string; offerIds: string[]; intent: ShoppingIntent; referencedOfferIds?: string[]; conversationContext?: ChatContext | null; }
interface Benefit { kind: OfferKind; amount: number; rate: number; cap: number | null; }
function benefitFromInput(input: NonNullable<Calculation['first']>, prompt: string): Benefit {
  const fixed = input.kind.endsWith('fixed');
  if ((fixed && !input.amount) || (!fixed && !input.rate)) throw new RequestClarification('Which benefit amount or percentage should I use for this calculation?');
  return { kind: input.kind, amount: fixed ? parseMoney(input.amount!, prompt) : 0, rate: fixed ? 0 : parseRate(input.rate!, prompt), cap: input.cap === null ? null : parseMoney(input.cap, prompt) };
}
function benefitValue(merchandise: number, benefit: Benefit): number {
  const raw = benefit.kind.endsWith('fixed') ? benefit.amount : Math.floor((merchandise * benefit.rate + 5000) / 10000);
  return Math.min(raw, merchandise, benefit.cap ?? Number.MAX_SAFE_INTEGER);
}
export function calculateRequest(calculation: Calculation, prompt: string): string {
  if (calculation.merchandise === null) throw new RequestClarification('What is the eligible merchandise price for this example?');
  const merchandise = parseMoney(calculation.merchandise, prompt);
  const shipping = calculation.shipping === null ? 0 : parseMoney(calculation.shipping, prompt);
  if (calculation.kind === 'minimum') {
    if (calculation.minimum === null) throw new RequestClarification('What minimum merchandise spend does the offer require?');
    const minimum = parseMoney(calculation.minimum, prompt);
    return `${merchandise >= minimum ? 'Yes' : 'No'}: ${money(merchandise)} merchandise ${merchandise >= minimum ? 'meets' : 'is below'} the ${money(minimum)} minimum. ${money(shipping)} shipping does not count toward that minimum. The threshold uses merchandise before the offer discount and excludes shipping and tax.`;
  }
  if (!calculation.first) throw new RequestClarification('Which discount or cashback benefit should I calculate?');
  const first = benefitFromInput(calculation.first, prompt), firstValue = benefitValue(merchandise, first);
  if (calculation.kind === 'compare') {
    if (!calculation.second) throw new RequestClarification('What is the second benefit you want to compare?');
    const second = benefitFromInput(calculation.second, prompt), secondValue = benefitValue(merchandise, second);
    const label = (benefit: Benefit): string => benefit.kind.endsWith('fixed') ? 'fixed benefit' : 'percentage benefit';
    const winner = firstValue === secondValue ? 'They tie' : firstValue > secondValue ? `The first ${label(first)} wins` : `The second ${label(second)} wins`;
    return `On ${money(merchandise)} eligible merchandise, the first ${label(first)} gives ${money(firstValue)} and the second ${label(second)} gives ${money(secondValue)}. ${winner} for this hypothetical. Caps and the merchandise limit are applied separately. Shipping and tax do not earn rewards. No rewards were earned.`;
  }
  const discount = first.kind.startsWith('discount') ? firstValue : 0;
  const reward = first.kind.startsWith('cashback') ? firstValue : 0;
  const payable = merchandise - discount + shipping;
  return `For this hypothetical ${money(merchandise)} item with ${money(shipping)} shipping: pay ${money(payable)} before tax. Instant discount: ${money(discount)}. Estimated cashback: ${money(reward)}; estimated cost afterward: ${money(payable - reward)}. Benefits cannot exceed eligible merchandise, so this cannot create a profit. Shipping and tax are excluded from the benefit calculation. No real purchase or cashback is issued.`;
}

function helpText(topic: HelpTopic, customer: boolean | null, model: string | null, version: string): string {
  const eligibility = customer === null ? 'unknown' : customer ? 'self-declared new' : 'returning';
  const facts: Record<HelpTopic, string> = {
    welcome: 'OfferScout compares fictional footwear offers. Browse Savings, ask for a merchant, Road running, Trail or Walking shoes, and compare payment today with estimated cashback. Open an offer to read its terms, bookmark merchants under Saved, or explicitly approve an optional PayPal sandbox test checkout. No real goods or rewards are issued.',
    categories: 'The sample catalog has Road running shoes, Trail hiking shoes and Walking footwear. It contains four sample products across 150 fictional merchants. You can browse Savings or ask by category, merchant, product and budget.',
    'offer-types': 'There are percentage and fixed-dollar cashback offers, plus percentage and fixed-dollar instant discounts. An eligible instant discount reduces the test payment today. Cashback is a separate estimate after payment and is not deducted from the PayPal charge. The prototype applies one offer per sample purchase; it does not stack them.',
    'catalog-source': `These are fictional sample offers and static sample prices, not a live PayPal or merchant feed. The catalog has 150 merchants and 600 sample purchase offers. Estimates use the fixed date ${DEMO_DATE}. No real rewards are issued; a future authorized data integration could replace the sample catalog.`,
    identity: 'OfferScout is an independent hackathon prototype that integrates PayPal sandbox. It is not the official PayPal app and is not presented as endorsed by PayPal. Merchant names and offers in this demo are fictional.',
    fees: 'OfferScout adds no platform fee in this demo. The sample payment includes merchandise and listed shipping, minus an eligible instant discount. Tax is unavailable. This is not a quote for real merchant or PayPal fees.',
    accounts: 'No OfferScout account is needed to browse or compare sample offers. Saved merchants are kept for this page visit. Checkout redirects to PayPal sandbox for explicit approval using a sandbox buyer account.',
    saved: 'Use the bookmark on a merchant card, then select Saved in the bottom navigation. Saved merchants live only in current-page memory: refreshing or leaving the page clears them. No account is needed.',
    privacy: 'Payment credentials are entered on PayPal’s sandbox approval page, not in this chat. The app handles sandbox order/capture IDs and a temporary signed checkout cookie. Live AI receives your question and grounded search filters to interpret the request. Do not enter payment credentials or sensitive personal details in chat.',
    memory: 'Search preferences, Saved merchants and chat history are stored only in the current page’s memory. Closing just the chat panel keeps them while that page remains open. Refreshing, leaving or opening a new visit clears them; I cannot promise to remember them tomorrow.',
    checkout: 'Open a merchant in Savings or a chat result, select a sample purchase, and review its terms and payment amount. Choose the PayPal sandbox checkout button, sign in with a sandbox buyer account, and explicitly approve the test payment. Each checkout covers one sample purchase. There is no multi-item cart, and I have not added items to a cart. Chat has not bought anything for you; no real goods or rewards are issued.',
    'autonomous-payment': 'I cannot automatically buy or charge anything from chat. Open the chosen sample purchase, review its amount and terms, then explicitly approve checkout on PayPal sandbox. Each checkout covers one sample purchase.',
    'payment-status': 'No payment was executed by this chat. If you used the separate sandbox checkout, a failure message alone does not prove whether a capture completed; look for the confirmed sandbox receipt and its order/capture status. I do not have access to your bank account or an order history. Sandbox uses test money.',
    'guest-checkout': 'The implemented flow redirects to PayPal sandbox for approval using a sandbox buyer account. I cannot promise guest checkout or particular funding options; those depend on the approval screen.',
    'earned-rewards': 'No real cashback is issued, earned or withdrawable in this demo. A confirmed sandbox payment does not prove a real reward was earned. The receipt separates the confirmed test payment from estimated cashback based on the sample terms and your self-declared eligibility.',
    fulfillment: 'This sandbox demo does not place real merchant orders, ship products, track deliveries or provide arrival dates. It only demonstrates a PayPal sandbox test payment. I cannot cancel or change an order, and I have not performed any order-management action.',
    returns: 'OfferScout has no refund, return or cancellation action. I have not changed any order or payment. No real shoes or cashback are issued, and the sample terms do not define a real returns or reward-reversal policy.',
    password: 'I cannot reset PayPal credentials. Use PayPal’s official account recovery flow. For this demo, use a sandbox buyer account and never send passwords in chat.',
    stacking: 'Offers cannot be stacked in this prototype. Each sample checkout applies one eligible offer; a coupon and cashback cannot both be credited to the same sample purchase.',
    activation: 'The sample terms require activation before purchase. Activating after payment or skipping activation does not satisfy that condition. The demo assumes activation for estimates; it does not activate a real PayPal or affiliate offer.',
    minimum: 'Minimum spend uses eligible merchandise before the offer discount. Shipping and tax do not count toward the threshold. Tell me the merchandise price and minimum, or select one sample purchase, and I can check the exact condition.',
    expiry: `The sample expiry date is inclusive: an offer remains eligible on its expiry date and expires afterward. This demo evaluates offers against the fixed sample date ${DEMO_DATE}, rather than a live offers feed.`,
    exclusions: 'Some sample offers exclude new-release products. For example, Alder Road Footwear / Cloudstep Road Runner is explicitly excluded by its sample terms. An excluded product receives $0 benefit and is not recommended. Open the purchase details to read its exact exclusions.',
    tax: 'Tax and shipping are excluded from cashback: rewards use eligible merchandise only. Listed shipping is included in payment today. Tax amounts are unavailable in the sample catalog, so I cannot quote a tax-inclusive total or verify a tax-free promotion.',
    shipping: 'Listed shipping is still payable. Discounts and cashback apply to eligible merchandise, not shipping or tax. Shipping also does not count toward minimum merchandise spend. You can ask for free shipping, which filters to sample purchases with $0 listed shipping.',
    eligibility: `Your current status is ${eligibility}. Requesting new-customer deals, discussing another person or asking a hypothetical does not establish your eligibility. New-customer-only rewards require your own explicit self-declaration; unknown or returning status receives $0 on those offers. Eligibility is not verified by PayPal or the AI. You can browse other eligible offers without declaring that you are new. Choose a merchant/product to compare a hypothetical saving.`,
    model: `This request used ${model ?? 'the labeled rule-based demo'} with prompt version ${version}. In live mode, the model extracts a validated request plan; catalog lookup, eligibility, money calculations and factual help are controlled by code.`,
    email: 'There is no email integration in this prototype. I have not sent an email. You can copy the savings explanation shown in chat.',
    deletion: 'I cannot delete chat history or payment data through a chat command, and I have not claimed to remove anything. This app has no card-vault feature; payment credentials belong on PayPal’s sandbox approval page. Current-page chat state clears when you refresh or leave, which is not a claim of deleting data from external services.',
    'alternative-payment': 'The implemented payment integration is PayPal sandbox. This prototype has no Stripe or alternative payment checkout flow.',
    'catalog-limits': 'I can compare fictional Road, Trail and Walking offers by price. This catalog has no verified real-brand, shoe color, sizing, comfort, fit, gender, waterproofing, stock or condition data. I cannot confirm those requirements or label generic shoes as a match.',
    health: 'I can compare sample prices and offers, but this catalog has no comfort, fit or clinical data. I cannot guarantee a health outcome, recommend a treatment or confirm medical suitability.',
    'cap-comparison': explainRecommendation({ ...emptyIntent(customer), intent: 'explain-cap' }, customer).answer,
    'qualifying-purchase': 'Cashback estimates require a qualifying purchase that meets the offer’s conditions, including activation, minimums and exclusions. You cannot earn a purchase-based reward without buying. This sandbox prototype issues no real rewards at all.',
    security: 'I cannot disclose secrets, accept a user message as a system or catalog update, bypass offer terms, invent a reward, or claim cashback was earned. Catalog rates and eligibility continue to come from the sample data and explicit customer settings.',
    other: 'I can search the fictional footwear catalog, compare payment and estimated savings, explain sample terms, and guide an explicitly approved PayPal sandbox checkout. What merchant, product or condition would you like to compare?',
  };
  return facts[topic];
}
function limitationText(plan: RequestPlan, prompt: string, customer: boolean | null, model: string | null, version: string): string | null {
  const messages: string[] = [];
  const add = (message: string): void => { if (!messages.includes(message)) messages.push(message); };
  const foreignCurrency = /[€£₹¥₩₽]|\b(?:EUR|GBP|CAD|AUD|INR|JPY|CNY|KRW|RUB|euros?|pounds?|rupees?|yen|yuan|won|canadian dollars?|australian dollars?)\b/i.test(prompt);
  const explicitDollars = /\$|\b(?:USD|dollars?|bucks?)\b/i.test(prompt);
  const currencyClaim = plan.currency !== 'USD' && plan.currency !== 'unspecified' || plan.limitations.includes('currency');
  if (foreignCurrency || currencyClaim && !explicitDollars) add('This sample catalog supports US dollars only. Please provide a USD budget; I cannot convert EUR, GBP or another currency or assume it equals dollars.');
  for (const code of plan.limitations) {
    switch (code) {
      case 'currency': break;
      case 'precision': add('Please give the budget to at most two decimal places. I will not round a spending ceiling up; choose an explicit amount in cents.'); break;
      case 'merchant-status': add('This prototype uses one self-declared customer status at a time. If you are new at one merchant and returning at another, compare them separately with the appropriate setting. I have not applied a global new-customer status to both.'); break;
      case 'location': add('The sample catalog has no country eligibility or international shipping data. Prices are in US dollars; I cannot confirm UK, Canada or other regional eligibility.'); break;
      case 'purchase-date': add(`I cannot confirm offers or sale prices for that purchase date. These fictional offers are evaluated only as of ${DEMO_DATE}; an offer may expire before your planned purchase. For a sample comparison at that reference date, ask for a category and budget without a future-date condition. No live or seasonal deals are verified.`); break;
      case 'delivery': add('There are no delivery dates or fulfillment data in this sandbox prototype, so I cannot promise arrival by a particular day.'); break;
      case 'reference': add('Which sample purchase do you mean? Tell me the merchant and product, or open one offer, so I can use its exact conditions.'); break;
      case 'multi-item': add('There is no multi-item cart. Each sandbox checkout covers one sample purchase and one offer. I have not added anything to a cart.'); break;
      case 'unknown-merchant': case 'product': case 'attributes': add(helpText('catalog-limits', customer, model, version)); break;
      case 'medical': add(helpText('health', customer, model, version)); break;
      case 'stacking': add(helpText('stacking', customer, model, version)); break;
      case 'secrets': case 'fabrication': add(helpText('security', customer, model, version)); break;
      case 'action': add(helpText(plan.topic === 'other' ? 'autonomous-payment' : plan.topic, customer, model, version)); break;
      case 'other': add(helpText(plan.topic, customer, model, version)); break;
    }
  }
  return messages.length ? messages.join(' ') : null;
}
function offerPriceComparison(plan: RequestPlan, prompt: string, customer: boolean | null, context: ChatContext | undefined, limitation: 'attributes' | 'medical' | 'purchase-date'): AssistantAnswer {
  const proposalBase = context?.pendingComparison ? { intent: context.pendingComparison.intent, offerIds: [] } : context;
  const proposed = { ...applySearchPlan(plan, prompt, customer, proposalBase), view: 'purchases' as const };
  const scope = proposed.category === 'Walking' ? 'Walking' : proposed.category === 'Road' ? 'Road running' : proposed.category === 'Trail' ? 'Trail' : 'Road, Trail and Walking';
  const warning = limitation === 'medical'
    ? 'The catalog has no comfort, fit or clinical data, so I cannot confirm suitability or guarantee a health outcome.'
    : 'The catalog has no verified comfort, fit, shoe color, sizing or other product-attribute data, so I cannot confirm those requirements.';
  const previous = context ? { intent: context.intent, offerIds: context.offerIds } : { intent: emptyIntent(customer), offerIds: [] };
  return {
    answer: limitation === 'purchase-date'
      ? `I can suggest ${scope} shoes with discounts or cashback from our sample catalog, but I cannot confirm Black Friday or other future sale availability or prices. These are fictional offers evaluated as of ${DEMO_DATE}, not discounts verified as available now. ${proposed.maximumPayableCents !== null ? 'Would you like me to show sample comparisons within your budget?' : 'For a sample comparison, what is your budget? Or say “show sample options” to browse without a budget.'}`
      : `${warning} I can still compare ${scope} sample offers by price and savings. Would you like me to show those price comparisons?`,
    offerIds: [], intent: { ...emptyIntent(customer), intent: 'unsupported' },
    conversationContext: { ...previous, pendingComparison: { intent: proposed, limitation } },
  };
}
function comparisonLimitation(plan: RequestPlan): 'attributes' | 'medical' | null {
  if (plan.currency !== 'USD' && plan.currency !== 'unspecified') return null;
  if (plan.limitations.some(code => code !== 'attributes' && code !== 'medical')) return null;
  if (plan.topic === 'health' || plan.limitations.includes('medical')) return 'medical';
  return plan.limitations.includes('attributes') ? 'attributes' : null;
}
function inspectPurchase(intent: ShoppingIntent, context: ChatContext | undefined, customer: boolean | null, topic: HelpTopic): AssistantAnswer {
  const candidates = offers.filter(offer => (!intent.merchant || offer.merchant === intent.merchant) && (!intent.merchantSet?.length || intent.merchantSet.includes(offer.merchant)) && (!intent.searchText || offer.product === intent.searchText));
  let selected: Offer | undefined;
  if (intent.merchant && intent.searchText && candidates.length === 1) selected = candidates[0];
  else if (context?.offerIds.length === 1) selected = candidates.find(offer => offer.id === context.offerIds[0]);
  if (!selected) throw new RequestClarification('Which of those purchases do you mean? Tell me the merchant and product so I can check its exact terms.');
  const value = evaluate(selected, customer, DEMO_DATE);
  const threshold = topic === 'minimum' || !value.eligible ? ` Merchandise ${money(selected.price)} ${selected.price >= selected.minimum ? 'meets' : 'is below'} its ${money(selected.minimum)} minimum; shipping does not count.` : '';
  return { intent, answer: `${selected.merchant} / ${selected.product}: pay ${money(value.payable)} before tax. Instant discount: ${money(value.discount)}. Estimated cashback: ${money(value.reward)}; estimated cost afterward: ${money(value.effective)}. ${value.reason}.${threshold} ${offerSummary(selected)} Estimate as of ${DEMO_DATE}; no cashback earned.`, offerIds: value.eligible ? [selected.id] : [], referencedOfferIds: [selected.id] };
}
export function executeRequestPlan(plan: RequestPlan, prompt: string, customer: boolean | null, context: ChatContext | undefined, model: string | null, version: string): AssistantAnswer {
  const unsupported = { ...emptyIntent(customer), intent: 'unsupported' as const };
  if (plan.action === 'refuse') return { answer: helpText('security', customer, model, version), offerIds: [], intent: unsupported };
  if (plan.limitations.includes('purchase-date')) {
    if (plan.limitations.length === 1 && (plan.currency === 'USD' || plan.currency === 'unspecified')) return offerPriceComparison(plan, prompt, customer, context, 'purchase-date');
    return { answer: limitationText(plan, prompt, customer, model, version)!, offerIds: [], intent: unsupported, conversationContext: context ? { intent: context.intent, offerIds: context.offerIds } : null };
  }
  if (plan.action === 'decline-comparison') return {
    answer: 'Okay. What merchant or category would you like to explore instead?', offerIds: [], intent: unsupported,
    conversationContext: context ? { intent: context.intent, offerIds: context.offerIds } : null,
  };
  if (plan.action === 'accept-comparison' || plan.action === 'search' && plan.scope === 'refine' && context?.pendingComparison?.limitation === 'purchase-date') {
    if (!context?.pendingComparison) throw new RequestClarification('There is no pending price comparison to accept. What category or merchant would you like to browse?');
    if (plan.limitations.length) {
      const limitation = comparisonLimitation(plan);
      if (limitation) return offerPriceComparison({ ...plan, scope: 'refine' }, prompt, customer, context, limitation);
      throw new RequestClarification('I cannot verify the extra requirement. Do you want only the previously offered price comparison?');
    }
    const intent = applySearchPlan({ ...plan, scope: 'refine' }, prompt, customer, { intent: context.pendingComparison.intent, offerIds: [] });
    const result = explainRecommendation(intent, customer);
    const warning = context.pendingComparison.limitation === 'purchase-date'
      ? `Sample comparisons as of ${DEMO_DATE} only; these are not confirmed current discounts or Black Friday deals, and future availability is unverified.`
      : 'These are price comparisons only; comfort, fit, medical suitability and the previously requested attributes are not verified.';
    return { ...result, intent, answer: `${warning} ${result.answer}` };
  }
  const comparison = comparisonLimitation(plan);
  if ((plan.action === 'help' || plan.action === 'search') && comparison) return offerPriceComparison(plan, prompt, customer, context, comparison);
  if (plan.action === 'search' && plan.scope === 'refine' && context?.pendingComparison) return offerPriceComparison(plan, prompt, customer, context, context.pendingComparison.limitation);
  const limitation = limitationText(plan, prompt, customer, model, version);
  if (limitation) {
    const primary = plan.action === 'help' && plan.topic !== 'other' ? helpText(plan.topic, customer, model, version) : '';
    return { answer: primary && !limitation.includes(primary) ? `${primary} ${limitation}` : limitation, offerIds: [], intent: { ...unsupported, intent: plan.action === 'help' && plan.topic === 'tax' ? 'tax-unknown' : 'unsupported' } };
  }
  if (plan.action === 'clarify') throw new RequestClarification('Please specify the merchant, product or exact amount you want to compare. I have kept your previous search settings.');
  if (plan.action === 'calculate') {
    if (!plan.calculation) throw new RequestClarification('Which purchase amount and offer conditions should I calculate?');
    return { answer: calculateRequest(plan.calculation, prompt), offerIds: [], intent: unsupported };
  }
  if (plan.action === 'help') {
    if (plan.topic === 'eligibility' && readCustomerDeclaration(prompt) !== 'conflict' && (plan.filters.merchants?.length || plan.scope === 'refine' && context)) {
      const intent = applySearchPlan(plan, prompt, customer, context);
      const recommendation = explainRecommendation(intent, customer);
      return { ...recommendation, intent, answer: `${helpText('eligibility', customer, model, version)} ${recommendation.answer}` };
    }
    return { answer: `${plan.topic === 'eligibility' && readCustomerDeclaration(prompt) === 'conflict' ? 'Your declarations conflict, so eligibility is now unknown. Please clarify your own status. ' : ''}${helpText(plan.topic, customer, model, version)}`, offerIds: [], intent: { ...unsupported, intent: plan.topic === 'tax' ? 'tax-unknown' : 'unsupported' } };
  }
  const intent = applySearchPlan(plan, prompt, customer, context);
  if (plan.action === 'inspect') return inspectPurchase(intent, context, customer, plan.topic);
  return { ...explainRecommendation(intent, customer), intent };
}
