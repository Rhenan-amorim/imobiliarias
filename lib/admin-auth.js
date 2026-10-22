import {createHash,timingSafeEqual} from 'node:crypto';
export async function requireAdmin(req){
 const authorization=req.headers.authorization;
 if(!authorization?.startsWith('Bearer '))throw Error('unauthorized');
 const key=authorization.slice(7),expected=process.env.ADMIN_LINK_HASH;
 if(!/^[A-Za-z0-9_-]{43}$/.test(key)||!expected||!/^[a-f0-9]{64}$/.test(expected))throw Error('unauthorized');
 const supplied=createHash('sha256').update(key).digest();
 if(!timingSafeEqual(supplied,Buffer.from(expected,'hex')))throw Error('unauthorized');
 return {access:'private-link'};
}
