import type {FastifyInstance} from 'fastify';
import {verifyRequestIdentity} from './auth.js';
import {resolveAuthority,requirePermission,AuthorisationError} from './authority.js';
import {getFirebaseAdminServices} from './firebase-admin.js';
import {linkedinConfig,LinkedInError,nonce,hash,encryptToken,tokenExpiry,connectionState,workflow} from './linkedin.js';
async function context(request:Parameters<typeof verifyRequestIdentity>[0]){const identity=await verifyRequestIdentity(request);const authority=await resolveAuthority(identity);return {identity,authority,firestore:getFirebaseAdminServices().firestore};}
export function registerLinkedInRoutes(app:FastifyInstance,load=context,services=getFirebaseAdminServices,recheck=resolveAuthority){
 const base='/api/v1/integrations/linkedin';
 const admin=async(request:Parameters<typeof context>[0])=>{const c=await load(request);requirePermission(c.authority,'workspace.admin');return c;};
 const environment=()=>{const e=process.env.LINKEDIN_ENV;if(e!=='development'&&e!=='production')throw new LinkedInError(503,'LinkedIn environment is not configured.');return e;};
 const id=(workspace:string)=>hash(workspace+':'+environment());
 app.get(base,async(request,reply)=>{reply.header('Cache-Control','no-store');const {authority,firestore}=await admin(request);const doc=await firestore.collection('linkedinConnections').doc(id(authority.workspaceId)).get();let configured=true;try{linkedinConfig();}catch{configured=false;}const drafts=await firestore.collection('linkedinDrafts').where('workspaceId','==',authority.workspaceId).where('environment','==',environment()).limit(50).get();return {configured,status:connectionState(doc.get('expiresAt')),expiresAt:doc.get('expiresAt')??null,page:doc.get('page')??null,publishingEnabled:false,drafts:drafts.docs.map(d=>({id:d.id,text:d.get('text'),status:d.get('status'),createdAt:d.get('createdAt')}))};});
 app.post<{Body:{binding?:unknown}}>(base+'/start',async(request,reply)=>{
  reply.header('Cache-Control','no-store');const {identity,authority,firestore}=await admin(request);const c=linkedinConfig();const binding=request.body?.binding;if(typeof binding!=='string'||! /^[a-f0-9]{64}$/.test(binding))throw new LinkedInError(400,'Invalid browser binding.');
  const state=nonce();
  await firestore.collection('linkedinOAuthStates').doc(id(authority.workspaceId)).set({stateHash:hash(state),bindingHash:hash(binding),workspaceId:authority.workspaceId,userId:identity.uid,environment:c.environment,redirectUri:c.redirectUri,expiresAt:Date.now()+600000,consumed:false});
  const params=new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:c.redirectUri,state:id(authority.workspaceId)+'.'+state,scope:c.scopes.join(' ')});
  return {authorizationUrl:'https://www.linkedin.com/oauth/v2/authorization?'+params};
 });
 app.post<{Body:{state?:unknown;binding?:unknown;code?:unknown;error?:unknown}}>(base+'/callback',async(request,reply)=>{
  reply.header('Cache-Control','no-store');const c=linkedinConfig();const {state,binding,code,error}=request.body??{};
  if(typeof state!=='string'||! /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(state)||typeof binding!=='string'||! /^[a-f0-9]{64}$/.test(binding))throw new LinkedInError(400,'Invalid or missing OAuth state.');
  const firestore=services().firestore;const ref=firestore.collection('linkedinOAuthStates').doc(state.split('.')[0]!);
  const pending=await firestore.runTransaction(async tx=>{const doc=await tx.get(ref);const d=doc.data();if(!d||d.consumed||d.expiresAt<=Date.now()||d.environment!==c.environment||d.redirectUri!==c.redirectUri||d.stateHash!==hash(state.split('.')[1]!)||d.bindingHash!==hash(binding))throw new LinkedInError(400,'OAuth state expired, mismatched or already used.');tx.update(ref,{consumed:true});return d;});
  const authority=await recheck({uid:pending.userId});requirePermission(authority,'workspace.admin');if(authority.workspaceId!==pending.workspaceId)throw new AuthorisationError('Workspace membership changed.');
  if(error)throw new LinkedInError(400,'LinkedIn consent was declined.');
  if(typeof code!=='string'||!code||code.length>4096)throw new LinkedInError(400,'Missing authorization code.');
  try{
   const response=await fetch('https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri})});
   if(!response.ok)throw new Error('exchange');const token=await response.json();if(typeof token.access_token!=='string'||!token.access_token)throw new Error('token');
   const expiresAt=tokenExpiry(token.expires_in);const connectionId=id(authority.workspaceId);
   // A disconnect/new start during exchange invalidates this completion too.
   await firestore.runTransaction(async tx=>{const latest=await tx.get(ref);if(!latest.exists||latest.get('stateHash')!==pending.stateHash)throw new Error('cancelled');tx.set(firestore.collection('linkedinConnections').doc(connectionId),{workspaceId:authority.workspaceId,environment:c.environment,connectedBy:pending.userId,connectedAt:Date.now(),expiresAt,requestedScopes:c.scopes,grantedScopes:typeof token.scope==='string'?token.scope.split(/\s+/):[],page:null,token:encryptToken(token.access_token,c.key,connectionId)});tx.delete(ref);});
   return {connected:true};
  }catch{throw new LinkedInError(502,'LinkedIn connection failed. Start a new connection attempt.');}
 });
 app.post(base+'/disconnect',async request=>{const {authority,firestore}=await admin(request);const batch=firestore.batch();batch.delete(firestore.collection('linkedinConnections').doc(id(authority.workspaceId)));batch.delete(firestore.collection('linkedinOAuthStates').doc(id(authority.workspaceId)));await batch.commit();return {disconnected:true};});
 app.post<{Body:{organisationId?:unknown;name?:unknown}}>(base+'/page',async request=>{const {authority,firestore}=await admin(request);const {organisationId,name}=request.body??{};if(typeof organisationId!=='string'||! /^\d{1,30}$/.test(organisationId)||typeof name!=='string'||!name.trim()||name.length>150)throw new LinkedInError(400,'Enter the numeric organisation ID and Page name.');const ref=firestore.collection('linkedinConnections').doc(id(authority.workspaceId));await firestore.runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists||!['CONNECTED','EXPIRING_SOON'].includes(connectionState(doc.get('expiresAt'))))throw new LinkedInError(409,'Connect LinkedIn first.');tx.update(ref,{page:{organisationId,urn:'urn:li:organization:'+organisationId,name:name.trim(),verification:'UNVERIFIED'}});});return {saved:true,verification:'UNVERIFIED'};});
 app.post<{Body:{text?:unknown}}>(base+'/drafts',async request=>{const {identity,authority,firestore}=await admin(request);const text=request.body?.text;if(typeof text!=='string'||!text.trim()||text.length>3000)throw new LinkedInError(400,'Draft must contain 1–3000 characters.');const ref=await firestore.collection('linkedinDrafts').add({workspaceId:authority.workspaceId,environment:environment(),text:text.trim(),status:'DRAFT',createdBy:identity.uid,createdAt:Date.now(),history:[{action:'DRAFT',actor:identity.uid,at:Date.now()}]});return {id:ref.id};});
 app.post<{Params:{draftId:string};Body:{action?:unknown}}>(base+'/drafts/:draftId',async request=>{const {identity,authority,firestore}=await admin(request);const ref=firestore.collection('linkedinDrafts').doc(request.params.draftId);await firestore.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists||d.get('workspaceId')!==authority.workspaceId||d.get('environment')!==environment())throw new AuthorisationError('Draft outside workspace.');const status=workflow(d.get('status'),String(request.body?.action));tx.update(ref,{status,reviewedBy:identity.uid,reviewedAt:Date.now(),history:[...(d.get('history')??[]),{action:status,actor:identity.uid,at:Date.now()}]});});return {updated:true};});
}
