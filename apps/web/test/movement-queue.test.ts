import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMovementQueue, SyncError, type QueuedMovement, type MovementStore } from '../src/app/field/map/movement-queue.js';
function fixture() {
  const records=new Map<string,QueuedMovement>();let online=false,owner='agent',fail=0; const sent:string[]=[];
  const store:MovementStore={async put(p){records.set(p.eventId,p);},async remove(id){records.delete(id);},async list(uid,sid){return [...records.values()].filter(p=>p.ownerId===uid&&p.sessionId===sid).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));}};
  const create=()=>createMovementQueue({store,ownerId:'agent',sessionId:'session',currentOwner:async()=>owner,online:()=>online,onStatus:()=>{},send:async p=>{sent.push(p.eventId);if(fail)throw new SyncError('failed',fail);}});
  const point=(time=Date.now())=>({timestamp:time,coords:{latitude:-26,longitude:28,accuracy:5}} as GeolocationPosition);
  return {records,sent,create,point,setOnline(v:boolean){online=v;},setOwner(v:string){owner=v;},setFailure(v:number){fail=v;}};
}
test('offline points survive queue recreation and sync oldest first',async()=>{
 const f=fixture(),q=f.create();await q.enqueue(f.point(2000));await q.enqueue(f.point(1000));await q.flush();assert.equal(f.sent.length,0);q.dispose();
 const ids=[...f.records.values()].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).map(p=>p.eventId);f.setOnline(true);await f.create().flush();assert.deepEqual(f.sent,ids);assert.equal(f.records.size,0);
});
test('lost response retries original event ID without losing following evidence',async()=>{
 const f=fixture(),q=f.create();await q.enqueue(f.point(1000));await q.enqueue(f.point(2000));await q.flush();f.setOnline(true);f.setFailure(500);await q.flush();assert.equal(f.records.size,2);const id=f.sent[0];f.setFailure(0);await q.flush();assert.equal(f.sent[1],id);assert.equal(f.records.size,0);
});
test('changing account prevents another user uploading or collecting into the first account queue',async()=>{
 const f=fixture(),q=f.create();await q.enqueue(f.point());await q.flush();f.setOnline(true);f.setOwner('other');await q.flush();assert.equal(f.sent.length,0);assert.equal(f.records.size,1);await assert.rejects(q.enqueue(f.point()));
});
test('forbidden and invalid uploads retain evidence; invalid head blocks later locations',async()=>{
 const f=fixture(),q=f.create();await q.enqueue(f.point(1000));await q.enqueue(f.point(2000));await q.flush();f.setOnline(true);f.setFailure(403);await q.flush();assert.equal(f.records.size,2);f.setFailure(422);await q.flush();const count=f.sent.length;f.setFailure(0);await q.flush();assert.equal(f.sent.length,count);assert.equal(f.records.size,2);
});
test('overlapping flush requests share one upload sequence',async()=>{
 const f=fixture(),q=f.create();await q.enqueue(f.point());await q.flush();f.setOnline(true);await Promise.all([q.flush(),q.flush(),q.flush()]);assert.equal(f.sent.length,1);
});
