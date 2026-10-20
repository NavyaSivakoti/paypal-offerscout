import {test} from 'node:test';
import assert from 'node:assert/strict';
import {offers,evaluate} from '../lib/offers.ts';
test('caps a headline 15% reward at $5',()=>{const o=offers.find(o=>o.id==='offer-0-0');assert.ok(o);assert.equal(evaluate(o,null).reward,500);assert.equal(evaluate(o,null).effective,10500);});
test('uncapped lower percentage beats capped offer',()=>{const a=offers.find(o=>o.id==='offer-0-0');const b=offers.find(o=>o.id==='offer-1-0');assert.ok(a&&b);assert.ok(evaluate(b,null).effective<evaluate(a,null).effective);});
test('unknown or returning customer cannot receive new-customer rewards',()=>{const o=offers.find(o=>o.newCustomerOnly);assert.ok(o);assert.equal(evaluate(o,null).reward,0);assert.equal(evaluate(o,false).reward,0);assert.ok(evaluate(o,true).reward>0);});
test('minimum spend cannot be satisfied by shipping',()=>{const o={...offers[0],price:14000,shipping:2000,minimum:15000};assert.equal(evaluate(o,true).reward,0);});
test('expired offers earn no reward',()=>{assert.equal(evaluate(offers[0],true,'2026-12-01').reward,0);});
test('shipping is charged today and excluded from reward basis',()=>{const o={...offers[0],price:10000,shipping:700,rate:10,cap:null};assert.deepEqual(evaluate(o,true),{subtotal:10000,discount:0,payable:10700,reward:1000,effective:9700,eligible:true,reason:'Meets the sample offer conditions'});});
