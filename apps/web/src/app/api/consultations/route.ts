import { createHash } from 'node:crypto';
export const runtime = 'nodejs';
const recent = new Map<string, number>();
const attempts = new Map<string,{time:number;fingerprint:string;result:Promise<{status:number;message:string}>}>();
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ message:'JSON required.' }, {status:415});
  const raw = await request.text();
  if (raw.length > 10000) return Response.json({ message:'Request is too large.' }, {status:413});
  let body: Record<string,unknown>;
  try { body = JSON.parse(raw); } catch { return Response.json({message:'Invalid request.'},{status:400}); }
  if (!body || typeof body !== 'object') return Response.json({message:'Invalid request.'},{status:400});
  const {name,email,company,message,requestId,website,submittedAt} = body;
  if (website) return Response.json({message:'Invalid request.'},{status:400});
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof company !== 'string' || !company.trim() || /[\r\n]/.test(company) || company.length > 160 || typeof message !== 'string' || message.trim().length < 10 || message.length > 3000 || typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId) || typeof submittedAt !== 'string' || !Number.isFinite(Date.parse(submittedAt)) || Math.abs(Date.now()-Date.parse(submittedAt)) > 86400000) return Response.json({message:'Enter your name, valid email, company and at least 10 characters about your project. Refresh the page if the request has expired.'},{status:400});
  const tenant = process.env.M365_TENANT_ID; const clientId = process.env.M365_CLIENT_ID; const secret = process.env.M365_CLIENT_SECRET;
  const to = 'consult@surveyguru.ai';
  if (!tenant || !/^[a-f0-9-]{36}$/i.test(tenant) || !clientId || !secret) return Response.json({ message:`Online booking is not configured yet. Please email ${to}.` }, {status:503});
  const now=Date.now();
  for(const [id,item] of attempts)if(now-item.time>86400000)attempts.delete(id);
  const fingerprint=createHash('sha256').update(JSON.stringify([name,email,company,message,submittedAt])).digest('hex');
  const existing=attempts.get(requestId);
  if(existing){if(existing.fingerprint!==fingerprint)return Response.json({message:'This request was already used. Refresh before submitting changed details.'},{status:409});const r=await existing.result;return Response.json({message:r.message},{status:r.status});}
  for(const [id,time] of recent)if(now-time>60000)recent.delete(id);
  const client=createHash('sha256').update(email.toLowerCase()).digest('hex');
  if(recent.has(client)||recent.size>=100||attempts.size>=500)return Response.json({message:'Please wait before sending another request, or email consult@surveyguru.ai.'},{status:429});
  recent.set(client,now);
  const deliver=async()=>{
    let sending=false;
    try{
      const auth=await fetch('https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})});
      if(!auth.ok)throw new Error('Authentication failed');
      const token=await auth.json();if(typeof token.access_token!=='string'||!token.access_token)throw new Error('Token missing');
      sending=true;
      const response=await fetch('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(to)+'/sendMail',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:'Survey Guru consultation request — '+company.trim(),body:{contentType:'Text',content:'Name: '+name.trim()+'\nWork email: '+email+'\nCompany: '+company.trim()+'\nAbout project: '+message.trim()+'\n\nSubmission timestamp (UTC): '+new Date(submittedAt).toISOString()+'\nSource: https://surveyguru.ai/consultation\nRequest reference: '+requestId},toRecipients:[{emailAddress:{address:to}}],replyTo:[{emailAddress:{address:email}}]},saveToSentItems:true})});
      if(response.status!==202){sending=false;throw new Error('Mail not accepted');}
      return {status:200,message:'Your consultation request has been submitted. Our team will contact you to arrange a time.'};
    }catch{
      if(sending)return {status:502,message:'Delivery could not be confirmed. Please email consult@surveyguru.ai and quote request '+requestId+' before submitting again.'};
      recent.delete(client);attempts.delete(requestId);
      return {status:502,message:'Your request could not be sent. Please retry or email consult@surveyguru.ai directly.'};
    }
  };
  const result=deliver();attempts.set(requestId,{time:now,fingerprint,result});
  const response=await result;return Response.json({message:response.message},{status:response.status});
}
