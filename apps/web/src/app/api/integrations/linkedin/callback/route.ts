import {bridgeConfig,cookie,cookieName} from '../bridge';
export const runtime='nodejs';
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookie('',0)};
 try{
  const c=bridgeConfig();const url=new URL(request.url);const binding=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!binding||!/^[a-f0-9]{64}$/.test(binding)||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length>1)return Response.json({message:'Connection expired or browser state is missing. Start again.'},{status:400,headers});
  const response=await fetch(c.api+'/api/v1/integrations/linkedin/callback',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json'},body:JSON.stringify({binding,state:url.searchParams.get('state'),code:url.searchParams.get('code'),error:url.searchParams.get('error')}),cache:'no-store'});
  return new Response(null,{status:303,headers:{...headers,Location:c.origin+'/settings/linkedin?connection='+(response.ok?'connected':'failed')}});
 }catch{return Response.json({message:'Connection could not be completed. Return to LinkedIn settings and try again.'},{status:503,headers});}
}
