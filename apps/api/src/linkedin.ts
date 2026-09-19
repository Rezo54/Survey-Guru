import {createHash,randomBytes,createCipheriv} from 'node:crypto';
export class LinkedInError extends Error {constructor(public statusCode:number,message:string){super(message);}}
export function linkedinConfig(){
 const environment=process.env.LINKEDIN_ENV;
 if(environment!=='development'&&environment!=='production')throw new LinkedInError(503,'LinkedIn environment is not configured.');
 const prefix=environment==='production'?'LINKEDIN_PROD_':'LINKEDIN_DEV_';
 const clientId=process.env[prefix+'CLIENT_ID'];const clientSecret=process.env[prefix+'CLIENT_SECRET'];const redirectUri=process.env[prefix+'REDIRECT_URI'];const key=process.env[prefix+'TOKEN_KEY'];
 const scopes=(process.env[prefix+'SCOPES']??'').split(/\s+/).filter(Boolean);
 if(!clientId||!clientSecret||!redirectUri||!key||!scopes.length)throw new LinkedInError(503,'LinkedIn connection is unavailable until credentials and granted scopes are configured.');
 let url:URL;try{url=new URL(redirectUri);}catch{throw new LinkedInError(503,'Invalid LinkedIn redirect configuration.');}
 if(url.protocol!=='https:'||url.pathname!=='/api/integrations/linkedin/callback'||url.search||url.hash||url.username||url.password||! /^[a-f0-9]{64}$/i.test(key))throw new LinkedInError(503,'Invalid LinkedIn redirect or encryption configuration.');
 if(environment==='production'&&url.origin!=='https://surveyguru.ai')throw new LinkedInError(503,'Production redirect must use the canonical origin.');
 if(environment==='development'&&url.origin==='https://surveyguru.ai')throw new LinkedInError(503,'Development must use a separate origin.');
 return {environment,clientId,clientSecret,redirectUri,scopes,key};
}
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const nonce=()=>randomBytes(32).toString('hex');
export function encryptToken(token:string,key:string,aad:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(aad));return {version:1,iv:iv.toString('hex'),ciphertext:Buffer.concat([cipher.update(token,'utf8'),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('hex')};}
export function tokenExpiry(seconds:unknown,now=Date.now()){if(typeof seconds!=='number'||!Number.isInteger(seconds)||seconds<=0||seconds>31536000)throw new LinkedInError(502,'LinkedIn returned invalid token expiry.');return now+seconds*1000;}
export function connectionState(expiresAt:unknown,now=Date.now()){return typeof expiresAt!=='number'?'DISCONNECTED':expiresAt<=now?'RECONNECT_REQUIRED':expiresAt-now<=604800000?'EXPIRING_SOON':'CONNECTED';}
export function workflow(current:string,action:string){if(action==='publish')throw new LinkedInError(409,'Publishing is disabled pending LinkedIn vetting and verified Page permissions.');if(action==='preview'&&current==='DRAFT')return 'PREVIEWED';if(action==='approve'&&current==='PREVIEWED')return 'APPROVED';throw new LinkedInError(409,'Follow Draft → Preview → Approve → Publish.');}
