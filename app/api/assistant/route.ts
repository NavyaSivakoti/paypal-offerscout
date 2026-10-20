import { z } from 'zod';
import { demoIntent } from '../../../lib/intent';
import { explainRecommendation } from '../../../lib/recommend';
import { interpret } from '../../../lib/server/assistant';
import { AppError, readInput, errorResponse, json } from '../../../lib/server/http';
const input=z.object({prompt:z.string().trim().min(1).max(1000),newCustomer:z.boolean().nullable(),mode:z.enum(['live','demo'])}).strict();
export async function POST(request:Request):Promise<Response>{try{
 const body=await readInput(request,input);const key=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL;
 if(body.mode==='live'&&(!key||!model))throw new AppError('Live AI is not configured. Select the labeled demo mode.',503);
 const intent=body.mode==='live'?await interpret(body.prompt,key!,model!):demoIntent(body.prompt);
 const customer=intent.newCustomer??body.newCustomer;
 return json({...explainRecommendation(intent,customer),intent,newCustomer:customer,mode:body.mode,model:body.mode==='live'?model:null,promptVersion:'offerscout-intent-v1'});
}catch(error){return errorResponse(error);}}
