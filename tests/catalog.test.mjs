import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { offers, demoOffers, evaluate, offerKind, OFFER_KINDS } from '../lib/offers.ts';
import { merchantNames } from '../lib/merchants.ts';
import { demoIntent, intentSchema, normalizeIntent } from '../lib/intent.ts';
import { matchingOffers, explainRecommendation } from '../lib/recommend.ts';
import { orderBody, assertOrder, receipt } from '../lib/server/paypal.ts';
const labels = JSON.parse(readFileSync(new URL('../public/data/offerscout-mixed-offer-cases.json', import.meta.url), 'utf8'));
const cents = z.number().int().nonnegative();
const schema = z.object({
  id: z.string().min(1).max(40), merchant: z.enum(merchantNames), product: z.string().min(1), category: z.enum(['Road', 'Trail', 'Walking']),
  price: cents.positive(), shipping: cents, rate: z.number().min(0).max(100), cap: cents.nullable(), minimum: cents,
  newCustomerOnly: z.boolean(), expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), color: z.string().regex(/^#[a-f0-9]{6}$/), terms: z.string().min(20),
  kind: z.enum(OFFER_KINDS).optional(), amountOff: cents.optional(), rewardExcluded: z.boolean().optional(), exclusionReason: z.string().optional(), couponCode: z.string().optional(),
}).strict();
test('catalog has exactly 150 unique merchants and 600 schema-valid, unique offers', () => {
  assert.equal(merchantNames.length, 150); assert.equal(new Set(merchantNames).size, 150);
  assert.equal(offers.length, 600); assert.equal(new Set(offers.map(o => o.id)).size, 600);
  for (const offer of offers) schema.parse(offer);
  for (const name of merchantNames) assert.equal(offers.filter(o => o.merchant === name).length, 4);
});
test('all four offer types and eligibility boundary families are represented', () => {
  for (const kind of OFFER_KINDS) assert.ok(offers.filter(o => offerKind(o) === kind).length >= 100, kind);
  for (const predicate of [o=>o.minimum>0, o=>o.cap!==null, o=>o.newCustomerOnly, o=>o.expires<'2026-10-17', o=>o.rewardExcluded, o=>o.shipping>0]) assert.ok(offers.some(predicate));
  assert.ok(offers.some(o=>offerKind(o)==='cashback-fixed' && o.amountOff===500));
  assert.ok(offers.some(o=>offerKind(o)==='discount-fixed' && o.amountOff===500));
  // The sandbox adapter conservatively evaluates discounts without a customer declaration.
  assert.ok(offers.filter(o=>offerKind(o).startsWith('discount')).every(o=>!o.newCustomerOnly));
});
test('original sandbox offer identities and charged amounts remain unchanged', () => {
  assert.equal(demoOffers.length, 12);
  for (let m=0;m<3;m++) for(let p=0;p<4;p++) {
    const offer=offers.find(o=>o.id===`offer-${m}-${p}`); assert.ok(offer);
    assert.equal(evaluate(offer,null).payable,[11000,10800,10600][m]+p*800);
  }
});
for (const row of labels.calculationCases) test(`mixed-offer reference: ${row.id}`, () => {
  const result=evaluate(row.offer,row.newCustomer,row.asOf);
  for (const [key,value] of Object.entries(row.expected)) assert.equal(result[key],value,`${row.id}: ${key}`);
});
for (const row of labels.assistantCases) test(`mixed-offer intent: ${row.prompt}`, () => {
  const intent=demoIntent(row.prompt);
  for (const [key,value] of Object.entries(row)) if(key!=='prompt') assert.equal(intent[key],value,key);
});
test('generated catalog obeys financial conservation for all customer states', () => {
  for(const offer of offers) for(const customer of [null,false,true]) {
    const result=evaluate(offer,customer);
    for(const key of ['subtotal','discount','payable','reward','effective']) assert.ok(Number.isInteger(result[key])&&result[key]>=0,`${offer.id}:${key}`);
    assert.equal(result.payable+result.discount,offer.price+offer.shipping);
    assert.equal(result.effective+result.reward,result.payable);
    assert.ok(result.reward<=offer.price && result.discount<=offer.price);
    assert.ok(!(result.reward && result.discount),'single offer must not stack reward and discount');
    if(!result.eligible){assert.equal(result.reward,0);assert.equal(result.discount,0);}
  }
});
test('fixed-dollar filter and payment budget are independent', () => {
  const intent=demoIntent('Show shoes with $10 off under $120');
  const results=matchingOffers(intent,null);assert.ok(results.length>0);
  for(const offer of results){assert.equal(offerKind(offer),'discount-fixed');assert.equal(offer.amountOff,1000);assert.ok(evaluate(offer,null).payable<=12000);}
});
test('highest cashback sort never compares percentage discounts or dollar amounts as rates', () => {
  const results=matchingOffers(demoIntent('Highest cashback percentage'),null);assert.ok(results.length>0);
  assert.ok(results.every(o=>offerKind(o)==='cashback-percent'));
  assert.ok(results.every((o,i)=>i===0||results[i-1].rate>=o.rate));
});
test('assistant response remains bounded and preserves catalog order at scale', () => {
  const intent=demoIntent('running shoes under $120');const result=explainRecommendation(intent,null);
  assert.equal(result.offerIds.length,12);assert.deepEqual(result.offerIds,matchingOffers(intent,null).slice(0,12).map(o=>o.id));
  const directory=explainRecommendation(demoIntent('Show merchant offers'),null);assert.ok(directory.answer.length<4000);assert.ok(directory.offerIds.length<=12);
});
test('unknown merchant cannot pass the model output schema', () => {
  assert.equal(intentSchema.safeParse({...demoIntent('shoes'),merchant:'Nike'}).success,false);
});
test('up to a cashback percentage is not a payment budget in demo parsing',()=>{
  const intent=demoIntent('Show cashback offers up to 20%');assert.equal(intent.maximumPayableCents,null);
});
test('PayPal catalog amounts agree with discounts and cashback for all 600 offers',()=>{
  for(const offer of offers){
    const unit=orderBody(offer.id,'https://demo.example').purchase_units[0];
    const result=evaluate(offer,null);assert.equal(unit.amount.value,(result.payable/100).toFixed(2));
    assert.equal(unit.items[0].unit_amount.value,unit.amount.breakdown.item_total.value);
    assert.equal(Math.round(Number(unit.amount.breakdown.item_total.value)*100)+offer.shipping,result.payable);
  }
});
test('discounted receipt rejects gross or fabricated amounts and accepts confirmed net amount',()=>{
  const offer=offers.find(o=>offerKind(o)==='discount-fixed' && evaluate(o,null).discount>0);assert.ok(offer);
  const value=evaluate(offer,null);const amount={currency_code:'USD',value:(value.payable/100).toFixed(2)};
  const order={id:'DISCOUNTORDER',status:'COMPLETED',purchase_units:[{custom_id:offer.id,amount,payments:{captures:[{id:'DISCOUNTCAP',status:'COMPLETED',amount}]}}]};
  assert.equal(receipt(order,offer.id).paidCents,value.payable);
  assert.throws(()=>assertOrder({...order,purchase_units:[{...order.purchase_units[0],amount:{...amount,value:((offer.price+offer.shipping)/100).toFixed(2)}}]},offer.id),/does not match/);
});

test('general cashback and discount requests stay in their respective families',()=>{
  for(const [prompt,family] of [['Show cashback offers','cashback'],['Show coupon offers','discount']]) {
    const intent=demoIntent(prompt);assert.equal(intent.offerType,family);
    const results=matchingOffers(intent,null);assert.ok(results.length>0);assert.ok(results.every(o=>offerKind(o).startsWith(family)));
  }
});

test('canonicalization preserves constraints while resolving equivalent model filter forms',()=>{
  const dollar={...demoIntent('shoes under $120'),offerType:'cashback',benefitAmountCents:500};
  const fixed=normalizeIntent(dollar);assert.equal(fixed.offerType,'cashback-fixed');assert.equal(fixed.maximumPayableCents,12000);assert.equal(fixed.benefitAmountCents,500);
  const percentage=normalizeIntent({...demoIntent('trail shoes'),sort:'headline-rate',offerType:null});assert.equal(percentage.offerType,'cashback-percent');assert.equal(percentage.category,'Trail');
  assert.deepEqual(normalizeIntent(fixed),fixed);
  const untouched=demoIntent('Show shoes with $10 off under $120');assert.deepEqual(normalizeIntent(untouched),untouched);
});
