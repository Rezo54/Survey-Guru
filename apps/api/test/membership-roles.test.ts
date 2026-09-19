import {test} from 'node:test';
import assert from 'node:assert/strict';
import {membershipRole, membershipRoleKeys} from '../src/membership-roles.js';
const member=(data:Record<string,unknown>)=>({get:(k:string)=>data[k]});
const store=(roles:Record<string,any>)=>({collection:()=>({doc:(id:string)=>({get:async()=>({exists:!!roles[id],get:(k:string)=>roles[id]?.[k]})})})}) as never;
test('legacy roles remain compatible and duplicate selections are normalized',()=>{assert.deepEqual(membershipRoleKeys(member({roleKey:'supervisor'})),['supervisor']);assert.deepEqual(membershipRoleKeys(member({roleKey:'old',roleKeys:['supervisor','field_worker','supervisor']})),['supervisor','field_worker']);assert.throws(()=>membershipRoleKeys(member({roleKeys:[]})));});
test('supervisor and field role combine monitoring and capture without administrative escalation',async()=>{const r=await membershipRole(store({supervisor:{permissions:['project.read','supervisor.review']},field:{permissions:['project.read','field.capture']}}),member({workspaceId:'w',roleKeys:['supervisor','field']}));assert.deepEqual(r.get('permissions'),['project.read','supervisor.review','field.capture']);});
test('missing or foreign secondary role fails closed',async()=>{for(const roles of [{first:{permissions:[]}},{first:{permissions:[]},second:{workspaceId:'other',permissions:['workspace.admin']}}])await assert.rejects(()=>membershipRole(store(roles),member({workspaceId:'w',roleKeys:['first','second']})));});
