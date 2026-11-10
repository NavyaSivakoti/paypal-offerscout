import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestPlanSchema, rawFiltersSchema } from '../lib/request-plan.ts';
import { chatContextSchema, contextForAnswer } from '../lib/conversation.ts';
import { executeRequestPlan } from '../lib/assistant-execution.ts';
import { emptyIntent } from '../lib/search-state.ts';
import { offers, evaluate } from '../lib/offers.ts';
import { planRequest } from '../lib/server/request-planner.ts';
const raw=()=>Object.fromEntries(Object.keys(rawFiltersSchema.shape).map(key=>[key,null]));
function plan(action,filters={},scope='new',extra={}) {
 return requestPlanSchema.parse({action,scope,filters:{...raw(),...filters},updates:Object.entries(filters).filter(([,v])=>v!==null).map(([field])=>({field,operation:'set',evidence:extra.prompt??'walking shoes'})),topic:'other',limitations:[],customerStatement:'none',customerEvidence:null,currency:'unspecified',calculation:null,...Object.fromEntries(Object.entries(extra).filter(([k])=>k!=='prompt'))});
}
const execute=(request,prompt,context,customer=null)=>executeRequestPlan(request,prompt,customer,context,'test-model','v-test');
function firstOffer(customer=null) {
 const prompt='Walking sample offers under $100 with an unverified fit requirement.';
 return execute(plan('help',{category:'Walking',maximumPayment:'$100'},'new',{topic:'health',limitations:['medical'],prompt}),prompt,undefined,customer);
}
const next=(answer,previous)=>chatContextSchema.parse(JSON.parse(JSON.stringify(contextForAnswer(answer,previous))));

test('pending category → unsupported attribute → confirmation retains disclosed price matches',()=>{
 const first=firstOffer();assert.deepEqual(first.offerIds,[]);assert.match(first.answer,/Walking.*price/);assert.match(first.answer,/Would you like/);
 const c1=next(first);assert.equal(c1.pendingComparison.intent.category,'Walking');assert.equal(c1.pendingComparison.intent.maximumPayableCents,10000);
 const second=execute(plan('help',{},'refine',{topic:'catalog-limits',limitations:['attributes']}),'comfortable shoes',c1);
 const c2=next(second,c1);assert.deepEqual(second.offerIds,[]);assert.equal(c2.pendingComparison.intent.category,'Walking');
 const accepted=execute(plan('accept-comparison',{},'refine'),'yes',c2);
 assert.equal(accepted.intent.category,'Walking');assert.equal(accepted.intent.maximumPayableCents,10000);assert.ok(accepted.offerIds.length);assert.match(accepted.answer,/comfort, fit, medical suitability.*not verified/);
 for(const id of accepted.offerIds){const o=offers.find(o=>o.id===id);assert.equal(o.category,'Walking');assert.ok(evaluate(o,null).payable<=10000);assert.ok(evaluate(o,null).eligible);}
 assert.equal(next(accepted,c2).pendingComparison,undefined);
});
test('a bare confirmation without a pending comparison cannot display or purchase anything',()=>{
 assert.throws(()=>execute(plan('accept-comparison'),'yes'),/no pending price comparison/);
});
test('declining consumes the pending question without showing results',()=>{
 const c=next(firstOffer());const declined=execute(plan('decline-comparison',{},'refine'),'no thanks',c);const cleared=next(declined,c);
 assert.deepEqual(declined.offerIds,[]);assert.equal(cleared.pendingComparison,undefined);
 assert.throws(()=>execute(plan('accept-comparison'),'yes',cleared),/no pending/);
});
test('an unrelated help answer clears a pending question while retaining the last actual search',()=>{
 const original={intent:{...emptyIntent(false),merchant:'Trail & Field'},offerIds:['offer-1-0']};
 const prompt='Walking sample shoes with an unverified product specification.';
 const proposed=execute(plan('help',{category:'Walking'},'new',{topic:'health',limitations:['medical'],prompt}),prompt,original,false);
 const c=next(proposed,original);const help=execute(plan('help',{},'new',{topic:'fees'}),'Does this cost money?',c,false);
 const cleared=next(help,c);assert.equal(cleared.pendingComparison,undefined);assert.equal(cleared.intent.merchant,'Trail & Field');
});
test('an independent supported search replaces pending filters',()=>{
 const c=next(firstOffer());const query='trail shoes under $90';
 const answer=execute(plan('search',{category:'Trail',maximumPayment:'$90'},'new',{prompt:query}),query,c);
 const updated=next(answer,c);assert.equal(updated.pendingComparison,undefined);assert.equal(updated.intent.category,'Trail');assert.equal(updated.intent.maximumPayableCents,9000);
});
test('yes with a new budget changes only that budget and keeps eligibility grounded',()=>{
 const c=next(firstOffer());c.pendingComparison.intent.newCustomer=true;
 const prompt='yes, under $85 please';const result=execute(plan('accept-comparison',{maximumPayment:'$85'},'refine',{prompt}),prompt,c,false);
 assert.equal(result.intent.category,'Walking');assert.equal(result.intent.maximumPayableCents,8500);assert.equal(result.intent.newCustomer,false);
 for(const id of result.offerIds)assert.ok(!offers.find(o=>o.id===id).newCustomerOnly);
});
test('renewing an unsupported requirement after yes still requires consent and never asserts comfort',()=>{
 const c=next(firstOffer());const result=execute(plan('accept-comparison',{},'refine',{topic:'health',limitations:['medical']}),'yes but guarantee the unverified specification',c);
 assert.deepEqual(result.offerIds,[]);assert.ok(next(result,c).pendingComparison);assert.match(result.answer,/cannot confirm suitability/);
});
test('changing a pending budget without consent updates the proposal without displaying substitute shoes',()=>{
 const c=next(firstOffer());const prompt='make the budget $80';
 const result=execute(plan('search',{maximumPayment:'$80'},'refine',{prompt}),prompt,c);
 assert.deepEqual(result.offerIds,[]);assert.equal(next(result,c).pendingComparison.intent.maximumPayableCents,8000);assert.equal(next(result,c).pendingComparison.intent.category,'Walking');
});
test('pending context contains no raw clinical history, payment command or price to charge',()=>{
 const c=next(firstOffer());assert.doesNotMatch(JSON.stringify(c),/userHistory|personalStatement|purchaseNow|amountToCharge/);
 assert.equal(chatContextSchema.safeParse({...c,pendingComparison:{...c.pendingComparison.intent,charge:100}}).success,false);
 assert.ok(JSON.stringify({prompt:'x'.repeat(1000),mode:'live',newCustomer:null,context:c}).length<4096);
});
test('unsupported real merchants do not get an untracked yes/no offer to substitute generic shoes',()=>{
 const r=execute(plan('help',{},'new',{topic:'catalog-limits',limitations:['unknown-merchant']}),'Nike shoes');
 assert.deepEqual(r.offerIds,[]);assert.equal(r.conversationContext,undefined);assert.doesNotMatch(r.answer,/Would you like/);
});
test('a successful empty search consumes the pending offer without increasing the budget',()=>{
 const c=next(firstOffer());const prompt='yes, under $1';
 const r=execute(plan('accept-comparison',{maximumPayment:'$1'},'refine',{prompt}),prompt,c);
 assert.deepEqual(r.offerIds,[]);assert.equal(r.intent.maximumPayableCents,100);assert.equal(next(r,c).pendingComparison,undefined);
});
test('the model receives the offered comparison as bounded context',async()=>{
 const c=next(firstOffer());let payload;
 const p=plan('accept-comparison',{},'refine');const wire=Object.fromEntries(Object.entries(p).filter(([key])=>key!=='updates'));
 const fake=async(_url,init)=>{payload=JSON.parse(init.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...wire,clearFields:[]})}]}]});};
 const result=await planRequest('yes','fake-test-key','test-model',c,null,fake);
 const input=JSON.parse(payload.input);assert.equal(result.action,'accept-comparison');assert.equal(input.pendingComparison.intent.category,'Walking');assert.equal(input.previousSearch.category,'Walking');
});
