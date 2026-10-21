import { z } from 'zod';
import { intentSchema, normalizeIntent, type ShoppingIntent } from './intent.ts';
import { merchantNames } from './merchants.ts';
import { offers, evaluate, money, offerKind, productNames } from './offers.ts';
import { DEMO_DATE, matchingOffers } from './recommend.ts';

// Context carries catalog filters and IDs, never user-supplied prices or reward totals.
export const chatContextSchema = z.object({ intent: intentSchema, offerIds: z.array(z.string().max(80)).max(12) }).strict();
export type ChatContext = z.infer<typeof chatContextSchema>;
export const isFollowUp = (prompt: string): boolean => /\b(those|these|ones|that|actually|i meant|instead|same|cheaper)\b/i.test(prompt) && !/\b(?:offers?|shoes|purchases?|merchants?)\s+that\b/i.test(prompt) && !/\b(start over|reset|new search|forget|clear)\b/i.test(prompt);
export const isMerchantView = (intent: ShoppingIntent): boolean => intent.view === 'merchants' || (intent.view == null && intent.maximumPayableCents === null && !intent.category && !intent.searchText && intent.sort !== 'payable');
const dollars = (value: string): number => { const [whole, fraction = ''] = value.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0')); };
const numeric = '(\\d+(?:\\.\\d{1,2})?)';

export function resolveSearch(prompt: string, extracted: ShoppingIntent, context?: ChatContext): ShoppingIntent {
  const text = prompt.toLowerCase();
  let intent = { ...extracted };
  if (extracted.intent !== 'search' && !(isFollowUp(prompt) && context) && !/not expired|have not expired|active offers|every merchant|all merchants/.test(text)) return { ...extracted, merchant: null, category: null, searchText: null, maximumPayableCents: null, ratePercent: null, benefitAmountCents: null, offerType: null, budgetBasis: 'payable', view: 'purchases' };
  if (isFollowUp(prompt) && context?.intent.intent === 'search') {
    const previous = context.intent;
    intent = { ...previous, ...intent,
      merchant: intent.merchant ?? previous.merchant,
      category: intent.category ?? previous.category,
      searchText: intent.searchText ?? previous.searchText,
      maximumPayableCents: intent.maximumPayableCents ?? previous.maximumPayableCents,
      offerType: intent.offerType ?? previous.offerType,
      benefitAmountCents: intent.benefitAmountCents ?? previous.benefitAmountCents,
      budgetBasis: previous.budgetBasis ?? 'payable',
      ratePercent: intent.ratePercent ?? previous.ratePercent,
      newCustomerOffersOnly: previous.newCustomerOffersOnly,
      intent: 'search', view: 'purchases',
    };
    if (!/cash\s*back|discount|off|coupon|percent|rate/.test(text)) intent.offerType = previous.offerType;
    if (/\bcheapest|cheaper\b/.test(text)) intent.sort = /today/.test(text) ? 'payable' : 'effective-cost';
    if (/\bi meant|\binstead/.test(text) && /\$\d+.*off/.test(text)) { intent.offerType = 'discount-fixed'; intent.ratePercent = null; }
    const correction = text.match(new RegExp('(?:make that|budget(?: is| of)?|under|below|up to)\\s*\\$?\\s*' + numeric + '(?!\\d|\\.\\d|%)'));
    if (correction) intent.maximumPayableCents = dollars(correction[1]);
  }
  const merchant = merchantNames.find(name => text.includes(name.toLowerCase()));
  if (merchant) intent.merchant = merchant;
  const productText = merchant ? text.replace(merchant.toLowerCase(), '') : text;
  const category = /trail/.test(productText) ? 'Trail' : /walking/.test(productText) ? 'Walking' : /running|road/.test(productText) ? 'Road' : null;
  if (category) intent.category = category;
  const product = productNames.find(name => productText.includes(name.toLowerCase()));
  if (product) intent.searchText = product;
  else if (category && isFollowUp(prompt) && context?.intent.category !== category) intent.searchText = null;
  const budget = productText.match(new RegExp('(?:under|below|up to|budget(?: of| is)?|can pay)\\s*\\$?\\s*' + numeric + '(?!\\d|\\.\\d|%)'));
  if (budget) intent.maximumPayableCents = dollars(budget[1]);
  if (/after\s+(?:estimated\s+)?cash\s*back|after\s+(?:estimated\s+)?rewards/.test(text)) intent.budgetBasis = 'effective';
  else if (!isFollowUp(prompt)) intent.budgetBasis = 'payable';
  if (/best value|after cashback|after rewards/.test(text)) { intent.sort = 'effective-cost'; if (/after cashback/.test(text)) intent.offerType = 'cashback'; }
  if (/cheapest.*today|cost.*least.*today|lowest.*(?:payment|price).*today/.test(text)) intent.sort = 'payable';
  const rate = productText.match(new RegExp(numeric + '\\s*%\\s*(off|cash\\s*back|back|discount)'));
  if (rate) { intent.ratePercent = Number(rate[1]); intent.benefitAmountCents = null; intent.offerType = /off|discount/.test(rate[2]) ? 'discount-percent' : 'cashback-percent'; }
  const fixed = productText.match(new RegExp('\\$' + numeric + '\\s*(?:cash\\s*)?(back|off)')) ?? productText.match(new RegExp('(save|get)\\s*\\$' + numeric));
  if (fixed && !rate) {
    const amount = /^\d/.test(fixed[1]) ? fixed[1] : fixed[2];
    intent.benefitAmountCents = dollars(amount);
    intent.offerType = /\boff\b|\bsave\b|not wait.*cashback/.test(productText) ? 'discount-fixed' : 'cashback-fixed';
    intent.ratePercent = null;
  }
  if (/new[ -]customer (?:only )?(?:offers|deals)/.test(text)) intent.newCustomerOffersOnly = true;
  if (/every merchant|all merchants|which merchants|show.*merchant.*offers|show.*offers/.test(text) && !category && !intent.searchText && intent.maximumPayableCents === null && !/cheapest|best value|lowest/.test(text)) intent.view = 'merchants';
  else intent.view = 'purchases';
  if (/not expired|have not expired|active offers|every merchant|all merchants/.test(text)) intent.intent = 'search';
  return normalizeIntent(intent);
}

export interface GuideAnswer { answer: string; offerIds: string[]; intent?: ShoppingIntent['intent']; }
const guide = (answer: string, intent: ShoppingIntent['intent'] = 'unsupported'): GuideAnswer => ({ answer, offerIds: [], intent });

// Product help comes from the implemented app, not a model guessing its capabilities.
export function answerGuide(prompt: string, customer: boolean | null, context?: ChatContext): GuideAnswer | null {
  const t = prompt.toLowerCase().replace(/[’‘]/g, "'");
  if (/api key|client secret|password.*(?:show|tell)|ignore.*(?:rules|terms)|pretend.*new customer/.test(t)) return guide('I cannot disclose secrets, bypass offer terms, or fabricate cashback earned. Customer eligibility must be self-declared; it is never verified by the AI.');
  if (/\b(nike|adidas|macy'?s|rakuten|retailmenot)\b/.test(t)) return guide('That real brand or merchant is not in our fictional footwear catalog. I cannot verify its offers or substitute generic shoes as a match. Try a sample merchant such as Trail & Field.');
  if (/laptop|jacket|gift card|\bphone\b/.test(t)) return guide('This sample catalog contains fictional footwear only: Road running shoes, Trail shoes, and Walking shoes. I cannot verify or invent offers for that product.');
  if (/waterproof|\bsize\b|women'?s|men'?s|child|wide fit/.test(t)) return guide('The sample catalog has no size, fit, gender, waterproofing, or stock data. I cannot match those requirements. Would you like to compare prices and offer terms without those attributes?');
  if (/knee pain|\bcure\b|medical|guarantee.*fix/.test(t)) return guide('I cannot guarantee a health outcome or recommend shoes to treat pain. This catalog has no clinical or fit information; I can only compare sample prices and offer conditions.');
  if (/canada|country|countries|international|valid in|ship to/.test(t)) return guide('The sample catalog has no country eligibility or international shipping data. Prices are in US dollars. I cannot confirm offers valid in your location.');
  if (/refund|cancel.*order|\breturn\b.*(?:shoes|purchase|cashback)|\breturning (?:the |my )?shoes/.test(t)) return guide('OfferScout does not handle refunds, returns, or order cancellations. I have not changed any order or payment. No real shoes or cashback are issued in this sandbox demo, and the sample terms do not define a real return or reward-reversal policy.');
  if (/password|reset.*paypal/.test(t)) return guide('I cannot reset PayPal credentials. Use PayPal’s official account recovery flow. For this demo, use a PayPal sandbox buyer account, and never send passwords in this chat.');
  if (/where.*order|when.*arrive|delivery|track.*order/.test(t)) return guide('This demo creates only a PayPal sandbox test payment. It does not place a real merchant order, ship shoes, or provide delivery tracking.');
  if (/two pairs|multi.item|\bcart\b/.test(t)) return guide('There is no multi-item cart in this prototype. Each sandbox checkout covers one sample purchase and one offer. I have not added anything or made a payment.');
  if (/real bank|real money|charge.*(?:bank|card)|sandbox/.test(t)) return guide('Our checkout uses PayPal sandbox accounts and test money. It does not charge your real bank account or place a real merchant order. Open an offer, review the payment, then explicitly approve it using a sandbox buyer account.');
  if (/without logging|guest checkout|without.*paypal account/.test(t)) return guide('The implemented flow redirects you to PayPal sandbox for approval using a sandbox buyer account. I cannot promise guest checkout or particular funding options; those depend on the PayPal approval screen.');
  if (/earned|earn real|earn money back|real cashback|(?:when|how).*(?:receive|get paid).*cashback|paid.*\$/.test(t)) return guide('A confirmed sandbox payment does not prove cashback earned. No real cashback is issued here. The confirmation shows estimated cashback separately, based on sample terms and your self-declared eligibility.');
  if (/pay.*(?:before|after).*cashback|cashback.*(?:deduct|payment)|before cashback or after/.test(t)) return guide('You pay the merchandise price plus listed shipping, minus any eligible instant discount. Estimated cashback is not deducted from the PayPal payment. For example, paying $108 with an estimated $10.80 cashback means $108 paid today and $97.20 estimated cost afterward, before tax. No real reward is issued.');
  if (/difference.*(?:discount|cashback)|(?:discount|cashback).*difference|discount.*(?:also|count).*cashback/.test(t)) return guide('An instant discount reduces the test payment today. Cashback is a separate estimate after payment and does not reduce the charge. For example, $5 off a $100 item means $95 paid; $5 cashback means $100 paid and $95 estimated cost afterward. Offers cannot be stacked in this prototype.');
  if (/activation|activate.*mean/.test(t)) return guide('Activation means opting in before purchase in these sample terms. Our demo assumes activation for estimates; it does not activate a real PayPal or affiliate offer. Read each offer’s terms before sandbox checkout.');
  if (/same order|stack|combine.*(?:coupon|offer|cashback)/.test(t)) return guide('Offers are not stacked in this prototype. Each sample checkout applies one eligible offer; a $5 coupon and $5 cashback cannot both be credited to the same purchase here.');
  if (/new.release|excluded.*offers|exclusion/.test(t)) { const example = offers.find(o => o.rewardExcluded)!; return { answer: `Yes. Some sample offers exclude new releases. For example, ${example.merchant} / ${example.product}: “${example.exclusionReason}”. That purchase receives $0 benefit and is excluded from recommendations. Open merchant details to inspect the exact terms; other offers may differ.`, offerIds: [] }; }
  if (/minimum|minimum.spend/.test(t) && /shipping|merchandise|item/.test(t)) {
    const item = t.match(new RegExp('item(?: is| costs)?\\s*\\$' + numeric));
    const minimum = t.match(new RegExp('\\$' + numeric + '\\s*minimum')) ?? t.match(new RegExp('minimum(?: of| is)?\\s*\\$' + numeric));
    if (item && minimum) return guide(`${dollars(item[1]) >= dollars(minimum[1]) ? 'Yes' : 'No'}: ${money(dollars(item[1]))} merchandise ${dollars(item[1]) >= dollars(minimum[1]) ? 'meets' : 'is below'} the ${money(dollars(minimum[1]))} minimum. Shipping and tax do not count. Instant-discount minimums use merchandise before the discount.`);
    return guide('Shipping and tax do not count toward minimum merchandise spend in these sample terms. Minimums use eligible merchandise price before the offer discount. Open the purchase terms to check its threshold.');
  }
  if (/tax/.test(t)) return guide('Shipping and tax are excluded from cashback: rewards use eligible merchandise only. Listed shipping is included in the payment today. Tax totals are unavailable in this sample catalog, so I cannot quote a tax-inclusive total.', 'tax-unknown');
  if (/saved|bookmark/.test(t)) return guide('Use the bookmark on a merchant card, then select Saved in the bottom navigation. Saved merchants are kept only for the current visit: refreshing the page clears them. No account is needed.');
  if (/store.*(?:payment|card|details)|privacy|payment details/.test(t)) return guide('Payment credentials are entered on PayPal’s sandbox approval page, not in this chat. The demo processes test order and capture IDs and uses a temporary signed checkout cookie. Live AI receives your question to extract shopping filters; do not enter sensitive personal or payment details.');
  if (/\bfee\b|\bfees\b|pay to use/.test(t)) return guide('OfferScout adds no platform fee in this demo. Sample payments include listed shipping and eligible instant discounts; tax is not available. This is not a quote for real merchant charges or PayPal fees.');
  if (/account.*browse|sign up|signup|register/.test(t)) return guide('No OfferScout account is needed to browse, compare, or save sample merchants during this visit. Sandbox checkout requires approval on PayPal using a sandbox buyer account.');
  if (/real offers|offers from paypal|live.*offers/.test(t)) return guide('These are clearly labelled fictional offers, not a live PayPal offers feed. We have 150 sample footwear merchants and 600 sample purchases. PayPal sandbox handles test payments only; no real rewards are issued.');
  if (/categories|kinds of shoes|what.*(?:sell|products)|what can you help|how.*use offerscout|^hi\b|^hello\b/.test(t)) return guide('I compare fictional Road running, Trail, and Walking shoe offers. Browse Savings or ask “running shoes under $120”, compare payment today versus estimated cashback, and open an offer to read caps, minimums, exclusions, and expiry. You can bookmark merchants under Saved or optionally approve a PayPal sandbox test payment. No real shoes or rewards are issued.');
  if (/husband|wife|if i were|can a new customer/.test(t)) return guide(`Some sample offers are restricted to new customers. A question, hypothetical, or another person’s status does not establish your eligibility. Your current status is ${customer === null ? 'unknown' : customer ? 'self-declared new' : 'returning'}. Choose your own status in Demo settings & eligibility, then select a merchant or product to compare. No new-customer reward is assumed while eligibility is unknown.`);
  if (/i am a new customer/.test(t) && /i am a returning customer/.test(t)) return guide('Those declarations conflict, so your eligibility is now unknown. Please choose your own status in Demo settings & eligibility. No new-customer reward is assumed until you clarify.');
  if (/new[ -]customer (?:only )?(?:offers|deals)/.test(t) && customer !== true) return guide(`New-customer-only offers are ineligible for your current ${customer === false ? 'returning' : 'unknown'} status and receive $0 estimated rewards. I have not changed your eligibility. Declare your own status in settings or ask for offers available to returning customers.`);
  if (/how much.*(?:cashback|cash back|reward).*(?:that|those|this)/.test(t)) {
    if (!context) return guide('Which sample purchase do you mean? Tell me the merchant and product, or open an offer first. I cannot estimate cashback from a price alone.');
    const matches = matchingOffers(context.intent, customer);
    const chosen = context.offerIds.map(id => matches.find(o => o.id === id)).filter(o => o !== undefined);
    const exact = context.intent.merchant && context.intent.searchText ? matches[0] : chosen.length === 1 ? chosen[0] : undefined;
    if (!exact) return guide('Which of the previous sample purchases do you mean? Tell me the merchant and product so I can use its exact terms.');
    const value = evaluate(exact, customer, DEMO_DATE);
    return { answer: `${exact.merchant} / ${exact.product}: pay ${money(value.payable)} before tax; estimated cashback ${money(value.reward)}, estimated cost afterward ${money(value.effective)}. ${value.reason}. ${offerKind(exact).startsWith('discount') ? 'This is an instant discount, not a cashback offer. ' : ''}Estimate as of ${DEMO_DATE}; no cashback earned.`, offerIds: [exact.id] };
  }
  if (isFollowUp(prompt) && !context) return guide('Which offers do you mean? Tell me the merchant, product, or category first so I can preserve the right constraints.');
  return calculateExample(prompt);
}

export function calculateExample(prompt: string): GuideAnswer | null {
  const rateMatch = prompt.match(new RegExp(numeric + '\\s*%'));
  const capMatch = prompt.match(new RegExp('cap(?:ped)?(?: at| of)?\\s*\\$' + numeric, 'i')) ?? prompt.match(new RegExp('\\$' + numeric + '\\s*cap', 'i'));
  if (!rateMatch || !capMatch) return null;
  const fixed = prompt.match(new RegExp('\\$' + numeric + '\\s*(?:cash\\s*)?back', 'i'));
  const purchase = prompt.match(new RegExp('(?:on|spend|purchase(?: is| of)?|item(?: is| costs)?)\\s*(?:a\\s*)?\\$' + numeric, 'i')) ?? prompt.match(new RegExp('\\$' + numeric + '\\s*(?:purchase|item|order)', 'i'));
  // Do not invent a purchase amount or swap in the canned catalog example.
  if (!purchase) return null;
  const cents = dollars(purchase[1]), cap = dollars(capMatch[1]), rate = dollars(rateMatch[1]);
  if (cents > 10000000 || cap > 10000000 || rate > 10000) return guide('Please use a purchase amount up to $100,000 and a percentage from 0 to 100 for this example.');
  const reward = Math.min(Math.floor((cents * rate + 5000) / 10000), cap, cents);
  if (fixed) { const benefit = Math.min(dollars(fixed[1]), cents); return guide(`On a ${money(cents)} eligible merchandise purchase, the fixed cashback is ${money(benefit)}. ${rateMatch[1]}% capped at ${money(cap)} gives ${money(reward)}. ${benefit > reward ? 'The fixed cashback wins' : benefit < reward ? 'The percentage cashback wins' : 'They tie'} for this example. These are hypothetical estimates, not catalog offers or rewards earned; shipping and tax are excluded.`); }
  return guide(`On ${money(cents)} of eligible merchandise, ${rateMatch[1]}% capped at ${money(cap)} gives ${money(reward)} estimated cashback and ${money(cents - reward)} estimated cost afterward, excluding shipping and tax. This is a hypothetical calculation, not rewards earned.`);
}
