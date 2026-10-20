import { z } from 'zod';
import { merchantNames } from './merchants.ts';
import { OFFER_FILTERS } from './offers.ts';
export const intentSchema = z.object({
 intent: z.enum(['search','explain-cap','explain-minimum','tax-unknown','unsupported']),
 merchant: z.enum(merchantNames).nullable(),
 category: z.enum(['Road','Trail','Walking']).nullable(),
 maximumPayableCents: z.number().int().min(0).max(10000000).nullable(),
 sort: z.enum(['effective-cost','headline-rate','payable']),
 newCustomer: z.boolean().nullable(),
 offerType: z.enum(OFFER_FILTERS).nullable().default(null),
 benefitAmountCents: z.number().int().min(0).max(1000000).nullable().default(null),
 searchText: z.string().max(100).nullable(),
}).strict();
export type ShoppingIntent = z.infer<typeof intentSchema>;
export const intentJsonSchema = {
 type:'object',additionalProperties:false,
 properties:{
  intent:{type:'string',enum:['search','explain-cap','explain-minimum','tax-unknown','unsupported']},
  merchant:{type:['string','null'],enum:[...merchantNames,null]},
  category:{type:['string','null'],enum:['Road','Trail','Walking',null]},
  maximumPayableCents:{type:['integer','null'],minimum:0,maximum:10000000},
  sort:{type:'string',enum:['effective-cost','headline-rate','payable']},
  newCustomer:{type:['boolean','null']},offerType:{type:['string','null'],enum:[...OFFER_FILTERS,null]},benefitAmountCents:{type:['integer','null'],minimum:0,maximum:1000000},searchText:{type:['string','null'],maxLength:100},
 },required:['intent','merchant','category','maximumPayableCents','sort','newCustomer','offerType','benefitAmountCents','searchText'],
};
export function demoIntent(prompt: string): ShoppingIntent {
 const text=prompt.toLowerCase();
 const merchant=merchantNames.find(m=>text.includes(m.toLowerCase()))??null;
 // Remove the merchant name before interpreting product categories (Trail & Field is not a trail request).
 const productText=merchant?text.replace(merchant.toLowerCase(),''):text;
 const product=(['Cloudstep Road Runner','Ridgeline Trail Shoe','Everyday Walking Shoe','Tempo Road Runner'] as const).find(name=>productText.includes(name.toLowerCase()))??null;
 const amount=productText.match(/(?:under|below|budget(?: of)?|up to)\s*\$?\s*(\d+(?:\.\d{1,2})?)(?![\d.%])/);
 const fixedAmount=productText.match(/(?:save|get)\s*\$(\d+(?:\.\d{1,2})?)/)??productText.match(/\$(\d+(?:\.\d{1,2})?)\s*(?:cash\s*back|back|off)/);
 const kind=/tax/.test(text)?'tax-unknown':/shipping.*(?:minimum|count)|minimum.*shipping/.test(text)?'explain-minimum':/why.*15|15.*10|explain.*cap/.test(text)?'explain-cap':/laptop|phone|jacket|macy|\bnike\b|\badidas\b|ignore.*(?:cap|rules)|earned/.test(text)?'unsupported':merchant||/shoe|running|walking|trail|road|offer|cashback|cash back|deal|discount|coupon|save|off/.test(text)?'search':'unsupported';
 return intentSchema.parse({intent:kind,merchant,category:/trail/.test(productText)?'Trail':/walking/.test(productText)?'Walking':/running|road/.test(productText)?'Road':null,maximumPayableCents:amount?Math.round(Number(amount[1])*100):null,sort:/highest.*(?:cashback|percent|rate)/.test(text)?'headline-rate':/lowest.*price|cheapest.*today/.test(text)?'payable':'effective-cost',benefitAmountCents:fixedAmount?Math.round(Number(fixedAmount[1])*100):null,offerType:/cash\s*back|cashback|\$\d+(?:\.\d{1,2})?\s*back/.test(text)?(/(?:\$\d+(?:\.\d{1,2})?\s*(?:cash\s*)?back|dollar|fixed)/.test(text)?'cashback-fixed':/percent|%|highest/.test(text)?'cashback-percent':'cashback'):/\bsave\b|\boff\b|\bdiscounts?\b|\bcoupons?\b/.test(text)?(/percent|%/.test(text)?'discount-percent':/save\s*\$|\$\d+(?:\.\d{1,2})?\s*off|dollar|fixed/.test(text)?'discount-fixed':'discount'):null,newCustomer:/returning customer/.test(text)?false:/i am a new customer/.test(text)?true:null,searchText:product});
}

// Canonicalize equivalent structured filters without asking the model to do money math.
export function normalizeIntent(intent: ShoppingIntent): ShoppingIntent {
  let offerType = intent.offerType;
  if (intent.benefitAmountCents !== null && (offerType === 'cashback' || offerType === 'discount')) {
    offerType = offerType === 'cashback' ? 'cashback-fixed' : 'discount-fixed';
  } else if (intent.sort === 'headline-rate' && (offerType === null || offerType === 'cashback')) {
    offerType = 'cashback-percent';
  }
  return { ...intent, offerType };
}
