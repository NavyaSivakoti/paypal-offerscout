import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPlanSchema, rawFiltersSchema, requestPlanJsonSchema, parseMoney, parseRate, validateBudgetEvidence, decodeRequestPlan, wirePlanSchema, wirePlanJsonSchema } from '../lib/request-plan.ts';
import { applySearchPlan, emptyIntent } from '../lib/search-state.ts';
import { executeRequestPlan, calculateRequest } from '../lib/assistant-execution.ts';
import { planRequest } from '../lib/server/request-planner.ts';
import { resolvePlannedCustomerStatus } from '../lib/customer-status.ts';
import { matchingOffers } from '../lib/recommend.ts';
import { evaluate, offers, offerKind } from '../lib/offers.ts';
const emptyRaw=()=>Object.fromEntries(Object.keys(rawFiltersSchema.shape).map(key=>[key,null]));
const plan=(filters={},updates=[],scope='new',action='search',extra={})=>requestPlanSchema.parse({action,scope,updates,filters:{...emptyRaw(),...filters},topic:'other',limitations:[],currency:'USD',calculation:null,customerStatement:'none',customerEvidence:null,...extra});
const update=(field,evidence,operation='set')=>({field,operation,evidence});
const context=(intent)=>({intent,offerIds:matchingOffers(intent,null).slice(0,12).map(o=>o.id)});
for(const [literal,amount] of [['$1k',100000],['$75.25',7525],['five dollars',500],['twenty',2000],['one hundred and thirty dollars',13000],['$1,000',100000],['$0',0]]) test('literal normalization '+literal,()=>assert.equal(parseMoney(literal,'budget '+literal),amount));
for(const literal of ['$89.995','€100','£90','-5','$999999999999999999','1,2']) test('unsafe/unsupported amount is clarified '+literal,()=>assert.throws(()=>parseMoney(literal,'budget '+literal)));
test('invented money cannot enter search state',()=>assert.throws(()=>parseMoney('$120','same budget and $5 off'),/verify/));
test('percent normalization preserves fractional percentages',()=>{assert.equal(parseRate('7.5%','7.5% off'),750);assert.throws(()=>parseRate('10','10 dollars'));});
test('a benefit change cannot change the purchase budget',()=>{
 const previous={...emptyIntent(null),category:'Road',maximumPayableCents:11000,offerType:'cashback-fixed',benefitAmountCents:500};
 const prompt='Make that $10 back, same shoes and budget.';
 const result=applySearchPlan(plan({benefit:'$10'},[update('benefit','$10 back')],'refine'),prompt,null,context(previous));
 assert.equal(result.maximumPayableCents,11000);assert.equal(result.benefitAmountCents,1000);assert.equal(result.category,'Road');
 assert.throws(()=>applySearchPlan(plan({maximumPayment:'$10'},[update('maximumPayment','$10 back')],'refine'),prompt,null,context(previous)),/reward.*budget/);
 assert.equal(previous.maximumPayableCents,11000);
});
test('explicit filter removal is distinct from keeping a filter',()=>{
 const previous={...emptyIntent(null),category:'Walking',maximumPayableCents:10000};
 assert.equal(applySearchPlan(plan({},[],'refine'),'same search',null,context(previous)).maximumPayableCents,10000);
 const cleared=applySearchPlan(plan({},[update('maximumPayment','Remove the budget limit','clear')],'refine'),'Remove the budget limit',null,context(previous));
 assert.equal(cleared.maximumPayableCents,null);assert.equal(cleared.category,'Walking');
});
test('all offer types clears related rate and benefit restrictions',()=>{
 const previous={...emptyIntent(null),offerType:'cashback-percent',ratePercent:15};
 const result=applySearchPlan(plan({},[update('offerType','all offer types','clear')],'refine'),'all offer types',null,context(previous));
 assert.equal(result.offerType,null);assert.equal(result.ratePercent,null);
});
test('operation order does not erase a newly requested fixed benefit',()=>{
 for(const updates of [[update('benefit','$5'),update('offerType','$5 off')],[update('offerType','$5 off'),update('benefit','$5')]]) {
  const result=applySearchPlan(plan({offerType:'discount-fixed',benefit:'$5'},updates),'$5 off',null);assert.equal(result.benefitAmountCents,500);
 }
});
test('a new query resets old merchant and category state',()=>{
 const previous={...emptyIntent(null),merchant:'Trail & Field',category:'Road',maximumPayableCents:12000};
 const result=applySearchPlan(plan({category:'Walking',maximumPayment:'$85'},[update('category','walking'),update('maximumPayment','$85')]),'walking below $85',null,context(previous));
 assert.equal(result.category,'Walking');assert.equal(result.merchant,null);assert.equal(result.maximumPayableCents,8500);
});
test('changing only product retains the grounded merchant',()=>{
 const previous={...emptyIntent(null),merchant:'Trail & Field',searchText:'Cloudstep Road Runner',category:'Road'};
 const result=applySearchPlan(plan({product:'Tempo Road Runner'},[update('product','Tempo Road Runner')],'refine'),'their Tempo Road Runner',null,context(previous));
 assert.equal(result.merchant,'Trail & Field');assert.equal(result.searchText,'Tempo Road Runner');
});
test('changing category clears an incompatible old exact product',()=>{
 const previous={...emptyIntent(null),merchant:'Trail & Field',searchText:'Cloudstep Road Runner',category:'Road'};
 const result=applySearchPlan(plan({category:'Walking'},[update('category','walking')],'refine'),'walking',null,context(previous));assert.equal(result.searchText,null);
});
test('separate budgets and price bounds are all enforced across catalog',()=>{
 const prompt='between $80 and $90 upfront, at most $100 after cashback';
 const intent=applySearchPlan(plan({minimumPayment:'$80',maximumPayment:'$90',maximumEffective:'$100'},[update('minimumPayment','$80'),update('maximumPayment','$90'),update('maximumEffective','$100')]),prompt,null);
 assert.equal(intent.maximumPayableCents,9000);assert.equal(intent.maximumEffectiveCents,10000);assert.equal(intent.budgetBasis,'payable');
 const results=matchingOffers(intent,null);assert.ok(results.length);for(const o of results){const v=evaluate(o,null);assert.ok(v.payable>=8000&&v.payable<=9000&&v.effective<=10000);}
});
test('effective-only budget remains compatible with the public intent contract',()=>{
 const intent=applySearchPlan(plan({maximumEffective:'$100'},[update('maximumEffective','$100')]),'after cashback $100',null);
 assert.equal(intent.maximumPayableCents,10000);assert.equal(intent.budgetBasis,'effective');assert.ok(matchingOffers(intent,null).some(o=>evaluate(o,null).payable>10000));
});
test('free shipping and at-least rate include eligible 20% offers without narrower exact filter',()=>{
 const intent=applySearchPlan(plan({freeShipping:true,rate:'15%',rateComparison:'at-least',offerType:'cashback-percent'},[update('freeShipping','free shipping'),update('offerType','cashback'),update('rate','15%'),update('rateComparison','at least')]),'at least 15% cashback, free shipping',null);
 assert.equal(intent.ratePercent,null);assert.equal(intent.minimumRatePercent,15);const results=matchingOffers(intent,null);assert.ok(results.length);assert.ok(results.every(o=>o.shipping===0&&o.rate>=15));assert.ok(results.some(o=>o.rate===20));
});
test('merchant prefix is a prefix search rather than one invented exact merchant',()=>{
 const intent=applySearchPlan(plan({merchantPrefix:'Alder'},[update('merchantPrefix','Alder')]),'starts with Alder',null);
 const results=matchingOffers(intent,null);assert.ok(results.length>4);assert.ok(results.every(o=>o.merchant.startsWith('Alder')));
});
test('multiple named merchants form a union, not an arbitrary substitute',()=>{
 const intent=applySearchPlan(plan({merchants:['Stride Supply','Trail & Field']},[update('merchants','Stride Supply and Trail & Field')]),'Stride Supply and Trail & Field',null);
 const results=matchingOffers(intent,null);assert.equal(new Set(results.map(o=>o.merchant)).size,2);assert.ok(results.every(o=>intent.merchantSet.includes(o.merchant)));
});
test('ineligible selected purchase is still explainable without recommending it',()=>{
 const previous={...emptyIntent(null),merchant:'Trail & Field',searchText:'Tempo Road Runner',category:'Road'};
 const result=executeRequestPlan(plan({},[],'refine','inspect',{topic:'minimum'}),'Does that qualify?',null,context(previous),'model','v-test');
 assert.match(result.answer,/\$132.00.*below.*\$150.00/);assert.deepEqual(result.offerIds,[]);assert.deepEqual(result.referencedOfferIds,['offer-1-3']);
});
test('context cannot inject payable amount, and unknown product is rejected',()=>{
 assert.equal(requestPlanSchema.safeParse({...plan(),amountToCharge:1}).success,false);
 assert.equal(requestPlanSchema.safeParse({...plan(),filters:{...emptyRaw(),product:'Nike'}}).success,false);
});
test('missing reference and duplicate edits do not silently reset state',()=>{
 assert.throws(()=>applySearchPlan(plan({},[],'refine'),'that one',null),/previous offers/);
 assert.throws(()=>applySearchPlan(plan({maximumPayment:'$90'},[update('maximumPayment','$90'),update('maximumPayment','$90')]),'$90',null),/conflicting/);
});
test('unsupported currency and attributes produce a clear limitation without substitutes',()=>{
 const currency=executeRequestPlan(plan({},[],'new','help',{limitations:['currency'],currency:'EUR'}),'€100',null,undefined,'model','v');assert.deepEqual(currency.offerIds,[]);assert.match(currency.answer,/US dollars only/);
 const attrs=executeRequestPlan(plan({},[],'new','help',{limitations:['attributes'],topic:'catalog-limits'}),'black shoes',null,undefined,'model','v');assert.deepEqual(attrs.offerIds,[]);assert.match(attrs.answer,/shoe color/);
});
test('known help topics are routed by validated semantics, not words in a prompt',()=>{
 const result=executeRequestPlan(plan({maximumPayment:'$100'},[update('maximumPayment','$100')]),'$100 before tax including delivery',null,undefined,'model','v');assert.equal(result.intent.maximumPayableCents,10000);assert.ok(result.offerIds.length);
 for(const [topic,pattern] of [['identity',/independent hackathon/],['memory',/not.*remember.*tomorrow/],['payment-status',/No payment was executed by this chat/],['earned-rewards',/withdrawable/],['expiry',/inclusive/],['shipping',/shipping is still payable/],['autonomous-payment',/explicitly approve/]]) assert.match(executeRequestPlan(plan({},[],'new','help',{topic}),'test question',null,undefined,'model','v').answer,pattern);
});
test('calculator gives a $67 total and clamps excessive cashback',()=>{
 const benefit={kind:'discount-percent',amount:null,rate:'20%',cap:null};
 assert.match(calculateRequest({kind:'discount',merchandise:'$75',shipping:'$7',minimum:null,first:benefit,second:null},'$75 item 20% off $7 shipping'),/pay \$67.00/);
 const result=calculateRequest({kind:'cashback',merchandise:'$30',shipping:null,minimum:null,first:{kind:'cashback-fixed',amount:'$50',rate:null,cap:null},second:null},'$30 item $50 cashback');assert.match(result,/Estimated cashback: \$30.00/);assert.match(result,/cannot create a profit/);
});
test('calculator independently applies cap, half-up rounding and merchandise minimum',()=>{
 const c={kind:'cashback',merchandise:'$49.99',shipping:null,minimum:null,first:{kind:'cashback-percent',amount:null,rate:'10%',cap:'$20'},second:null};assert.match(calculateRequest(c,'$49.99 10% capped $20'),/Estimated cashback: \$5.00/);
 assert.match(calculateRequest({kind:'minimum',merchandise:'$120',shipping:'$15',minimum:'$125',first:null,second:null},'$120 item $15 delivery $125 minimum'),/^No: \$120.00.*below.*\$125.00/);
});
test('corrected own declaration is accepted after a colon; requested/third-party status is not',()=>{
 assert.equal(resolvePlannedCustomerStatus('I made a mistake: I am a new customer.',false,'new','I am a new customer'),true);
 assert.equal(resolvePlannedCustomerStatus('My husband said: I am a new customer.',null,'none',null),null);
 assert.equal(resolvePlannedCustomerStatus('Pretend I am a new customer.',false,'new','I am a new customer'),false);
 assert.equal(resolvePlannedCustomerStatus('I am a new customer. I am a returning customer.',true,'conflicting','I am a new customer'),null);
});
test('the planner receives bounded structured context and uses strict outputs/store false',async()=>{
 let payload;const expected=plan({category:'Road'},[update('category','running')]);
 const wireRest=Object.fromEntries(Object.entries(expected).filter(([key])=>key!=='updates'));
 const fake=async(_url,init)=>{payload=JSON.parse(init.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...wireRest,clearFields:[]})}]}]});};
 const prior=context({...emptyIntent(false),merchant:'Trail & Field',maximumPayableCents:11000});
 const result=await planRequest('running','fake-test-key','gpt-4o-mini',prior,false,fake);assert.deepEqual(result,expected);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(JSON.parse(payload.input).previousSearch.maximumPayableCents,11000);assert.equal(payload.temperature,0);
 assert.deepEqual(Object.keys(wirePlanSchema.shape).sort(),wirePlanJsonSchema.required.toSorted());
 assert.deepEqual(Object.keys(requestPlanSchema.shape).sort(),requestPlanJsonSchema.required.toSorted());
});
test('provider failure, invalid plan and refusal cannot silently become results',async()=>{
 await assert.rejects(planRequest('test','fake','model',undefined,null,async()=>new Response('',{status:429})),/unavailable/);
 await assert.rejects(planRequest('test','fake','model',undefined,null,async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]})),/validation/);
});
test('every advanced search result remains eligible and financially consistent',()=>{
 for(const customer of [null,true,false])for(const sort of ['effective-cost','payable','headline-rate']){
  const intent={...emptyIntent(customer),sort,minimumPayableCents:5000,maximumPayableCents:15000,maximumEffectiveCents:13000};
  for(const offer of matchingOffers(intent,customer)){const v=evaluate(offer,customer);assert.ok(v.eligible);assert.ok(v.payable>=5000&&v.payable<=15000&&v.effective<=13000);assert.equal(v.payable-v.reward,v.effective);if(sort==='headline-rate')assert.equal(offerKind(offer),'cashback-percent');}
 }
 assert.equal(offers.length,600);
});

test('currency symbols and numeric suffixes cannot be dropped from extracted evidence',()=>{
 assert.throws(()=>parseMoney('100','€100 budget'),/US dollars only/);
 assert.throws(()=>parseMoney('$1','$1k budget'),/complete monetary amount/);
 assert.throws(()=>parseMoney('$89.99','$89.995 budget'),/complete monetary amount/);
});

test('literal validation finds complete occurrences after numeric prefixes elsewhere',()=>{
 assert.equal(parseMoney('$7','$75 item with $7 shipping'),700);
 assert.equal(parseMoney('$5','$50 item capped at $5'),500);
});

test('a reward amount cannot borrow a nearby purchase amount as budget evidence',()=>assert.throws(()=>validateBudgetEvidence('$10','$100 budget and $10 back'),/reward.*budget/));

test('non-null filter values always produce a SET operation, with explicit clears separate',()=>{
 const base=plan({category:'Road'});const rest=Object.fromEntries(Object.entries(base).filter(([key])=>key!=='updates'));
 const decoded=decodeRequestPlan({...rest,clearFields:[]},'running');assert.equal(decoded.filters.category,'Road');assert.equal(decoded.updates[0].field,'category');
 assert.throws(()=>decodeRequestPlan({...rest,clearFields:['category']},'running'));
 const kept=decodeRequestPlan({...rest,filters:emptyRaw(),clearFields:[]},'same search');assert.equal(kept.updates.length,0);
 const cleared=decodeRequestPlan({...rest,filters:emptyRaw(),clearFields:['category']},'clear category');assert.equal(cleared.updates[0].operation,'clear');
});

test('clearing only a merchant prefix does not erase a separately selected merchant',()=>{
 const prompt='Trail & Field, remove the prefix';
 const intent=applySearchPlan(plan({merchants:['Trail & Field']},[update('merchants','Trail & Field'),update('merchantPrefix','remove the prefix','clear')]),prompt,null);
 assert.equal(intent.merchant,'Trail & Field');
 assert.throws(()=>applySearchPlan(plan({merchants:['Stride Supply']},[update('merchants','running shoes')]),'running shoes',null),/verify/);
});

test('unsupported limitations block recommendations even when a model proposes search',()=>{
 for(const code of ['attributes','unknown-merchant','product','medical','stacking','fabrication','secrets','action','other']) {
  const result=executeRequestPlan(plan({category:'Road'},[update('category','running')],'new','search',{limitations:[code],topic:code==='action'?'deletion':'catalog-limits'}),'running',null,undefined,'model','v');
  assert.deepEqual(result.offerIds,[],code);assert.equal(result.intent.intent,'unsupported',code);
 }
});
test('compound limitations explain both currency and region instead of dropping one',()=>{
 const result=executeRequestPlan(plan({},[],'new','help',{currency:'GBP',limitations:['currency','location']}),'UK under £100',null,undefined,'model','v');
 assert.match(result.answer,/US dollars only/);assert.match(result.answer,/country eligibility/);assert.deepEqual(result.offerIds,[]);
});
test('reasoning models receive a bounded reasoning effort without temperature',async()=>{
 let payload;const expected=plan();const rest=Object.fromEntries(Object.entries(expected).filter(([key])=>key!=='updates'));
 const fake=async(_url,init)=>{payload=JSON.parse(init.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...rest,clearFields:[]})}]}]});};
 await planRequest('test','fake-test-key','gpt-5-mini',undefined,null,fake);
 assert.deepEqual(payload.reasoning,{effort:'low'});assert.equal(payload.temperature,undefined);assert.equal(payload.max_output_tokens,4000);
});

test('monetary spans tolerate surrounding comparison words and sentence punctuation without losing precision',()=>{
 for(const [text,expected] of [['under $120.',12000],['$5 back',500],['ten dollars off at checkout',1000],['120 dollars.',12000]]) assert.equal(parseMoney(text,text),expected);
 assert.throws(()=>parseMoney('under $89.995.','under $89.995.'),/two decimal/);
 assert.throws(()=>parseMoney('$10 off under $120','$10 off under $120'));
 assert.throws(()=>validateBudgetEvidence('$5 back','only $5 back'),/reward.*budget/);
});
test('a missed direct returning declaration cannot grant or retain new-customer eligibility',()=>{
 assert.equal(resolvePlannedCustomerStatus("I'm a returning customer at Trail & Field. What can I use?",true,'none',null),false);
 assert.equal(resolvePlannedCustomerStatus('I am a new customer.',false,'none',null),true);
 assert.equal(resolvePlannedCustomerStatus('My husband said: I am a new customer.',false,'none',null),false);
});

test('a spurious currency classification cannot reject an explicitly dollar-denominated request',()=>{
 const result=executeRequestPlan(plan({maximumPayment:'120 dollars'},[update('maximumPayment','120 dollars')],'new','search',{currency:'other',limitations:['currency']}),'shoes under 120 dollars',null,undefined,'model','v');
 assert.equal(result.intent.maximumPayableCents,12000);assert.ok(result.offerIds.length);
 const foreign=executeRequestPlan(plan({},[],'new','search',{currency:'USD'}),'UK offer in GBP or USD',null,undefined,'model','v');assert.deepEqual(foreign.offerIds,[]);assert.match(foreign.answer,/US dollars only/);
});

test('merchant eligibility help also shows usable offers with the actual declared status',()=>{
 const prompt="I'm a returning customer at Trail & Field. What can I use?";
 const result=executeRequestPlan(plan({merchants:['Trail & Field']},[update('merchants','Trail & Field')],'new','help',{topic:'eligibility'}),prompt,false,undefined,'model','v');
 assert.equal(result.intent.merchant,'Trail & Field');assert.equal(result.intent.newCustomer,false);assert.match(result.answer,/returning/);assert.ok(result.offerIds.length);
 for(const id of result.offerIds) assert.ok(evaluate(offers.find(o=>o.id===id),false).eligible);
});
test('eligibility corrections retain all contextual shopping constraints',()=>{
 const previous={...emptyIntent(false),category:'Walking',maximumPayableCents:10000};
 const result=executeRequestPlan(plan({},[],'refine','help',{topic:'eligibility'}),'I am a new customer. Keep those filters.',true,context(previous),'model','v');
 assert.equal(result.intent.category,'Walking');assert.equal(result.intent.maximumPayableCents,10000);assert.equal(result.intent.newCustomer,true);
});

test('a temporal modifier on a literal amount does not turn an ordinary budget into a precision error',()=>{
 assert.equal(parseMoney('$100 today','I can pay $100 today, even if cashback arrives later.'),10000);
 assert.equal(parseMoney('$90 upfront','$90 upfront'),9000);
 assert.throws(()=>parseMoney('$89.995 today','$89.995 today'),/two decimal/);
});
test('a compound help plan preserves its primary answer as well as limitations',()=>{
 const result=executeRequestPlan(plan({},[],'new','help',{topic:'tax',limitations:['location','unknown-merchant']}),'What is the final total including tax?',null,undefined,'model','v');
 assert.match(result.answer,/Tax amounts are unavailable/);assert.equal(result.intent.intent,'tax-unknown');assert.deepEqual(result.offerIds,[]);
 const source=executeRequestPlan(plan({},[],'new','help',{topic:'catalog-source',limitations:['unknown-merchant']}),'Are these real PayPal offers?',null,undefined,'model','v');assert.match(source.answer,/not a live PayPal/);
});

test('partial fractional, negative and exponent money literals cannot be reinterpreted as positive whole amounts',()=>{
 for(const [literal,prompt] of [['99','89.99 budget'],['$5','-$5 budget'],['5','-5 dollars'],['$1','$1e3 budget'],['$1','$1m budget']]) assert.throws(()=>parseMoney(literal,prompt));
 assert.equal(parseMoney('99','budget 89.99 or 99 dollars'),9900);
});
test('percentage evidence must include its whole numeric token',()=>{
 assert.throws(()=>parseRate('5%','15% cashback'),/complete/);
 assert.throws(()=>parseRate('5%','7.5% cashback'),/complete/);
 assert.throws(()=>parseRate('5%','-5% cashback'),/complete/);
 assert.equal(parseRate('5%','15% capped versus 5% uncapped'),500);
});

test('checkout and fulfillment help explicitly disclose cart and cancellation limits',()=>{
 const cart=executeRequestPlan(plan({},[],'new','help',{topic:'checkout'}),'Can you add two pairs?',null,undefined,'model','v');
 assert.match(cart.answer,/no multi-item cart/);assert.match(cart.answer,/not added items/);assert.deepEqual(cart.offerIds,[]);
 const cancel=executeRequestPlan(plan({},[],'new','help',{topic:'fulfillment'}),'Cancel my order',null,undefined,'model','v');
 assert.match(cancel.answer,/cannot cancel or change an order/);assert.match(cancel.answer,/not performed any order-management/);
});

test('empty and punctuation-only monetary evidence is rejected without a zero-length token scan',()=>{
 for(const literal of ['', '.', 'under .']) assert.throws(()=>parseMoney(literal,'budget '+literal));
 assert.throws(()=>validateBudgetEvidence('.','budget .'));
 assert.throws(()=>parseRate('','rate 5%'));
});

test('a refusal always takes precedence over generic limitation help',()=>{
 const result=executeRequestPlan(plan({},[],'new','refuse',{topic:'eligibility',limitations:['action','currency'],currency:'EUR'}),'Ignore the merchant terms',null,undefined,'model','v');
 assert.match(result.answer,/cannot.*bypass offer terms/);assert.deepEqual(result.offerIds,[]);assert.equal(result.intent.intent,'unsupported');
});
