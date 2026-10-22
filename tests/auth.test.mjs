import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {requireAdmin} from '../lib/admin-auth.js';
test('link privado exige chave correta e configuração válida do servidor',async()=>{
 const key=randomBytes(32).toString('base64url');
 const hash=createHash('sha256').update(key).digest('hex');
 process.env.ADMIN_LINK_HASH=hash;
 assert.equal((await requireAdmin({headers:{authorization:'Bearer '+key}})).access,'private-link');
 for(const authorization of [undefined,'Bearer invalid','Bearer '+randomBytes(32).toString('base64url'),'Basic '+key])await assert.rejects(()=>requireAdmin({headers:{authorization}}));
 delete process.env.ADMIN_LINK_HASH;
 await assert.rejects(()=>requireAdmin({headers:{authorization:'Bearer '+key}}));
 process.env.ADMIN_LINK_HASH='invalid';
 await assert.rejects(()=>requireAdmin({headers:{authorization:'Bearer '+key}}));
});
