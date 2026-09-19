export function bridgeConfig(){
 const env=process.env.LINKEDIN_ENV;if(env!=='production'&&env!=='development')throw new Error('Unconfigured environment');
 const prefix=env==='production'?'LINKEDIN_PROD_':'LINKEDIN_DEV_';
 const redirect=new URL(process.env[prefix+'REDIRECT_URI']??'');const api=new URL(process.env[prefix+'API_ORIGIN']??'');
 if(redirect.protocol!=='https:'||redirect.pathname!=='/api/integrations/linkedin/callback'||redirect.search||redirect.hash||redirect.username||redirect.password)throw new Error('Invalid redirect');
 if(env==='production'&&redirect.origin!=='https://surveyguru.ai'||env==='development'&&redirect.origin==='https://surveyguru.ai')throw new Error('Environment mismatch');
 if(api.pathname!=='/'||api.search||api.hash||api.username||api.password||!(api.protocol==='https:'||(env==='development'&&api.protocol==='http:'&&['localhost','127.0.0.1'].includes(api.hostname))))throw new Error('Invalid API origin');
 return {origin:redirect.origin,api:api.origin};
}
export const cookieName='__Host-sg-linkedin';
export const cookie=(value:string,age:number)=>`${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
