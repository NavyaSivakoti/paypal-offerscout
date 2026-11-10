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
