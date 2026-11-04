import { z } from 'zod';
import { merchantNames } from './merchants.ts';
import { OFFER_FILTERS, OFFER_KINDS, productNames } from './offers.ts';

export const filterFields = ['merchants', 'merchantPrefix', 'category', 'product', 'maximumPayment', 'minimumPayment', 'maximumEffective', 'offerType', 'benefit', 'rate', 'rateComparison', 'freeShipping', 'newCustomerOffersOnly', 'sort', 'view'] as const;
export const helpTopics = ['welcome', 'categories', 'offer-types', 'catalog-source', 'identity', 'fees', 'accounts', 'saved', 'privacy', 'memory', 'checkout', 'autonomous-payment', 'payment-status', 'guest-checkout', 'earned-rewards', 'fulfillment', 'returns', 'password', 'stacking', 'activation', 'minimum', 'expiry', 'exclusions', 'tax', 'shipping', 'eligibility', 'model', 'email', 'deletion', 'alternative-payment', 'catalog-limits', 'health', 'cap-comparison', 'qualifying-purchase', 'security', 'other'] as const;
export const limitationCodes = ['currency', 'precision', 'unknown-merchant', 'product', 'attributes', 'location', 'delivery', 'medical', 'merchant-status', 'multi-item', 'reference', 'action', 'secrets', 'fabrication', 'stacking', 'other'] as const;
const rawAmount = z.string().min(1).max(100).nullable();
export const rawFiltersSchema = z.object({
  merchants: z.array(z.enum(merchantNames)).min(1).max(5).nullable(),
  merchantPrefix: z.string().min(1).max(40).nullable(),
  category: z.enum(['Road', 'Trail', 'Walking']).nullable(),
  product: z.enum(productNames).nullable(),
  maximumPayment: rawAmount, minimumPayment: rawAmount, maximumEffective: rawAmount,
  offerType: z.enum(OFFER_FILTERS).nullable(), benefit: rawAmount, rate: rawAmount,
  rateComparison: z.enum(['exact', 'at-least', 'at-most']).nullable(),
  freeShipping: z.boolean().nullable(), newCustomerOffersOnly: z.boolean().nullable(),
  sort: z.enum(['effective-cost', 'headline-rate', 'payable']).nullable(),
  view: z.enum(['merchants', 'purchases']).nullable(),
}).strict();
const benefitSchema = z.object({ kind: z.enum(OFFER_KINDS), amount: rawAmount, rate: rawAmount, cap: rawAmount }).strict();
export const calculationSchema = z.object({
  kind: z.enum(['cashback', 'discount', 'compare', 'minimum']),
  merchandise: rawAmount, shipping: rawAmount, minimum: rawAmount,
  first: benefitSchema.nullable(), second: benefitSchema.nullable(),
}).strict();
export const requestPlanSchema = z.object({
  action: z.enum(['search', 'inspect', 'help', 'calculate', 'clarify', 'refuse']),
  scope: z.enum(['new', 'refine']),
  updates: z.array(z.object({ field: z.enum(filterFields), operation: z.enum(['set', 'clear']), evidence: z.string().min(1).max(1000) }).strict()).max(filterFields.length),
  filters: rawFiltersSchema,
  topic: z.enum(helpTopics), limitations: z.array(z.enum(limitationCodes)).max(5),
  customerStatement: z.enum(['new', 'returning', 'conflicting', 'none']),
  customerEvidence: z.string().max(1000).nullable(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'other', 'unspecified']),
  calculation: calculationSchema.nullable(),
}).strict();
export type RequestPlan = z.infer<typeof requestPlanSchema>;
export type RawFilters = z.infer<typeof rawFiltersSchema>;
export type Calculation = z.infer<typeof calculationSchema>;
export type HelpTopic = typeof helpTopics[number];
export class RequestClarification extends Error {}
const normalized = (value: string): string => value.normalize('NFKC').replace(/[‘’]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
export function requireEvidence(evidence: string, prompt: string): void {
  if (!normalized(evidence) || !normalized(prompt).includes(normalized(evidence))) throw new RequestClarification('I could not verify part of that request. Please restate the amount or condition you want to change.');
}
const small: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordsToInteger(text: string): number | null {
  let total = 0, group = 0;
  for (const word of text.replace(/-/g, ' ').split(/\s+/)) {
    if (word === 'and') continue;
    if (word in small) group += small[word];
    else if (word === 'hundred') group = (group || 1) * 100;
    else if (word === 'thousand') { total += (group || 1) * 1000; group = 0; }
    else return null;
  }
  return total + group;
}
function cleanAmountSpan(text: string): string {
  return normalized(text)
    .replace(/^(?:(?:under|below|over|above|between|up to|at most|at least|no more than|less than|more than)\s+)/, '')
    .replace(/[.,;:!?]+$/, '')
    .replace(/\s+(?:today|now|upfront|in total|before tax|including (?:shipping|delivery)|(?:shipping|delivery) included)$/, '')
    .replace(/\s+(?:off|(?:cash\s*)?back)(?:\s+(?:at checkout|now|today))?$/, '')
    .trim();
}
/** Normalize an extracted literal. This function never guesses a currency or rounds a ceiling up. */
export function parseMoney(text: string, prompt: string): number {
  requireEvidence(text, prompt);
  const source = normalized(prompt), literal = cleanAmountSpan(text);
  if (!literal) throw new RequestClarification('Please state a complete monetary amount, such as $75.25.');
  const positions: number[] = [];
  for (let index = source.indexOf(literal); index >= 0; index = source.indexOf(literal, index + Math.max(1, literal.length))) positions.push(index);
  const complete = positions.filter(index => !/^\d|^\.\d|^[kmb]\b|^e[+-]?\d/i.test(source.slice(index + literal.length)) && !/[\d.]/.test(source.slice(Math.max(0, index - 1), index)) && !/[-−]\s*\$?\s*$/.test(source.slice(0, index)));
  if (!complete.length) throw new RequestClarification('Please state the complete monetary amount, including decimal digits or a k suffix. I have not truncated or changed the budget.');
  const usd = complete.some(index => !/[€£₹]/.test(source.slice(Math.max(0, index - 1), index)) && !/^\s*(?:euros?|pounds?|eur|gbp)\b/i.test(source.slice(index + literal.length)));
  if (!usd) throw new RequestClarification('This sample catalog uses US dollars only. Please provide a USD amount; no currency conversion was applied.');
  if (/[€£₹]|\b(?:euros?|pounds?|rupees?|eur|gbp)\b/i.test(text)) throw new RequestClarification('This sample catalog uses US dollars only. Please give a USD budget; I cannot convert or treat another currency as dollars.');
  let value = literal.replace(/\busd\b|\bus dollars?\b|\bdollars?\b|\bbucks?\b|\$/g, '').trim();
  let multiplier = 1;
  if (/k$/.test(value)) { multiplier = 1000; value = value.slice(0, -1).trim(); }
  let cents: number;
  if (/^\d/.test(value)) {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) throw new RequestClarification('Please give monetary amounts to at most two decimal places. I will not round your spending ceiling up.');
    const [whole, fraction = ''] = value.replace(/,/g, '').split('.');
    cents = (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * multiplier;
  } else {
    const whole = wordsToInteger(value);
    if (whole === null) throw new RequestClarification('Please restate that amount in US dollars, for example $75.25.');
    cents = whole * 100 * multiplier;
  }
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10000000) throw new RequestClarification('Please use a nonnegative sample amount no greater than $100,000.');
  return cents;
}
export function parseRate(text: string, prompt: string): number {
  requireEvidence(text, prompt);
  const source = normalized(prompt), literal = normalized(text);
  let complete = false;
  for (let index = source.indexOf(literal); index >= 0; index = source.indexOf(literal, index + Math.max(1, literal.length))) {
    if (!/[\d.]/.test(source.slice(Math.max(0, index - 1), index)) && !/[-−]\s*$/.test(source.slice(0, index))) complete = true;
  }
  if (!complete) throw new RequestClarification('Please state the complete nonnegative percentage. I have not truncated its digits.');
  const raw = literal.replace(/\bpercent\b|%/g, '').trim();
  if (!/(?:%|percent)/i.test(text) || !/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new RequestClarification('Please state the percentage explicitly, such as 7.5%.');
  const [whole, fraction = ''] = raw.split('.');
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (basisPoints > 10000) throw new RequestClarification('Please use a percentage from 0% to 100%.');
  return basisPoints;
}
export function validateBudgetEvidence(text: string, prompt: string): void {
  requireEvidence(text, prompt);
  const input = normalized(prompt), literal = cleanAmountSpan(text);
  if (!literal) throw new RequestClarification('Please state a complete purchase budget.');
  for (let index = input.indexOf(literal); index >= 0; index = input.indexOf(literal, index + Math.max(1, literal.length))) {
    const before = input.slice(Math.max(0, index - 1), index), after = input.slice(index + literal.length);
    if (/\d/.test(before) || /^\d|^\.\d|^k\b/.test(after)) continue;
    if (!/^\s*(?:cash\s*back|back\b|off\b|%)/i.test(after)) return;
  }
  throw new RequestClarification('Is that amount the reward you want or your purchase budget? I have kept the previous budget.');
}

// One declared schema for model output; all object properties are required by strict structured output.
type JsonSchema = Record<string, unknown>;
const enumeration = (values: readonly string[], nullable = false): JsonSchema => ({ type: nullable ? ['string', 'null'] : 'string', enum: nullable ? [...values, null] : values });
const stringValue: JsonSchema = { type: ['string', 'null'], maxLength: 100, description: 'Exact verbatim monetary or percentage substring from CURRENT message. Preserve words/symbols/decimals. Never convert five dollars to $5. Null if unchanged or unmentioned.' };
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const benefitJson = object({ kind: enumeration(OFFER_KINDS), amount: stringValue, rate: stringValue, cap: stringValue });
export const requestPlanJsonSchema = object({
  action: enumeration(['search', 'inspect', 'help', 'calculate', 'clarify', 'refuse']), scope: enumeration(['new', 'refine']),
  updates: { type: 'array', maxItems: filterFields.length, items: object({ field: enumeration(filterFields), operation: enumeration(['set', 'clear']), evidence: { type: 'string', maxLength: 1000 } }) },
  filters: object({
    merchants: { anyOf: [{ type: 'array', items: enumeration(merchantNames), minItems: 1, maxItems: 5 }, { type: 'null' }], description: 'Only exact merchant names stated in CURRENT message. Null for their/there/same merchant: scope=refine retains previous merchant. Unknown real brands require unknown-merchant limitation, never substitute.' },
    merchantPrefix: { type: ['string', 'null'], maxLength: 40 }, category: { ...enumeration(['Road', 'Trail', 'Walking'], true), description: 'Semantic category: running=Road, hiking=Trail, everyday walks=Walking. Do not infer from a merchant name.' }, product: { ...enumeration(productNames, true), description: 'Only if the FULL canonical product name appears verbatim in CURRENT message. Everyday walks is category Walking, not this product. Null for pronouns or same product: context retains it.' },
    maximumPayment: stringValue, minimumPayment: stringValue, maximumEffective: stringValue,
    offerType: enumeration(OFFER_FILTERS, true), benefit: stringValue, rate: stringValue,
    rateComparison: enumeration(['exact', 'at-least', 'at-most'], true),
    freeShipping: { type: ['boolean', 'null'] }, newCustomerOffersOnly: { type: ['boolean', 'null'] },
    sort: enumeration(['effective-cost', 'headline-rate', 'payable'], true), view: enumeration(['merchants', 'purchases'], true),
  }),
  topic: enumeration(helpTopics), limitations: { type: 'array', items: enumeration(limitationCodes), maxItems: 5 },
  customerStatement: enumeration(['new', 'returning', 'conflicting', 'none']), customerEvidence: { type: ['string', 'null'], maxLength: 1000 },
  currency: enumeration(['USD', 'EUR', 'GBP', 'other', 'unspecified']),
  calculation: { anyOf: [object({ kind: enumeration(['cashback', 'discount', 'compare', 'minimum']), merchandise: stringValue, shipping: stringValue, minimum: stringValue, first: { anyOf: [benefitJson, { type: 'null' }] }, second: { anyOf: [benefitJson, { type: 'null' }] } }), { type: 'null' }] },
});

// A non-null value is SET. Null is KEEP unless the field is explicitly cleared.
// This removes the redundant SET list that a model could forget to populate.
export const wirePlanSchema = requestPlanSchema.omit({ updates: true }).extend({ clearFields: z.array(z.enum(filterFields)).max(filterFields.length) }).strict();
export function decodeRequestPlan(input: unknown, prompt: string): RequestPlan {
  const wire = wirePlanSchema.parse(input);
  const clearFields = new Set(wire.clearFields);
  const updates = filterFields.flatMap<RequestPlan['updates'][number]>(field => {
    const value = wire.filters[field];
    if (clearFields.has(field) && value !== null) throw new RequestClarification('A filter was both replaced and removed. Please state the final condition.');
    return value !== null ? [{ field, operation: 'set' as const, evidence: prompt }] : clearFields.has(field) ? [{ field, operation: 'clear' as const, evidence: prompt }] : [];
  });
  const rest = Object.fromEntries(Object.entries(wire).filter(([key]) => key !== 'clearFields'));
  return requestPlanSchema.parse({ ...rest, updates });
}
const requestProperties = requestPlanJsonSchema.properties as Record<string, JsonSchema>;
export const wirePlanJsonSchema = object({
  ...Object.fromEntries(Object.entries(requestProperties).filter(([key]) => key !== 'updates')),
  clearFields: { type: 'array', items: enumeration(filterFields), maxItems: filterFields.length, description: 'Only fields explicitly REMOVED without replacement; corresponding filter must be null. Replacing cashback with discount sets offerType=discount and does not clear offerType.' },
});
