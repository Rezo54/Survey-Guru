import { test } from 'node:test';
import assert from 'node:assert/strict';
import { persistStoreReferral } from '../src/store-review-referral.js';
function fixture(status='SYNCED') {
 const data:Record<string,unknown>={status,workspaceId:'ws',projectId:'p'};const events:unknown[]=[];const ref={id:'store'};
 const firestore={collection:()=>({doc:()=>({id:'event'})}),runTransaction:async(fn:any)=>{const writes:(()=>void)[]=[];await fn({get:async()=>({id:'store',ref,exists:true,get:(key:string)=>data[key]}),update:(_:unknown,change:object)=>writes.push(()=>Object.assign(data,change)),create:(_:unknown,event:unknown)=>writes.push(()=>events.push(event))});writes.forEach(write=>write());}};
 return {data,events,run:(workspaceId='ws')=>persistStoreReferral(firestore as never,ref as never,{workspaceId,actorId:'supervisor',reason:'Store photo is incorrect.',now:'2026-09-18T10:00:00Z'})};
}
test('referral persists QA state and reason while retaining accepted map status',async()=>{const f=fixture();await f.run();assert.equal(f.data.status,'SYNCED');assert.equal(f.data.qaReviewRequested,true);assert.equal(f.data.qaReviewReason,'Store photo is incorrect.');assert.equal(f.events.length,1);await f.run();assert.equal(f.events.length,1);});
test('referral cannot restore a rejected store or change another workspace',async()=>{const rejected=fixture('REJECTED');await assert.rejects(rejected.run());assert.equal(rejected.data.qaReviewRequested,undefined);const foreign=fixture();await assert.rejects(foreign.run('other'));assert.equal(foreign.events.length,0);});
