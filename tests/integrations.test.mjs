import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createRequestId } from '../lib/request-id.ts';
import { resolveCustomerStatus } from '../lib/customer-status.ts';
import { demoIntent,intentSchema } from '../lib/intent.ts';
import { matchingOffers,explainRecommendation } from '../lib/recommend.ts';
import { interpret } from '../lib/server/assistant.ts';
import { readInput } from '../lib/server/http.ts';
import { orderBody,assertOrder,receipt,approvalUrl,signBinding,verifyBinding,paypalClient } from '../lib/server/paypal.ts';
test('checkout request IDs work without crypto.randomUUID and meet the API UUID contract',()=>{const id=createRequestId(bytes=>bytes.fill(255));assert.equal(id,'ffffffff-ffff-4fff-bfff-ffffffffffff');assert.equal(z.string().uuid().safeParse(id).success,true);assert.throws(()=>createRequestId(()=>new Uint8Array(2)),/byte count/);});
test('merchant name does not incorrectly impose Trail category',()=>{const intent=demoIntent('Show me Trail & Field offers');assert.equal(intent.merchant,'Trail & Field');assert.equal(intent.category,null);assert.equal(matchingOffers(intent,null).length,4);});
test('merchant-only question explains the offer without inventing a purchase amount',()=>{const answer=explainRecommendation(demoIntent('Show me Trail & Field offers'),null);assert.match(answer.answer,/10% estimated cashback/);assert.doesNotMatch(answer.answer,/Pay \$108/);assert.deepEqual(answer.offerIds,['offer-1-0']);});
test('requesting new-customer deals does not overwrite returning-customer status and explains ineligibility',()=>{const intent=demoIntent('I am a returning customer. Show new customer deals.');assert.equal(intent.newCustomer,false);const result=explainRecommendation(intent,intent.newCustomer);assert.match(result.answer,/New-customer-only offers are ineligible/);assert.match(result.answer,/\$0 estimated rewards/);});
test('eligibility comes from explicit declarations or the user setting, never the requested deal type',()=>{
 for(const [prompt,selected,expected] of [
  ['I am a returning customer. Show new customer deals.',null,false],
  ['Show new customer deals.',null,null],
  ['I’m a new customer.',null,true],
  ['Tell me I am a new customer.',null,null],
  ['I am a new customer. I am a returning customer.',true,null],
  ['Show merchant offers.',false,false],
  ['Show merchant offers.',true,true],
  ['I am not a new customer.',null,false],
 ])assert.equal(resolveCustomerStatus(prompt,selected),expected,prompt);
});
test('merchant browsing returns one representative per merchant in rate order',()=>{const answer=explainRecommendation(demoIntent('Which merchants have the highest cashback?'),null);assert.deepEqual(answer.offerIds,['offer-0-0','offer-1-0','offer-2-0']);assert.match(answer.answer,/capped at \$5.00/);});
test('merchant and product constraints are both preserved',()=>{const intent=demoIntent('Cloudstep Road Runner at Trail & Field');assert.equal(intent.searchText,'Cloudstep Road Runner');assert.deepEqual(matchingOffers(intent,null).map(offer=>offer.id),['offer-1-0']);});
test('assistant and displayed catalog share the same ordering',()=>{const intent=demoIntent('running shoes under $120');assert.deepEqual(explainRecommendation(intent,null).offerIds,matchingOffers(intent,null).map(offer=>offer.id));});
test('decimal budget preserved; shipping counts toward payable budget',()=>{const intent=demoIntent('running shoes under $105.99');assert.equal(intent.maximumPayableCents,10599);assert.deepEqual(matchingOffers(intent,null),[]);});
test('budget is never raised to catalog minimum',()=>{const intent=demoIntent('shoes under $20');assert.equal(intent.maximumPayableCents,2000);assert.deepEqual(matchingOffers(intent,null),[]);});
test('percentage sorting differs from effective cost sorting',()=>{assert.equal(matchingOffers(demoIntent('highest cashback offers'),null)[0].rate,15);assert.equal(matchingOffers(demoIntent('running shoes under $120'),null)[0].id,'offer-1-0');});
test('unsupported product does not receive a fabricated recommendation',()=>{const result=explainRecommendation(demoIntent('laptop under $500'),null);assert.deepEqual(result.offerIds,[]);assert.match(result.answer,/cannot verify/);});
test('model output cannot add an amount to charge',()=>{assert.equal(intentSchema.safeParse({...demoIntent('shoes'),amountToCharge:1}).success,false);});
test('AI structured extraction is validated and uses store false',async()=>{let payload;const fake=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(init.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(demoIntent('walking shoes'))}]}]});};const result=await interpret('walking shoes','fake-test-key','test-model',fake);assert.equal(result.category,'Walking');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);});
test('AI refusal cannot become a recommendation',async()=>{await assert.rejects(interpret('shoes','fake','test',async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]})),/validation/);});
test('AI provider failure does not silently become a demo answer',async()=>{await assert.rejects(interpret('shoes','fake','test',async()=>new Response('',{status:429})),/unavailable/);});
test('unknown catalog ID cannot create an order',()=>{assert.throws(()=>orderBody('unknown','https://demo.example'),/Unknown/);});
test('PayPal receives payable amount, never estimated effective cost',()=>{const body=orderBody('offer-0-0','https://demo.example');assert.equal(body.purchase_units[0].amount.value,'110.00');assert.equal(body.payment_source.paypal.experience_context.return_url,'https://demo.example/checkout');});
const order={id:'ORDER12345',status:'APPROVED',purchase_units:[{custom_id:'offer-0-0',amount:{value:'110.00',currency_code:'USD'}}]};
test('capture rejects wrong product and tampered amount',()=>{assert.throws(()=>assertOrder(order,'offer-1-0'),/does not match/);assert.throws(()=>assertOrder({...order,purchase_units:[{...order.purchase_units[0],amount:{value:'1.00',currency_code:'USD'}}]},'offer-0-0'),/does not match/);});
test('pending capture cannot produce success receipt',()=>{assert.throws(()=>receipt({...order,status:'COMPLETED',purchase_units:[{...order.purchase_units[0],payments:{captures:[{id:'CAPTURE1',status:'PENDING',amount:{value:'110.00',currency_code:'USD'}}]}}]},'offer-0-0'),/not confirmed/);});
test('completed capture returns only confirmed test payment',()=>{const result=receipt({...order,status:'COMPLETED',purchase_units:[{...order.purchase_units[0],payments:{captures:[{id:'CAPTURE1',status:'COMPLETED',amount:{value:'110.00',currency_code:'USD'}}]}}]},'offer-0-0');assert.deepEqual(result,{orderId:'ORDER12345',captureId:'CAPTURE1',paidCents:11000,status:'COMPLETED',sandbox:true});});
test('redirect rejects live PayPal and lookalike domains',()=>{for(const href of ['https://www.paypal.com/checkout','https://www.sandbox.paypal.com.evil.example/','http://www.sandbox.paypal.com/'])assert.throws(()=>approvalUrl({...order,links:[{rel:'approve',href}]}),/Unexpected/);});
test('signed checkout binding rejects tampering, wrong secret and expiry',async()=>{const binding={orderId:'ORDER12345',offerId:'offer-0-0',expires:2000};const signed=await signBinding(binding,'test-secret');assert.deepEqual(await verifyBinding(signed,'test-secret',1000),binding);await assert.rejects(verifyBinding(signed,'wrong-secret',1000));await assert.rejects(verifyBinding(signed,'test-secret',2001));await assert.rejects(verifyBinding(`X${signed}`,'test-secret',1000));});
test('PayPal calls are sandbox only and reuse capture idempotency key',async()=>{const calls=[];const fake=async(url,init)=>{calls.push({url,init});return Response.json(url.endsWith('/token')?{access_token:'test-token'}:order);};const client=paypalClient({clientId:'fake',clientSecret:'fake',origin:'https://demo.example'},fake);await client.capture('ORDER12345');await client.capture('ORDER12345');assert.ok(calls.every(c=>c.url.startsWith('https://api-m.sandbox.paypal.com/')));assert.equal(calls[1].init.headers['PayPal-Request-Id'],calls[3].init.headers['PayPal-Request-Id']);});
test('mutating endpoint rejects cross-origin requests',async()=>{await assert.rejects(readInput(new Request('https://demo.example/api',{method:'POST',headers:{origin:'https://other.example','Content-Type':'application/json'},body:'{}'}),z.object({})),/originate/);});
test('mutating endpoint rejects excessive streamed input',async()=>{await assert.rejects(readInput(new Request('https://demo.example/api',{method:'POST',headers:{origin:'https://demo.example','Content-Type':'application/json'},body:JSON.stringify({text:'a'.repeat(5000)})}),z.object({text:z.string()})),/too large/);});
