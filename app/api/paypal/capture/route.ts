import { z } from 'zod';
import { config,paypalClient,verifyBinding,assertOrder,receipt } from '../../../../lib/server/paypal';
import { AppError,readInput,errorResponse,json } from '../../../../lib/server/http';
const input=z.object({orderId:z.string().regex(/^[A-Z0-9]{5,32}$/)}).strict();
export async function POST(request:Request):Promise<Response>{try{
 const body=await readInput(request,input);const settings=config();
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('offerscout_checkout='))?.slice('offerscout_checkout='.length)??'';
 const binding=await verifyBinding(cookie,settings.clientSecret);if(binding.orderId!==body.orderId)throw new AppError('Order belongs to a different checkout session.',403);
 const client=paypalClient(settings);let order=await client.get(body.orderId);assertOrder(order,binding.offerId);
 if(order.status!=='COMPLETED'){if(order.status!=='APPROVED')throw new AppError('Approve the order in PayPal sandbox before completing payment.',409);order=await client.capture(body.orderId);}
 return json(receipt(order,binding.offerId));
}catch(error){return errorResponse(error);}}
