import type { ShoppingIntent } from './intent.ts';
import { offers, evaluate, money, type Offer } from './offers.ts';
export const DEMO_DATE='2026-10-17';
export function matchingOffers(intent: ShoppingIntent, customer: boolean|null, catalog: Offer[]=offers): Offer[] {
 if(intent.intent!=='search')return [];
 return catalog.filter(o=>(!intent.merchant||o.merchant===intent.merchant)&&(!intent.category||o.category===intent.category)&&(!intent.searchText||`${o.product} ${o.merchant}`.toLowerCase().includes(intent.searchText.toLowerCase()))&&(intent.maximumPayableCents===null||evaluate(o,customer,DEMO_DATE).payable<=intent.maximumPayableCents)).sort((a,b)=>{
 const ea=evaluate(a,customer,DEMO_DATE),eb=evaluate(b,customer,DEMO_DATE);
 return (intent.sort==='headline-rate'?b.rate-a.rate:intent.sort==='payable'?ea.payable-eb.payable:ea.effective-eb.effective)||a.id.localeCompare(b.id);
 });
}
export function explainRecommendation(intent: ShoppingIntent, customer: boolean|null): {answer:string;offerIds:string[]} {
 if(intent.intent==='explain-cap')return {answer:'At $110, 15% would be $16.50, but the $5 cap limits estimated rewards to $5: estimated cost $105. At $108, 10% uncapped gives $10.80 estimated rewards: estimated cost $97.20. The lower rate wins. These are fictional examples, not rewards earned.',offerIds:['offer-0-0','offer-1-0']};
 if(intent.intent==='explain-minimum')return {answer:'Shipping does not count toward the minimum merchandise spend in these sample terms. A $140 item plus $20 shipping does not meet a $150 merchandise minimum.',offerIds:[]};
 if(intent.intent==='tax-unknown')return {answer:'Tax is not available in this sample catalog. Prices include listed shipping but exclude tax; I cannot give a total including tax.',offerIds:[]};
 if(intent.intent==='unsupported')return {answer:'I can compare the fictional shoe offers in this catalog. I cannot verify real merchant offers, invent cashback, or confirm rewards earned. Try a sample merchant, road shoes, trail shoes, or walking shoes.',offerIds:[]};
 const choices=matchingOffers(intent,customer);const best=choices[0];
 if(!best)return {answer:'No sample offers match those conditions. Try a larger budget or another sample merchant. Your budget has not been increased automatically.',offerIds:[]};
 if(intent.maximumPayableCents===null&&!intent.category&&!intent.searchText){
  const representatives=choices.filter((offer,index)=>choices.findIndex(candidate=>candidate.merchant===offer.merchant)===index);
  const summary=representatives.map(offer=>`${offer.merchant}: ${offer.rate}% estimated cashback${offer.cap===null?', no cashback cap in the sample terms':`, capped at ${money(offer.cap)} per order`}.`).join('\n');
  return {answer:`${summary}\nRates apply to eligible merchandise; purchase minimums and customer restrictions may apply. Open a merchant to inspect the conditions. Dollar savings depend on the purchase and eligibility. These are fictional offers, not cashback earned.`,offerIds:representatives.map(offer=>offer.id)};
 }
 const e=evaluate(best,customer,DEMO_DATE);const criterion=intent.sort==='headline-rate'?'highest headline cashback rate':intent.sort==='payable'?'lowest payment today':'lowest estimated cost after rewards';
 return {answer:`${best.merchant}’s ${best.product} ranks first by ${criterion}. Pay ${money(e.payable)} today, before tax. Estimated rewards: ${money(e.reward)}; estimated cost afterward: ${money(e.effective)}. ${e.reason}. Estimates assume offer activation and use the demo date October 17, 2026. Open the offer terms for the evidence.`,offerIds:choices.map(o=>o.id)};
}
