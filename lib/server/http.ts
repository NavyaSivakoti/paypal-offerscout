import { z } from 'zod';
export class AppError extends Error {
 readonly status: number;
 constructor(message:string,status=400){super(message);this.status=status;}
}
export async function readInput<T>(request:Request,schema:z.ZodType<T>):Promise<T>{
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('Request must originate from this app.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('JSON input required.',415);
 if(Number(request.headers.get('content-length'))>4096)throw new AppError('Request too large.',413);
 const reader=request.body?.getReader();if(!reader)throw new AppError('Missing input.');
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new AppError('Request too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));}catch{throw new AppError('Invalid request fields.');}
}
export function errorResponse(error:unknown):Response {
 return Response.json({error:error instanceof AppError?error.message:'Service unavailable. Please retry.'},{status:error instanceof AppError?error.status:502,headers:{'Cache-Control':'no-store'}});
}
export const json=(value:unknown):Response=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
