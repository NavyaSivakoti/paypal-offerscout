import { z } from 'zod';
import { demoIntent } from '../../../lib/intent';
import { explainRecommendation } from '../../../lib/recommend';
import { resolveCustomerStatus } from '../../../lib/customer-status';
import { interpret, ASSISTANT_PROMPT_VERSION } from '../../../lib/server/assistant';
import { AppError, readInput, errorResponse, json } from '../../../lib/server/http';
const input=z.object({prompt:z.string().trim().min(1).max(1000),newCustomer:z.boolean().nullable(),mode:z.enum(['live','demo'])}).strict();
export async function POST(request:Request):Promise<Response>{try{
 const body=await readInput(request,input);const key=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL;
 if(body.mode==='live'&&(!key||!model))throw new AppError('Live AI is not configured. Select the labeled demo mode.',503);
 const interpreted=body.mode==='live'?await interpret(body.prompt,key!,model!):demoIntent(body.prompt);
 const customer=resolveCustomerStatus(body.prompt,body.newCustomer);
 const intent={...interpreted,newCustomer:customer};
 return json({...explainRecommendation(intent,customer),intent,newCustomer:customer,mode:body.mode,model:body.mode==='live'?model:null,promptVersion:ASSISTANT_PROMPT_VERSION});
}catch(error){return errorResponse(error);}}
