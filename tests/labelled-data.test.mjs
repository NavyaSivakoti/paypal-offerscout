import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate } from '../lib/offers.ts';
const data = JSON.parse(readFileSync(new URL('../public/data/offerscout-labelled-examples.json', import.meta.url), 'utf8'));
const byId = new Map(data.offers.map(offer => [offer.id, offer]));
test('fixture IDs are unique and all amounts are valid cents', () => {
 assert.equal(byId.size, data.offers.length);
 for (const o of data.offers) for (const key of ['price', 'shipping', 'minimum']) assert.ok(Number.isInteger(o[key]) && o[key] >= 0);
});
for (const row of data.calculationCases) test(`labelled calculation: ${row.id}`, () => {
 const offer = byId.get(row.offerId); assert.ok(offer);
 const actual = evaluate(offer, row.newCustomer, row.asOf);
 for (const [key, value] of Object.entries(row.expected)) assert.equal(actual[key], value, `${row.id}: ${key}`);
});
for (const row of data.rankingCases) test(`labelled ranking: ${row.id}`, () => {
 const candidates = row.offerIds.map(id => { const offer = byId.get(id); assert.ok(offer); return offer; });
 assert.deepEqual([...candidates].sort((a,b)=>b.rate-a.rate).map(o=>o.id), row.expectedHeadlineOrder);
 assert.deepEqual([...candidates].sort((a,b)=>evaluate(a,row.newCustomer,row.asOf).effective-evaluate(b,row.newCustomer,row.asOf).effective).map(o=>o.id), row.expectedEffectiveOrder);
});
