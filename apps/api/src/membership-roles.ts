import type { Firestore } from 'firebase-admin/firestore';
import { AuthorisationError } from './authority.js';
export function membershipRoleKeys(membership: {get(key:string):unknown}): string[] {
 const value = membership.get('roleKeys') ?? [membership.get('roleKey')];
 if (!Array.isArray(value) || !value.length || value.length > 10 || value.some(k => typeof k !== 'string' || !k.trim() || k.includes('/'))) throw new AuthorisationError('Invalid assigned roles.');
 return [...new Set(value as string[])];
}
export async function membershipRole(firestore: Firestore, membership: {get(key:string):unknown}, reader?: (ref:any)=>Promise<any>) {
 const keys=membershipRoleKeys(membership);
 const roles=await Promise.all(keys.map(k=>{const ref=firestore.collection('roleDefinitions').doc(k);return reader?reader(ref):ref.get();}));
 if(roles.some(r=>!r.exists || (r.get('workspaceId') && r.get('workspaceId')!==membership.get('workspaceId')) || !Array.isArray(r.get('permissions')))) throw new AuthorisationError('Workspace role is not resolved.');
 const permissions=[...new Set(roles.flatMap(r=>r.get('permissions')))];
 return {exists:true,get:(key:string):any=>key==='permissions'?permissions:key==='name'?roles.map((r,i)=>r.get('name')??keys[i]).join(' + '):undefined};
}
