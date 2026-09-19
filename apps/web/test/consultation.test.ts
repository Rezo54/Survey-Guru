import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {POST} from '../src/app/api/consultations/route.js';
const make=()=>({name:'Test Visitor',email:randomUUID()+'@example.test',company:'Example Co',message:'Survey our retail outlets.',requestId:randomUUID(),submittedAt:new Date().toISOString()});
const req=(body:unknown)=>new Request('https://surveyguru.ai/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function configure(){process.env.MICROSOFT_TENANT_ID='11111111-1111-4111-8111-111111111111';process.env.MICROSOFT_CLIENT_ID='test-client';process.env.MICROSOFT_CLIENT_SECRET='secret-test-only';}
function clear(){delete process.env.MICROSOFT_TENANT_ID;delete process.env.MICROSOFT_CLIENT_ID;delete process.env.MICROSOFT_CLIENT_SECRET;}
test('invalid fields, honeypot, header injection and missing configuration fail closed',async()=>{
 clear();const input=make();for(const patch of [{email:'invalid'},{company:''},{company:'A\r\nB'},{name:''},{message:'short'},{website:'bot'},{submittedAt:'bad'},{requestId:'bad'}])assert.equal((await POST(req({...input,...patch}))).status,400);
 assert.equal((await POST(req(input))).status,503);
 assert.equal((await POST(new Request('https://surveyguru.ai/api/consultations',{method:'POST',body:'{}'}))).status,415);
 assert.equal((await POST(new Request('https://surveyguru.ai/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(10001)}))).status,413);
});
test('Graph delivery fixes mailbox, sets reply-to and includes project details; duplicate does not resend',async()=>{
 configure();const old=fetch;const calls:{url:string;init:RequestInit|undefined}[]=[];globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return String(url).includes('/token')?Response.json({access_token:'private-token'}):new Response(null,{status:202});};
 try{const input=make();const body={...input,to:'attacker@example.test',from:'attacker@example.test',source:'https://attacker.test'};assert.equal((await POST(req(body))).status,200);assert.equal((await POST(req(body))).status,200);assert.equal(calls.length,2);const mail=JSON.parse(String(calls[1]!.init?.body));assert.ok(calls[1]!.url.includes('consult%40surveyguru.ai'));assert.deepEqual(mail.message.toRecipients,[{emailAddress:{address:'consult@surveyguru.ai'}}]);assert.equal(mail.message.replyTo[0].emailAddress.address,input.email);assert.equal(mail.message.subject,'Survey Guru consultation request — Example Co');for(const value of [input.name,input.email,input.company,input.message,input.submittedAt,'https://surveyguru.ai/consultation'])assert.ok(mail.message.body.content.includes(value));assert.equal((await POST(req({...body,company:'Changed'}))).status,409);assert.equal((await POST(req({...make(),email:input.email}))).status,429);}
 finally{globalThis.fetch=old;clear();}
});
test('token failure, provider rejection and ambiguous timeout never report success or expose secrets',async()=>{
 configure();const old=fetch;
 try{for(const mode of ['token','reject','timeout']){let calls=0;globalThis.fetch=async(url)=>{calls++;if(String(url).includes('/token'))return mode==='token'?new Response('private-details',{status:401}):Response.json({access_token:'private-token'});if(mode==='timeout')throw new Error('secret-test-only');return new Response('private-details',{status:403});};const input=make();const response=await POST(req(input));assert.equal(response.status,502);const text=await response.text();assert.ok(!text.includes('private-details')&&!text.includes('secret-test-only'));if(mode==='timeout'){assert.equal((await POST(req(input))).status,502);assert.equal(calls,2);}}}
 finally{globalThis.fetch=old;clear();}
});

test('simultaneous identical submissions share one Graph send',async()=>{
 configure();const old=fetch;let sends=0;let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 globalThis.fetch=async(url)=>{if(String(url).includes('/token')){await gate;return Response.json({access_token:'test-token'});}sends++;return new Response(null,{status:202});};
 try{const input=make();const first=POST(req(input));const second=POST(req(input));release();const responses=await Promise.all([first,second]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(sends,1);}
 finally{globalThis.fetch=old;clear();}
});
