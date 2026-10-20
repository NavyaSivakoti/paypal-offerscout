import { z } from 'zod';
import { config,paypalClient,approvalUrl,signBinding } from '../../../../lib/server/paypal';
import { readInput,errorResponse } from '../../../../lib/server/http';
const input=z.object({offerId:z.string().max(40),requestId:z.string().uuid()}).strict();
export async function POST(request:Request):Promise<Response>{try{
 const body=await readInput(request,input);const settings=config();
 // Namespace retry IDs by offer, so a changed cart cannot reuse another cart's order.
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${body.offerId}:${body.requestId}`));
 const id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
 const order=await paypalClient(settings).create(body.offerId,id);const url=approvalUrl(order);
 const binding=await signBinding({orderId:order.id,offerId:body.offerId,expires:Date.now()+3600000},settings.clientSecret);
 return Response.json({orderId:order.id,approvalUrl:url},{headers:{'Cache-Control':'no-store','Set-Cookie':`offerscout_checkout=${binding}; HttpOnly; SameSite=Lax; Path=/api/paypal; Max-Age=3600${settings.origin.startsWith('https:')?'; Secure':''}`}});
}catch(error){return errorResponse(error);}}
