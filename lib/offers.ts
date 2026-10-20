export type Merchant = 'Stride Supply' | 'Trail & Field' | 'Everyday Athletics';
export interface Offer { id: string; merchant: Merchant; product: string; category: 'Road' | 'Trail' | 'Walking'; price: number; shipping: number; rate: number; cap: number | null; minimum: number; newCustomerOnly: boolean; expires: string; color: string; terms: string; }
export interface Evaluation { subtotal: number; payable: number; reward: number; effective: number; eligible: boolean; reason: string; }
const merchants: Merchant[] = ['Stride Supply', 'Trail & Field', 'Everyday Athletics'];
const products = ['Cloudstep Road Runner', 'Ridgeline Trail Shoe', 'Everyday Walking Shoe', 'Tempo Road Runner'];
export const offers: Offer[] = merchants.flatMap((merchant, m) => products.map((product, p) => ({id:`offer-${m}-${p}`,merchant,product,category:p===1?'Trail':p===2?'Walking':'Road',price:[11000,10800,9900][m]+p*800,shipping:m===0?0:m===1?0:700,rate:[15,10,8][m],cap:m===0?500:null,minimum:p===3?15000:0,newCustomerOnly:m===2&&p===1,expires:'2026-11-30',color:['#dce8c9','#ead9cc','#d7e3f0'][m],terms:`${[15,10,8][m]}% estimated rewards on eligible merchandise subtotal, excluding shipping and tax.${m===0?' Maximum reward $5 per order.':''}${p===3?' Minimum merchandise spend $150.':''}${m===2&&p===1?' New customers only.':''} Activate before purchase. Sample offer expires November 30, 2026. No real rewards are issued.`})));
export function evaluate(offer: Offer, newCustomer: boolean | null, now = '2026-10-17'): Evaluation {
 const eligible = now<=offer.expires && offer.price>=offer.minimum && (!offer.newCustomerOnly||newCustomer===true);
 const reason = now>offer.expires?'Offer expired':offer.price<offer.minimum?'Minimum spend not met':offer.newCustomerOnly&&newCustomer===null?'New-customer eligibility unverified':offer.newCustomerOnly&&!newCustomer?'New customers only':'Meets the sample offer conditions';
 const reward=eligible?Math.min(Math.round(offer.price*offer.rate/100),offer.cap??Number.MAX_SAFE_INTEGER):0;
 return {subtotal:offer.price,payable:offer.price+offer.shipping,reward,effective:offer.price+offer.shipping-reward,eligible,reason};
}
export const money = (cents: number): string => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
