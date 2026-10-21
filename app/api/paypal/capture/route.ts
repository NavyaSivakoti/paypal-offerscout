import { z } from 'zod';
import { config,paypalClient,verifyBinding,completeCheckout } from '../../../../lib/server/paypal';
import { AppError,readInput,errorResponse,json } from '../../../../lib/server/http';
const input=z.object({orderId:z.string().regex(/^[A-Z0-9]{5,32}$/)}).strict();
export async function POST(request:Request):Promise<Response>{try{
 const body=await readInput(request,input);const settings=config();
 const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('offerscout_checkout='))?.slice('offerscout_checkout='.length)??'';
 const binding=await verifyBinding(cookie,settings.clientSecret);if(binding.orderId!==body.orderId)throw new AppError('Order belongs to a different checkout session.',403);
 return json(await completeCheckout(paypalClient(settings),binding));
}catch(error){return errorResponse(error);}}
