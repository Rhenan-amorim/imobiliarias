import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {db} from './db.js';
const derive=promisify(scrypt);
const options={N:65536,r:8,p:2,maxmem:128*1024*1024};
export const SESSION_SECONDS=7*86400;
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordConfig(){
 const encoded=process.env.ADMIN_PASSWORD_HASH||'';
 if(!/^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded))throw Error('auth_unconfigured');
 return encoded;
}
export async function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 const key=await derive(password.normalize('NFC'),salt,64,options);
 return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password){
 const [,salt,expected]=passwordConfig().split(':');
 if(typeof password!=='string'||password.length>256||!password.length)return false;
 const supplied=await derive(password.normalize('NFC'),salt,64,options);
 return timingSafeEqual(supplied,Buffer.from(expected,'hex'));
}
export function cookieName(){return process.env.VERCEL==='1'?'__Host-amorim_admin':'amorim_admin';}
export function sessionToken(req){
 const value=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName()+'='))?.slice(cookieName().length+1);
 return /^[A-Za-z0-9_-]{43}$/.test(value||'')?value:null;
}
export function sessionCookie(token=''){
 return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?SESSION_SECONDS:0}${process.env.VERCEL==='1'?'; Secure':''}`;
}
export function requireSameOrigin(req){
 if(req.headers['x-amorim-request']!=='1')throw Error('forbidden');
 const expected=process.env.VERCEL==='1'?new Set(['https://amorim-diagnostico-imobiliarias.vercel.app',...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])]):new Set(['http://localhost:4174']);
 if(!expected.has(req.headers.origin))throw Error('forbidden');
}
export async function requireAdmin(req,sql){
 const token=sessionToken(req);
 if(!token)throw Error('unauthorized');
 if(!['GET','HEAD'].includes(req.method||'GET'))requireSameOrigin(req);
 const fingerprint=digest(passwordConfig());
 const [session]=await (sql||db())`select token_hash from diagnostic_private.admin_sessions where token_hash=${digest(token)} and password_version=${fingerprint} and expires_at>now()`;
 if(!session)throw Error('unauthorized');
 return {access:'password-session'};
}
