import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerOperationsRoutes } from '../src/operations-routes.js';
import { AuthorisationError, type SurveyGuruPermission } from '../src/authority.js';
function setup(permissions: SurveyGuruPermission[]) {
  const documents = new Map<string, Record<string,unknown>>([
    ['assignments/a',{workspaceId:'ws',projectId:'p',assignedUserId:'agent',status:'active',areaId:'area'}],
    ['searchSessions/s',{workspaceId:'ws',assignmentId:'a',state:'ACTIVE_SEARCH'}],
    ['projectMemberships/prjm_p_agent',{workspaceId:'ws',projectId:'p',userId:'agent',status:'active'}],
    ['projectAreas/area',{workspaceId:'ws',projectId:'p',name:'Area',supervisorIds:['super'],reviewState:'IN_FIELD'}],
  ]);
  let next=0;
  function snapshot(path:string) {return {id:path.split('/').at(-1)!,exists:documents.has(path),get:(k:string)=>documents.get(path)?.[k],data:()=>documents.get(path),ref:reference(path)};}
  function reference(path:string) {return {path,id:path.split('/').at(-1)!,get:async()=>snapshot(path)};}
  function query(name:string,filters:[string,unknown][]=[]):any {return {doc:(id:string)=>reference(name+'/'+(id??`new${next++}`)),where:(key:string,_op:string,value:unknown)=>query(name,[...filters,[key,value]]),get:async()=>{const docs=[...documents.keys()].filter(p=>p.startsWith(name+'/')&&filters.every(([k,v])=>documents.get(p)?.[k]===v)).map(snapshot);return {docs,empty:!docs.length};}};}
  const firestore={collection:query,runTransaction:async(fn:any)=>{
    const writes:(()=>void)[]=[];const tx={get:async(ref:any)=>ref.path?snapshot(ref.path):ref.get(),update:(ref:any,value:any)=>writes.push(()=>documents.set(ref.path,{...documents.get(ref.path),...value})),set:(ref:any,value:any)=>writes.push(()=>documents.set(ref.path,{...documents.get(ref.path),...value})),create:(ref:any,value:any)=>writes.push(()=>documents.set(ref.path,value))};
    const result=await fn(tx);writes.forEach(fn=>fn());return result;
  }};
  const identity={uid:'super'};const authority={identity,workspaceId:'ws',membershipId:'m',roleKey:'role',permissions:new Set(permissions),projectIds:new Set(['p']),assignmentIds:new Set<string>()};
  const app=Fastify();app.setErrorHandler((error,_,reply)=>reply.code(error instanceof AuthorisationError?403:400).send({message:error.message}));
  registerOperationsRoutes(app,async()=>({identity,authority,firestore,auth:{}} as never));
  return {app,documents};
}
test('direct operations and unassign API calls deny a field role',async()=>{
 const {app,documents}=setup(['field.capture','project.read']);
 assert.equal((await app.inject({method:'GET',url:'/api/v1/operations'})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/api/v1/operations/assignments/a/unassign'})).statusCode,403);
 assert.equal(documents.get('assignments/a')?.status,'active');await app.close();
});
test('unassign closes sessions, preserves records and removes last project access',async()=>{
 const {app,documents}=setup(['workspace.admin']);
 const response=await app.inject({method:'POST',url:'/api/v1/operations/assignments/a/unassign'});
 assert.equal(response.statusCode,200,response.body);assert.equal(documents.get('assignments/a')?.status,'inactive');assert.equal(documents.get('searchSessions/s')?.state,'CLOSED');assert.equal(documents.get('projectMemberships/prjm_p_agent')?.status,'inactive');assert.equal(documents.get('assignments/a')?.unassignedBy,'super');await app.close();
});
test('unassign keeps project membership if another active assignment remains',async()=>{
 const {app,documents}=setup(['workspace.admin']);documents.set('assignments/b',{workspaceId:'ws',projectId:'p',assignedUserId:'agent',status:'active'});
 await app.inject({method:'POST',url:'/api/v1/operations/assignments/a/unassign'});assert.equal(documents.get('projectMemberships/prjm_p_agent')?.status,'active');await app.close();
});
test('cross-workspace assignment cannot be changed even by a workspace administrator',async()=>{
 const {app,documents}=setup(['workspace.admin']);documents.get('assignments/a')!.workspaceId='elsewhere';
 assert.equal((await app.inject({method:'POST',url:'/api/v1/operations/assignments/a/unassign'})).statusCode,403);assert.equal(documents.get('assignments/a')?.status,'active');await app.close();
});
test('assigned supervisor can submit but cannot accept own area',async()=>{
 const {app,documents}=setup(['supervisor.review','qa.review']);
 let response=await app.inject({method:'POST',url:'/api/v1/operations/areas/area/review',payload:{decision:'SUBMIT',note:'All assigned streets checked.'}});
 assert.equal(response.statusCode,200,response.body);assert.equal(documents.get('projectAreas/area')?.reviewState,'SUBMITTED');
 response=await app.inject({method:'POST',url:'/api/v1/operations/areas/area/review',payload:{decision:'ACCEPT',note:'Reviewed evidence.'}});assert.equal(response.statusCode,403);assert.equal(documents.get('projectAreas/area')?.reviewState,'SUBMITTED');await app.close();
});
test('supervisor cannot submit another supervisor area',async()=>{
 const {app,documents}=setup(['supervisor.review']);documents.get('projectAreas/area')!.supervisorIds=['other'];
 assert.equal((await app.inject({method:'POST',url:'/api/v1/operations/areas/area/review',payload:{decision:'SUBMIT',note:'Submission'}})).statusCode,403);await app.close();
});
test('custom role creation cannot grant platform administrator privilege',async()=>{
 const {app}=setup(['platform.admin']);const result=await app.inject({method:'POST',url:'/api/v1/admin/roles',payload:{name:'Escalation',permissions:['platform.admin']}});assert.equal(result.statusCode,400);await app.close();
});
