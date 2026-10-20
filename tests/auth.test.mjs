import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {requireAdmin} from '../lib/admin-auth.js';
test('a API exige assinatura válida, emissor, audiência, email autorizado e verificado',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('EdDSA');
 const jwk=await exportJWK(publicKey);jwk.kid='test';
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[jwk]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;process.env.NEON_AUTH_BASE_URL=origin;
 const token=(claims,issuer=origin)=>new SignJWT(claims).setProtectedHeader({alg:'EdDSA',kid:'test'}).setIssuer(issuer).setAudience(origin).setSubject('test-user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 try{
  const admin=await token({email:'rhenanamorim230@gmail.com',emailVerified:true});
  assert.equal((await requireAdmin({headers:{authorization:'Bearer '+admin}})).sub,'test-user');
  await assert.rejects(()=>requireAdmin({headers:{}}));
  await assert.rejects(()=>requireAdmin({headers:{authorization:'Bearer invalid'}}));
  for(const claims of [{email:'outro@example.com',emailVerified:true},{email:'rhenanamorim230@gmail.com',emailVerified:false},{email:'rhenanamorim230@gmail.com',emailVerified:true,banned:true}]){const t=await token(claims);await assert.rejects(()=>requireAdmin({headers:{authorization:'Bearer '+t}}));}
  const wrongIssuer=await token({email:'rhenanamorim230@gmail.com',emailVerified:true},'https://attacker.example');await assert.rejects(()=>requireAdmin({headers:{authorization:'Bearer '+wrongIssuer}}));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
