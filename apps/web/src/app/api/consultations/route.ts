import { createHash } from 'node:crypto';
export const runtime = 'nodejs';
const recent = new Map<string, number>();
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ message:'JSON required.' }, {status:415});
  const raw = await request.text();
  if (raw.length > 10000) return Response.json({ message:'Request is too large.' }, {status:413});
  let body: Record<string,unknown>;
  try { body = JSON.parse(raw); } catch { return Response.json({message:'Invalid request.'},{status:400}); }
  if (!body || typeof body !== 'object') return Response.json({message:'Invalid request.'},{status:400});
  const {name,email,company,message,requestId,website} = body;
  if (website) return Response.json({message:'Invalid request.'},{status:400});
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof company !== 'string' || company.length > 160 || typeof message !== 'string' || message.trim().length < 10 || message.length > 3000 || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) return Response.json({message:'Enter your name, valid email and at least 10 characters about your project.'},{status:400});
  const key = process.env.RESEND_API_KEY; const from = process.env.SURVEY_GURU_CONSULTATION_FROM;
  const to = process.env.SURVEY_GURU_CONSULTATION_TO ?? 'admin@taskraft.org';
  if (!key || !from) return Response.json({ message:`Online booking is not configured yet. Please email ${to}.` }, {status:503});
  const now = Date.now(); for (const [id,time] of recent) if (now - time > 60000) recent.delete(id);
  const client = createHash('sha256').update(email.toLowerCase()).digest('hex');
  if (recent.has(client) || recent.size >= 100) return Response.json({message:'Please wait a minute before sending another request.'},{status:429});
  recent.set(client,now);
  try {
    const response = await fetch('https://api.resend.com/emails', { method:'POST', signal:AbortSignal.timeout(15000),
      headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json', 'Idempotency-Key':`consultation-${requestId}` },
      body:JSON.stringify({ from, to:[to], reply_to:email, subject:'Survey Guru consultation request', text:`Name: ${name.trim()}\nEmail: ${email}\nCompany: ${company.trim()}\n\n${message.trim()}` }) });
    if (!response.ok) throw new Error('Email provider did not accept the message.');
    return Response.json({message:'Your consultation request has been sent. Our team will contact you to arrange a time.'});
  } catch { recent.delete(client); return Response.json({message:'Delivery could not be confirmed. Please retry or email admin@taskraft.org directly.'},{status:502}); }
}
