import { z } from 'zod';
import { offers, evaluate } from '../offers.ts';
import { receiptSchema, type PaymentReceipt } from '../receipt.ts';
import { AppError } from './http.ts';
const BASE='https://api-m.sandbox.paypal.com';
const amountSchema=z.object({currency_code:z.literal('USD'),value:z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/)});
export const orderSchema=z.object({id:z.string(),status:z.string(),purchase_units:z.array(z.object({custom_id:z.string(),amount:amountSchema,payments:z.object({captures:z.array(z.object({id:z.string(),status:z.string(),amount:amountSchema}))}).optional()})),links:z.array(z.object({href:z.string(),rel:z.string()})).optional()});
export type SandboxOrder=z.infer<typeof orderSchema>;
export interface PaypalConfig {clientId:string;clientSecret:string;origin:string;}
export function config():PaypalConfig {
 const clientId=process.env.PAYPAL_CLIENT_ID,clientSecret=process.env.PAYPAL_CLIENT_SECRET,origin=process.env.APP_ORIGIN;
 if(!clientId||!clientSecret||!origin)throw new AppError('PayPal sandbox is not configured yet.',503);
 const url=new URL(origin);if(url.protocol!=='https:'&&url.hostname!=='localhost')throw new AppError('Invalid app origin configuration.',503);
 return {clientId,clientSecret,origin:url.origin};
}
export function orderBody(offerId:string,origin:string):object {
 const offer=offers.find(o=>o.id===offerId);if(!offer)throw new AppError('Unknown sample offer.',404);
 const value=evaluate(offer,null);
 if(value.payable<=0)throw new AppError('This sample has no payable amount.',409);
 return {intent:'CAPTURE',purchase_units:[{custom_id:offer.id,description:`OfferScout fictional demo: ${offer.product}`,amount:{currency_code:'USD',value:(evaluate(offer,null).payable/100).toFixed(2),breakdown:{item_total:{currency_code:'USD',value:((offer.price-value.discount)/100).toFixed(2)},shipping:{currency_code:'USD',value:(offer.shipping/100).toFixed(2)}}},items:[{name:offer.product,quantity:'1',unit_amount:{currency_code:'USD',value:((offer.price-value.discount)/100).toFixed(2)}}]}],payment_source:{paypal:{experience_context:{brand_name:'OfferScout Sandbox Demo',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',return_url:`${origin}/checkout`,cancel_url:`${origin}/checkout?cancelled=1`}}}};
}
export function assertOrder(order:SandboxOrder,offerId:string):void {
 const offer=offers.find(o=>o.id===offerId);const unit=order.purchase_units[0];
 if(!offer||order.purchase_units.length!==1||unit.custom_id!==offer.id||unit.amount.currency_code!=='USD'||unit.amount.value!==(evaluate(offer,null).payable/100).toFixed(2))throw new AppError('Order does not match the selected sample offer.',409);
}
export function receipt(order:SandboxOrder,offerId:string,newCustomer:boolean|null=null):PaymentReceipt {
 assertOrder(order,offerId);const captures=order.purchase_units[0].payments?.captures;
 if(!order.id||order.status!=='COMPLETED'||captures?.length!==1||!captures[0].id||captures[0].status!=='COMPLETED'||captures[0].amount.currency_code!=='USD'||captures[0].amount.value!==order.purchase_units[0].amount.value)throw new AppError('Payment is not confirmed complete. Check the sandbox account before retrying.',409);
 const offer=offers.find(o=>o.id===offerId)!;const value=evaluate(offer,newCustomer);
 // Payable discounts never depend on client customer status in the current catalog.
 if(value.payable!==evaluate(offer,null).payable)throw new AppError('Checkout eligibility changed. Start checkout again.',409);
 return receiptSchema.parse({orderId:order.id,captureId:captures[0].id,paidCents:value.payable,status:'COMPLETED',sandbox:true,
  offerId:offer.id,merchant:offer.merchant,product:offer.product,merchandiseCents:offer.price,shippingCents:offer.shipping,
  instantDiscountCents:value.discount,estimatedCashbackCents:value.reward,estimatedEffectiveCents:value.effective,
  eligibilityMet:value.eligible,eligibilityReason:value.reason,customerStatus:newCustomer===null?'unknown':newCustomer?'self-declared-new':'returning',
  estimateAsOf:'2026-10-17',rewardsAreSimulated:true});
}
export function approvalUrl(order:SandboxOrder):string {
 const href=order.links?.find(l=>l.rel==='payer-action'||l.rel==='approve')?.href;
 if(!href)throw new AppError('PayPal did not return an approval link.',502);
 const url=new URL(href);if(url.protocol!=='https:'||url.hostname!=='www.sandbox.paypal.com')throw new AppError('Unexpected PayPal approval destination.',502);
 return url.href;
}
export function paypalClient(settings:PaypalConfig,fetcher:typeof fetch=fetch){
 async function request(path:string,method:'GET'|'POST',requestId?:string,body?:object):Promise<SandboxOrder>{
  const auth=await fetcher(`${BASE}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${settings.clientId}:${settings.clientSecret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  if(!auth.ok)throw new AppError('PayPal sandbox credentials could not be verified.',502);
  const token=z.object({access_token:z.string().min(1)}).parse(await auth.json());
  const response=await fetcher(`${BASE}${path}`,{method,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json',Prefer:'return=representation',...(requestId?{'PayPal-Request-Id':requestId}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new AppError('PayPal could not complete this step. Retry the same checkout or check your sandbox account.',502);
  return orderSchema.parse(await response.json());
 }
 return {create:(offerId:string,id:string)=>request('/v2/checkout/orders','POST',id,orderBody(offerId,settings.origin)),get:(id:string)=>request(`/v2/checkout/orders/${encodeURIComponent(id)}`,'GET'),capture:(id:string)=>request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,'POST',`capture-${id}`,{})};
}
// Signed, HttpOnly checkout binding prevents capture of an arbitrary order from another browser.
const bindingSchema=z.object({orderId:z.string().regex(/^[A-Z0-9]{5,32}$/),offerId:z.string(),newCustomer:z.boolean().nullable().optional(),expires:z.number().int()}).strict();
export type CheckoutBinding=z.infer<typeof bindingSchema>;
async function signingKey(secret:string):Promise<CryptoKey>{return crypto.subtle.importKey('raw',new TextEncoder().encode(`offerscout-checkout-v1:${secret}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signBinding(binding:CheckoutBinding,secret:string):Promise<string>{const body=btoa(JSON.stringify(binding));const sig=await crypto.subtle.sign('HMAC',await signingKey(secret),new TextEncoder().encode(body));return `${body}.${Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,'0')).join('')}`;}
export async function verifyBinding(value:string,secret:string,now=Date.now()):Promise<CheckoutBinding>{
 try{const [body,signature,...rest]=value.split('.');if(rest.length||!body||!/^[a-f0-9]{64}$/.test(signature))throw new Error();const bytes=Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',await signingKey(secret),bytes,new TextEncoder().encode(body)))throw new Error();
 const binding=bindingSchema.parse(JSON.parse(atob(body)));if(binding.expires<=now)throw new Error();return binding;
 }catch{throw new AppError('Checkout session is missing, expired, or invalid. Start checkout again.',403);}
}

export type CheckoutClient = Pick<ReturnType<typeof paypalClient>, 'get' | 'capture'>;
/** Only a verified, completed capture can produce a receipt or reward estimate. */
export async function completeCheckout(client:CheckoutClient,binding:CheckoutBinding):Promise<PaymentReceipt> {
 let order=await client.get(binding.orderId);
 if(order.id!==binding.orderId)throw new AppError('PayPal returned a different order.',409);
 assertOrder(order,binding.offerId);
 if(order.status!=='COMPLETED'){
  if(order.status!=='APPROVED')throw new AppError('Approve the order in PayPal sandbox before completing payment.',409);
  order=await client.capture(binding.orderId);
  if(order.id!==binding.orderId)throw new AppError('PayPal returned a different order.',409);
 }
 return receipt(order,binding.offerId,binding.newCustomer??null);
}
