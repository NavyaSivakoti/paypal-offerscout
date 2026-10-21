import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoIntent, intentSchema, intentJsonSchema } from '../lib/intent.ts';
import { answerGuide, calculateExample, chatContextSchema, resolveSearch } from '../lib/chat.ts';
import { matchingOffers, explainRecommendation } from '../lib/recommend.ts';
import { evaluate, offers, offerKind } from '../lib/offers.ts';
const search = (prompt, context) => resolveSearch(prompt, demoIntent(prompt), context);
const contextFor = prompt => { const intent=search(prompt); return {intent,offerIds:matchingOffers(intent,null).slice(0,12).map(o=>o.id)}; };
test('follow-up budget replacement preserves road and merchant constraints',()=>{
 const previous=contextFor('Cloudstep Road Runner at Trail & Field under $120');
 const next=search('Actually make that $109.50.',previous);
 assert.equal(next.maximumPayableCents,10950);assert.equal(next.category,'Road');assert.equal(next.merchant,'Trail & Field');assert.equal(next.searchText,'Cloudstep Road Runner');
 assert.deepEqual(matchingOffers(next,null).map(o=>o.id),['offer-1-0']);
});
test('cheapest and cheaper follow-ups preserve prior merchant and category',()=>{
 for(const [first,followup,field,expected] of [['Trail & Field offers','Which of those is cheapest?','merchant','Trail & Field'],['trail shoes','Any cheaper ones?','category','Trail']]) {
  const next=search(followup,contextFor(first));assert.equal(next[field],expected);assert.equal(next.intent,'search');assert.equal(next.view,'purchases');assert.ok(matchingOffers(next,false).length);
 }
});
test('fresh independent search does not inherit prior category or merchant',()=>{
 const next=search('Walking shoes below $85',contextFor('Cloudstep Road Runner at Trail & Field'));
 assert.equal(next.category,'Walking');assert.equal(next.merchant,null);assert.equal(next.searchText,null);assert.equal(next.maximumPayableCents,8500);
});
test('offer correction changes cashback to instant discount without changing budget',()=>{
 const next=search('I meant $5 off now.',contextFor('Get $5 back on running shoes under $120'));
 assert.equal(next.offerType,'discount-fixed');assert.equal(next.benefitAmountCents,500);assert.equal(next.category,'Road');assert.equal(next.maximumPayableCents,12000);
});
test('a follow-up without context asks for clarification',()=>assert.match(answerGuide('How much cashback on that?',null).answer,/Which sample purchase/));
test('a specific previous purchase yields its own $10.80 cashback estimate',()=>{
 const result=answerGuide('How much cashback would I get on that?',null,contextFor('Cloudstep Road Runner at Trail & Field'));
 assert.deepEqual(result.offerIds,['offer-1-0']);assert.match(result.answer,/\$10.80/);assert.match(result.answer,/no cashback earned/);
});
test('an ambiguous previous list cannot silently choose one cashback amount',()=>assert.match(answerGuide('How much cashback would I get on that?',null,contextFor('running shoes under $120')).answer,/Which of the previous/));
test('untrusted context IDs cannot inject a purchase or money amount',()=>{
 assert.equal(chatContextSchema.safeParse({...contextFor('shoes'),paidCents:1}).success,false);
 const result=answerGuide('How much cashback on that?',null,{...contextFor('running shoes'),offerIds:['unknown']});assert.deepEqual(result.offerIds,[]);
});
test('20 percent discount never becomes a $20 fixed benefit',()=>{
 const intent=search('Do you have any 20% off shoes?');assert.equal(intent.ratePercent,20);assert.equal(intent.benefitAmountCents,null);assert.equal(intent.offerType,'discount-percent');
 const results=matchingOffers(intent,null);assert.ok(results.length);assert.ok(results.every(o=>o.rate===20&&offerKind(o)==='discount-percent'));
});
test('after-cashback budget is checked against effective cost rather than payment',()=>{
 const intent=search('Find running shoes under $100 after cashback');assert.equal(intent.budgetBasis,'effective');assert.equal(intent.sort,'effective-cost');
 const matches=matchingOffers(intent,null);assert.ok(matches.length);assert.ok(matches.every(o=>evaluate(o,null).effective<=10000));assert.ok(matches.some(o=>evaluate(o,null).payable>10000));
 assert.match(explainRecommendation(intent,null).answer,/payment today can be higher/);
});
test('pay-today budget includes shipping and is not changed by cashback wording',()=>{
 const intent=search('I can pay $100 today, even if cashback arrives later.');assert.equal(answerGuide('I can pay $100 today, even if cashback arrives later.',null),null);assert.equal(intent.maximumPayableCents,10000);assert.equal(intent.budgetBasis,'payable');
 assert.ok(matchingOffers(intent,null).every(o=>evaluate(o,null).payable<=10000));
});
test('every recommended offer meets conditions for all customer states and all sorts',()=>{
 for(const customer of [null,true,false]) for(const sort of ['effective-cost','headline-rate','payable']) {
  const matches=matchingOffers({...search('shoes'),sort},customer);assert.ok(matches.length);
  for(const offer of matches) assert.equal(evaluate(offer,customer).eligible,true,offer.id);
 }
});
test('excluded, expired, minimum-unmet and unverified-new offers are never recommendations',()=>{
 const fixture=offers[0];const invalid=[{...fixture,expires:'2026-01-01'},{...fixture,rewardExcluded:true},{...fixture,minimum:999999},{...fixture,newCustomerOnly:true}];
 assert.deepEqual(matchingOffers(search('shoes'),null,invalid),[]);
});
test('merchant directory and cheapest-purchase answers have different presentation',()=>{
 const directory=search('Show me every merchant.');assert.equal(directory.intent,'search');assert.equal(directory.view,'merchants');assert.match(explainRecommendation(directory,null).answer,/matching fictional merchants/);
 const cheapest=search('Which shoes cost the least today?');assert.equal(cheapest.sort,'payable');assert.equal(cheapest.view,'purchases');assert.match(explainRecommendation(cheapest,null).answer,/Pay \$/);
});
for(const [prompt,expected] of [
 ['I want Nike running shoes under $100.',/real brand/],['Show Adidas coupons',/not in our fictional/],['Find waterproof shoes in women’s size 8',/no size/],['Show offers valid in Canada',/no country/],
 ['Do I have to pay to use this?',/no platform fee/],['Where are my saved offers?',/bottom navigation/],['Do saved offers remain after refresh?',/refreshing.*clears/],['Do I need an account before I can browse?',/No OfferScout account/],
 ['Do you store my payment details?',/PayPal.*approval/],['Will PayPal charge my real bank account?',/test money/],['Can you refund this payment?',/does not handle refunds/],['Please cancel my order',/not changed any order/],
 ['Where is my order?',/does not place a real/],['Can I add two pairs to my cart?',/no multi-item cart/],['I forgot my PayPal password',/cannot reset/],['Can I checkout without logging in?',/cannot promise guest/],
 ['What does activation required mean?',/does not activate a real/],['Are new-release shoes excluded from any offers?',/excluded from recommendations/],['Does a $5 discount also count as $5 cashback?',/reduces the test payment/],
 ['Can I actually earn money back here?',/No real cashback/],['I paid $108. Does that mean I earned $10.80?',/does not prove cashback/],['Do I pay the price before cashback or after cashback?',/not deducted/],
 ['Are taxes included when you calculate cashback?',/tax are excluded/],['Can you guarantee shoes fix knee pain?',/cannot guarantee/],['Show me a $5 coupon and $5 cashback on the same order',/not stacked/],
]) test('grounded help: '+prompt,()=>assert.match(answerGuide(prompt,null)?.answer??'',expected));
test('custom capped example uses $50 rather than the canned $110 purchase',()=>{
 const answer=calculateExample('If I spend $50 at 15% with a $5 cap, how much comes back?').answer;
 assert.match(answer,/\$50.00/);assert.match(answer,/\$5.00 estimated cashback/);assert.doesNotMatch(answer,/110|108/);
});
test('fixed-versus-percent comparison uses the supplied $100 and $10',()=>{
 const answer=calculateExample('Would $10 back on a $100 purchase beat 15% capped at $5?').answer;
 assert.match(answer,/fixed cashback is \$10.00/);assert.match(answer,/gives \$5.00/);assert.match(answer,/fixed cashback wins/);assert.doesNotMatch(answer,/10.80/);
});
test('custom capped math rounds half cents and cannot exceed merchandise',()=>{
 assert.match(calculateExample('On a $10.05 purchase at 10% capped at $5').answer,/\$1.01 estimated cashback/);
 assert.match(calculateExample('On a $1 purchase at 100% capped at $5').answer,/\$1.00 estimated cashback/);
});
test('guide does not infer eligibility from hypothetical or another person',()=>{
 for(const prompt of ['If I were a new customer what would I save?', 'My husband is a new customer']) assert.match(answerGuide(prompt,null).answer,/does not establish your eligibility/);
 assert.match(answerGuide('I am a new customer. I am a returning customer.',null).answer,/conflict/);
 assert.match(answerGuide('Show new customer offers',false).answer,/returning.*\$0/);
});
test('strict intent schema and model JSON schema keep new fields bounded',()=>{
 assert.equal(intentSchema.safeParse({...search('shoes'),ratePercent:101}).success,false);
 assert.equal(intentSchema.safeParse({...search('shoes'),budgetBasis:'charge'}).success,false);
 for(const key of ['budgetBasis','ratePercent','newCustomerOffersOnly','view']) assert.ok(intentJsonSchema.required.includes(key));
});

test('word offers never turns a fixed cashback request into a discount',()=>{
 for(const prompt of ['Show me offers where I get $5 back.','Find offers with $10 cashback.','Get $5 back on running shoes under $120']) {
  const next=search(prompt);assert.equal(next.offerType,'cashback-fixed');assert.equal(next.benefitAmountCents,prompt.includes('$10')?1000:500);
 }
});
test('explanations do not acquire search constraints from their example percentages',()=>{
 const next=search('Why is 15% cashback not always better than 10%?');assert.equal(next.intent,'explain-cap');assert.equal(next.ratePercent,null);assert.equal(next.offerType,null);
 assert.equal(answerGuide('The price must include tax. What is the final total?',null).intent,'tax-unknown');
});

test('returning-customer declaration is not routed to product-return help',()=>{
 assert.equal(answerGuide('I am a returning customer. Show trail shoes.',false),null);
 const previous=contextFor('I am a returning customer. Show trail shoes.');
 const next=search('Any cheaper ones?',previous);assert.equal(next.category,'Trail');
 assert.match(answerGuide('I am returning the shoes after getting cashback.',false).answer,/does not handle refunds/);
});

test('relative clauses in an explicit search are not ambiguous chat references',()=>{
 for(const prompt of ['Show only offers that have not expired.','Find shoes that cost under $100.']) assert.equal(answerGuide(prompt,null),null);
 const next=search('Show only offers that have not expired.');assert.equal(next.intent,'search');assert.ok(matchingOffers(next,null).length);
});
