import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPlanSchema, rawFiltersSchema, wirePlanJsonSchema } from '../lib/request-plan.ts';
import { executeRequestPlan } from '../lib/assistant-execution.ts';
import { emptyIntent } from '../lib/search-state.ts';

const filters = Object.fromEntries(Object.keys(rawFiltersSchema.shape).map(key => [key, null]));
const request = action => requestPlanSchema.parse({ action, scope: 'new', updates: [], filters, topic: 'expiry', limitations: ['purchase-date'], customerStatement: 'none', customerEvidence: null, currency: 'unspecified', calculation: null });
for (const action of ['search', 'help', 'inspect', 'accept-comparison']) {
  test(`purchase-date limitation blocks ${action} from presenting frozen offers as future-valid`, () => {
    const context = { intent: emptyIntent(null), offerIds: [], pendingComparison: { intent: emptyIntent(null), limitation: 'attributes' } };
    const result = executeRequestPlan(request(action), 'Seasonal purchase example', null, context, 'test-model', 'test-version');
    assert.deepEqual(result.offerIds, []);
    assert.match(result.answer, /cannot confirm|cannot verify/i);
    assert.doesNotMatch(result.answer, /ranks first|Meets the sample offer conditions/);
  });
}
test('wire schema exposes purchase-date as a bounded semantic limitation', () => {
  assert.ok(wirePlanJsonSchema.properties.limitations.items.enum.includes('purchase-date'));
});

import { contextForAnswer, chatContextSchema } from '../lib/conversation.ts';
import { offers, evaluate } from '../lib/offers.ts';
function timingPlan(action, updates = {}, scope = 'new', limitations = ['purchase-date']) {
  const prompt = 'Walking examples under $85';
  return requestPlanSchema.parse({ ...request(action), scope, limitations, filters: { ...filters, ...updates }, updates: Object.keys(updates).map(field => ({field, operation:'set', evidence:prompt})) });
}
const run = (plan, prompt, context) => executeRequestPlan(plan, prompt, null, context, 'test-model', 'test-version');
const initial = () => run(timingPlan('help', {category:'Walking'}), 'Walking examples under $85');
test('dated discovery asks for budget and retains a bounded sample proposal', () => {
  const result = initial();
  assert.match(result.answer, /what is your budget/i);
  assert.match(result.answer, /not discounts verified as available now/);
  assert.deepEqual(result.offerIds, []);
  const context = chatContextSchema.parse(contextForAnswer(result));
  assert.equal(context.pendingComparison.limitation, 'purchase-date');
  assert.equal(context.pendingComparison.intent.category, 'Walking');
});
test('a budget reply displays reference-date sample options within the original category', () => {
  const context = contextForAnswer(initial());
  const result = run(timingPlan('search', {maximumPayment:'$85'}, 'refine', []), 'Walking examples under $85', context);
  assert.ok(result.offerIds.length);
  assert.match(result.answer, /not confirmed current discounts or Black Friday deals/);
  assert.equal(result.intent.category, 'Walking');
  assert.equal(result.intent.maximumPayableCents, 8500);
  for (const id of result.offerIds) {
    const offer = offers.find(item => item.id === id);
    assert.equal(offer.category, 'Walking');
    assert.ok(evaluate(offer, null).payable <= 8500);
  }
  assert.equal(contextForAnswer(result, context).pendingComparison, undefined);
});
test('a supplied budget is kept while asking permission to compare sample offers', () => {
  const first = run(timingPlan('help', {category:'Walking',maximumPayment:'$85'}), 'Walking examples under $85');
  assert.match(first.answer, /within your budget/);
  const accepted = run(timingPlan('accept-comparison', {}, 'refine', []), 'Show sample options', contextForAnswer(first));
  assert.equal(accepted.intent.maximumPayableCents, 8500);
  assert.ok(accepted.offerIds.length);
  assert.match(accepted.answer, /2026-10-17/);
  assert.doesNotMatch(accepted.answer, /medical suitability/);
});
test('renewed timing requirement does not silently accept a sample comparison', () => {
  const context = contextForAnswer(initial());
  const result = run(timingPlan('help', {}, 'refine'), 'Future sale examples', context);
  assert.deepEqual(result.offerIds, []);
  assert.ok(contextForAnswer(result, context).pendingComparison);
});
test('compound unsupported requirements are not discarded to create a date-only comparison', () => {
  const result = run(timingPlan('help', {}, 'new', ['purchase-date','unknown-merchant']), 'Unknown retailer seasonal examples');
  assert.deepEqual(result.offerIds, []);
  assert.equal(result.conversationContext, null);
  assert.match(result.answer, /cannot confirm offers/);
});
test('declining clears the proposed dated comparison without recommending anything', () => {
  const context = contextForAnswer(initial());
  const result = run(timingPlan('decline-comparison', {}, 'refine', []), 'No thanks', context);
  assert.deepEqual(result.offerIds, []);
  assert.equal(contextForAnswer(result, context).pendingComparison, undefined);
});
test('sample comparison acceptance cannot increase a budget to force matches', () => {
  const context = contextForAnswer(initial());
  const plan = timingPlan('accept-comparison', {}, 'refine', []);
  plan.filters.maximumPayment = '$1';
  plan.updates = [{field:'maximumPayment',operation:'set',evidence:'under $1'}];
  const result = run(plan, 'under $1', context);
  assert.deepEqual(result.offerIds, []);
  assert.equal(result.intent.maximumPayableCents, 100);
});
