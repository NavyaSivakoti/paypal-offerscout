import { z } from 'zod';
export const intentSchema = z.object({
 intent: z.enum(['search','explain-cap','explain-minimum','tax-unknown','unsupported']),
 merchant: z.enum(['Stride Supply','Trail & Field','Everyday Athletics']).nullable(),
 category: z.enum(['Road','Trail','Walking']).nullable(),
 maximumPayableCents: z.number().int().min(0).max(10000000).nullable(),
 sort: z.enum(['effective-cost','headline-rate','payable']),
 newCustomer: z.boolean().nullable(),
 searchText: z.string().max(100).nullable(),
}).strict();
export type ShoppingIntent = z.infer<typeof intentSchema>;
export const intentJsonSchema = {
 type:'object',additionalProperties:false,
 properties:{
  intent:{type:'string',enum:['search','explain-cap','explain-minimum','tax-unknown','unsupported']},
  merchant:{type:['string','null'],enum:['Stride Supply','Trail & Field','Everyday Athletics',null]},
  category:{type:['string','null'],enum:['Road','Trail','Walking',null]},
  maximumPayableCents:{type:['integer','null'],minimum:0,maximum:10000000},
  sort:{type:'string',enum:['effective-cost','headline-rate','payable']},
  newCustomer:{type:['boolean','null']},searchText:{type:['string','null'],maxLength:100},
 },required:['intent','merchant','category','maximumPayableCents','sort','newCustomer','searchText'],
};
export function demoIntent(prompt: string): ShoppingIntent {
 const text=prompt.toLowerCase();
 const merchant=(['Stride Supply','Trail & Field','Everyday Athletics'] as const).find(m=>text.includes(m.toLowerCase()))??null;
 // Remove the merchant name before interpreting product categories (Trail & Field is not a trail request).
 const productText=merchant?text.replace(merchant.toLowerCase(),''):text;
 const product=(['Cloudstep Road Runner','Ridgeline Trail Shoe','Everyday Walking Shoe','Tempo Road Runner'] as const).find(name=>productText.includes(name.toLowerCase()))??null;
 const amount=productText.match(/(?:under|below|budget(?: of)?|up to)\s*\$?\s*(\d+(?:\.\d{1,2})?)/);
 const kind=/tax/.test(text)?'tax-unknown':/shipping.*(?:minimum|count)|minimum.*shipping/.test(text)?'explain-minimum':/why.*15|15.*10|explain.*cap/.test(text)?'explain-cap':/laptop|phone|jacket|macy|ignore.*(?:cap|rules)|earned/.test(text)?'unsupported':merchant||/shoe|running|walking|trail|road|offer|cashback|deal/.test(text)?'search':'unsupported';
 return intentSchema.parse({intent:kind,merchant,category:/trail/.test(productText)?'Trail':/walking/.test(productText)?'Walking':/running|road/.test(productText)?'Road':null,maximumPayableCents:amount?Math.round(Number(amount[1])*100):null,sort:/highest.*(?:cashback|percent|rate)/.test(text)?'headline-rate':/lowest.*price|cheapest.*today/.test(text)?'payable':'effective-cost',newCustomer:/returning customer/.test(text)?false:/i am a new customer/.test(text)?true:null,searchText:product});
}
