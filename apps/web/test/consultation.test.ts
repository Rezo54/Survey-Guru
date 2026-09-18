import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/consultations/route.js';
const input={name:'Test',email:'local@example.test',company:'Example',message:'A local consultation test.',requestId:'11111111-1111-4111-8111-111111111111'};
function request(body:unknown){return new Request('https://example.test/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('invalid requests are rejected and missing delivery configuration is not reported as sent',async()=>{
 delete process.env.RESEND_API_KEY;delete process.env.SURVEY_GURU_CONSULTATION_FROM;
 assert.equal((await POST(request({...input,email:'invalid'}))).status,400);
 assert.equal((await POST(request(input))).status,503);
});
test('recipient is server configured, user email is reply-to, and provider retries have an idempotency key',async()=>{
 const original=globalThis.fetch;
 process.env.RESEND_API_KEY='test-only';process.env.SURVEY_GURU_CONSULTATION_FROM='verified@example.test';process.env.SURVEY_GURU_CONSULTATION_TO='admin@taskraft.org';
 let sent:any;let headers:any;
 globalThis.fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));headers=init?.headers;return Response.json({id:'test-only'});};
 try{assert.equal((await POST(request({...input,to:'attacker@example.test'}))).status,200);assert.deepEqual(sent.to,['admin@taskraft.org']);assert.equal(sent.reply_to,input.email);assert.equal(headers['Idempotency-Key'],'consultation-'+input.requestId);assert.equal((await POST(request(input))).status,429);}
 finally{globalThis.fetch=original;delete process.env.RESEND_API_KEY;delete process.env.SURVEY_GURU_CONSULTATION_FROM;delete process.env.SURVEY_GURU_CONSULTATION_TO;}
});
test('provider failure is not reported as a successful consultation',async()=>{
 const original=globalThis.fetch;process.env.RESEND_API_KEY='test-only';process.env.SURVEY_GURU_CONSULTATION_FROM='verified@example.test';
 globalThis.fetch=async()=>new Response('Unavailable',{status:500});
 try{assert.equal((await POST(request({...input,email:'retry@example.test'}))).status,502);}
 finally{globalThis.fetch=original;delete process.env.RESEND_API_KEY;delete process.env.SURVEY_GURU_CONSULTATION_FROM;}
});
