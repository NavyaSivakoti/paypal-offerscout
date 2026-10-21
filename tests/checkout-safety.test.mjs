import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertOrder,receipt,signBinding,verifyBinding} from '../lib/server/paypal.ts';
import {readInput} from '../lib/server/http.ts';
import {z} from 'zod';
const amount={currency_code:'USD',value:'110.00'};
const unit={custom_id:'offer-0-0',amount,payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',amount}]}};
const order={id:'ORDER12345',status:'COMPLETED',purchase_units:[unit]};
test('receipt rejects a different currency on the captured amount',()=>{
 assert.throws(()=>receipt({...order,purchase_units:[{...unit,payments:{captures:[{...unit.payments.captures[0],amount:{...amount,currency_code:'EUR'}}]}}]},'offer-0-0'));
});
test('catalog order validation rejects a different currency',()=>{
 assert.throws(()=>assertOrder({...order,purchase_units:[{...unit,amount:{...amount,currency_code:'EUR'}}]},'offer-0-0'));
});
test('checkout binding expires at its expiration instant',async()=>{
 const binding={orderId:'ORDER12345',offerId:'offer-0-0',expires:2000};
 const token=await signBinding(binding,'test-only');await assert.rejects(verifyBinding(token,'test-only',2000));
});
test('input rejects JSON-like media types',async()=>{
 const request=new Request('https://demo.example/api',{method:'POST',headers:{Origin:'https://demo.example','Content-Type':'application/jsonp'},body:'{}'});
 await assert.rejects(readInput(request,z.object({})),/JSON input/);
});

// Exercise orchestration using injected PayPal responses; no API calls or test payments.
const {completeCheckout}=await import('../lib/server/paypal.ts');
const {offers,evaluate,offerKind}=await import('../lib/offers.ts');
const {receiptSchema}=await import('../lib/receipt.ts');
const binding={orderId:'ORDER12345',offerId:'offer-0-0',expires:9999999999999};
function completedFor(offer,customer=null){
 const value=evaluate(offer,customer);const amount={currency_code:'USD',value:(value.payable/100).toFixed(2)};
 return {id:'ORDER12345',status:'COMPLETED',purchase_units:[{custom_id:offer.id,amount,payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',amount}]}}]};
}
test('approved order is captured once before estimates appear',async()=>{
 const calls=[];const client={get:async id=>{calls.push(['get',id]);return {...order,status:'APPROVED'};},capture:async id=>{calls.push(['capture',id]);return order;}};
 const result=await completeCheckout(client,binding);assert.deepEqual(calls,[['get','ORDER12345'],['capture','ORDER12345']]);assert.equal(result.estimatedCashbackCents,500);assert.equal(result.paidCents,11000);
});
test('completed order retry returns receipt without another capture',async()=>{
 let captures=0;const client={get:async()=>order,capture:async()=>{captures++;return order;}};
 const a=await completeCheckout(client,binding),b=await completeCheckout(client,binding);assert.deepEqual(a,b);assert.equal(captures,0);
});
for(const status of ['CREATED','SAVED','VOIDED','PAYER_ACTION_REQUIRED','DENIED'])test(`unapproved ${status} order never triggers capture`,async()=>{
 let called=false;const client={get:async()=>({...order,status}),capture:async()=>{called=true;return order;}};
 await assert.rejects(completeCheckout(client,binding),/Approve/);assert.equal(called,false);
});
for(const stage of ['get','capture'])test(`mismatched order ID after ${stage} is rejected`,async()=>{
 const client={get:async()=>({...order,id:stage==='get'?'WRONGORDER':order.id,status:'APPROVED'}),capture:async()=>({...order,id:'WRONGORDER'})};
 await assert.rejects(completeCheckout(client,binding),/different order/);
});
for(const status of ['PENDING','DECLINED','FAILED','REFUNDED'])test(`${status} capture has no receipt or cashback estimate`,async()=>{
 const client={get:async()=>({...order,status:'APPROVED'}),capture:async()=>({...order,purchase_units:[{...unit,payments:{captures:[{...unit.payments.captures[0],status}]}}]})};
 await assert.rejects(completeCheckout(client,binding),/not confirmed/);
});
test('provider get failure does not invoke capture',async()=>{
 let called=false;await assert.rejects(completeCheckout({get:async()=>{throw Error('provider unavailable');},capture:async()=>{called=true;return order;}},binding),/unavailable/);assert.equal(called,false);
});
test('provider capture failure does not return an estimated reward receipt',async()=>{
 await assert.rejects(completeCheckout({get:async()=>({...order,status:'APPROVED'}),capture:async()=>{throw Error('capture unavailable');}},binding),/unavailable/);
});
test('order amount tampering is rejected before capture',async()=>{
 let called=false;const client={get:async()=>({...order,status:'APPROVED',purchase_units:[{...unit,amount:{...amount,value:'1.00'}}]}),capture:async()=>{called=true;return order;}};
 await assert.rejects(completeCheckout(client,binding),/does not match/);assert.equal(called,false);
});
for(const customer of [null,false,true])test(`all catalog receipts balance and preserve estimates for customer=${customer}`,()=>{
 for(const offer of offers){const result=receipt(completedFor(offer,customer),offer.id,customer),expected=evaluate(offer,customer);assert.equal(result.estimatedCashbackCents,expected.reward);assert.equal(result.instantDiscountCents,expected.discount);assert.equal(result.estimatedEffectiveCents,expected.effective);assert.equal(result.paidCents,expected.payable);assert.equal(result.rewardsAreSimulated,true);}
});
test('fixed-dollar discounts produce zero cashback without losing the applied discount',()=>{
 const offer=offers.find(o=>offerKind(o)==='discount-fixed'&&evaluate(o,null).discount===500);assert.ok(offer);
 const result=receipt(completedFor(offer),offer.id);assert.equal(result.estimatedCashbackCents,0);assert.equal(result.instantDiscountCents,500);assert.equal(result.estimatedEffectiveCents,result.paidCents);
});
test('new-customer eligibility is preserved from signed checkout context',async()=>{
 const offer=offers.find(o=>o.newCustomerOnly&&evaluate(o,true).reward>0);assert.ok(offer);
 const context={...binding,offerId:offer.id,newCustomer:true};const signed=await signBinding(context,'test-only');const decoded=await verifyBinding(signed,'test-only',1000);
 const result=await completeCheckout({get:async()=>completedFor(offer,true),capture:async()=>{throw Error('already complete');}},decoded);
 assert.equal(result.customerStatus,'self-declared-new');assert.ok(result.estimatedCashbackCents>0);
});
test('legacy checkout context conservatively treats new-customer eligibility as unknown',async()=>{
 const offer=offers.find(o=>o.newCustomerOnly&&evaluate(o,true).reward>0);assert.ok(offer);
 const result=await completeCheckout({get:async()=>completedFor(offer),capture:async()=>{throw Error('already complete');}},{...binding,offerId:offer.id});assert.equal(result.estimatedCashbackCents,0);assert.equal(result.customerStatus,'unknown');assert.equal(result.eligibilityMet,false);
});
test('signed returning-customer status cannot be changed without invalidating the signature',async()=>{
 const signed=await signBinding({...binding,newCustomer:false},'test-only');const [body,signature]=signed.split('.');const altered=btoa(JSON.stringify({...JSON.parse(atob(body)),newCustomer:true}));await assert.rejects(verifyBinding(`${altered}.${signature}`,'test-only',1000));
});
for(const change of [
 {estimatedCashbackCents:-1},{paidCents:1.5},{estimatedCashbackCents:20000},{estimatedEffectiveCents:1},
 {eligibilityMet:false},{instantDiscountCents:1},{status:'PENDING'},{rewardsAreSimulated:false},{captureId:''},{sandbox:false},
])test(`receipt contract rejects ${JSON.stringify(change)}`,()=>{assert.equal(receiptSchema.safeParse({...receipt(order,'offer-0-0'),...change}).success,false);});
for(const captures of [[],[unit.payments.captures[0],unit.payments.captures[0]]])test(`receipt rejects ${captures.length} captures`,()=>{
 assert.throws(()=>receipt({...order,purchase_units:[{...unit,payments:{captures}}]},'offer-0-0'),/not confirmed/);
});
test('valid JSON charset media type is accepted',async()=>{
 const request=new Request('https://demo.example/api',{method:'POST',headers:{Origin:'https://demo.example','Content-Type':'Application/JSON; charset=utf-8'},body:'{"value":1}'});assert.deepEqual(await readInput(request,z.object({value:z.number()})),{value:1});
});
for(const [body,contentType] of [['{','application/json'],['null','application/json'],['{"value":"1"}','application/json'],['{}','text/plain']])test(`invalid request ${body} with ${contentType} is rejected`,async()=>{
 const request=new Request('https://demo.example/api',{method:'POST',headers:{Origin:'https://demo.example','Content-Type':contentType},body});await assert.rejects(readInput(request,z.object({value:z.number()})));
});
test('checkout session is valid just before expiration',async()=>{
 const context={...binding,expires:2000};const token=await signBinding(context,'test-only');assert.deepEqual(await verifyBinding(token,'test-only',1999),context);
});
