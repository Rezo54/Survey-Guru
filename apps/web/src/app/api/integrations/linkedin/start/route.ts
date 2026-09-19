import {randomBytes} from 'node:crypto';
import {bridgeConfig,cookie} from '../bridge';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const c=bridgeConfig();if(request.headers.get('origin')!==c.origin)return Response.json({message:'Origin is not allowed.'},{status:403});
  const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return Response.json({message:'Sign in as a workspace administrator.'},{status:401});
  const binding=randomBytes(32).toString('hex');
  const result=await fetch(c.api+'/api/v1/integrations/linkedin/start',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({binding}),cache:'no-store'});
  if(!result.ok)return Response.json({message:'LinkedIn connection is unavailable. Check administrator access and granted-scope configuration.'},{status:result.status});
  const body=await result.json();const url=new URL(body.authorizationUrl);if(url.origin!=='https://www.linkedin.com'||url.pathname!=='/oauth/v2/authorization')throw new Error('Invalid authorization URL');
  return Response.json({authorizationUrl:url.toString()},{headers:{'Set-Cookie':cookie(binding,600),'Cache-Control':'no-store'}});
 }catch{return Response.json({message:'LinkedIn connection could not start.'},{status:503});}
}
