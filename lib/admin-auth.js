import {createRemoteJWKSet,jwtVerify} from 'jose';
export const ADMIN_EMAIL='rhenanamorim230@gmail.com';
let jwks;
export async function requireAdmin(req){
 const authorization=req.headers.authorization;
 if(!authorization?.startsWith('Bearer '))throw Error('unauthorized');
 const base=process.env.NEON_AUTH_BASE_URL;
 jwks??=createRemoteJWKSet(new URL(base+'/.well-known/jwks.json'));
 const origin=new URL(base).origin;
 const {payload}=await jwtVerify(authorization.slice(7),jwks,{issuer:origin,audience:origin,algorithms:['EdDSA']});
 if(payload.email?.toLowerCase()!==ADMIN_EMAIL||payload.emailVerified!==true||payload.banned===true)throw Error('forbidden');
 return payload;
}
