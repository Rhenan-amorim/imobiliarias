import {randomBytes,createHmac} from 'node:crypto';
import {db} from '../lib/db.js';
import {digest,passwordConfig,verifyPassword,requireAdmin,requireSameOrigin,sessionToken,sessionCookie,SESSION_SECONDS} from '../lib/admin-auth.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method==='GET'){
  try{await requireAdmin(req);return res.json({authenticated:true});}
  catch{return res.status(401).json({authenticated:false});}
 }
 if(req.method!=='POST')return res.status(405).end();
 try{requireSameOrigin(req);}catch{return res.status(403).json({error:'Origem não autorizada.'});}
 if(!String(req.headers['content-type']).startsWith('application/json'))return res.status(415).json({error:'Formato inválido.'});
 let body;
 try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||JSON.stringify(body).length>4096)throw Error();}
 catch{return res.status(400).json({error:'Solicitação inválida.'});}
 try{
  const sql=db();
  if(body.action==='logout'){
   const token=sessionToken(req);
   if(token)await sql`delete from diagnostic_private.admin_sessions where token_hash=${digest(token)}`;
   res.setHeader('Set-Cookie',sessionCookie());return res.json({ok:true});
  }
  if(body.action!=='login')return res.status(400).json({error:'Solicitação inválida.'});
  const config=passwordConfig();
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const ipHash=createHmac('sha256',config).update(ip).digest('hex');
  const [limit]=await sql`insert into diagnostic_private.admin_login_attempts(ip_hash,window_start,attempts) values(${ipHash},now(),1) on conflict(ip_hash) do update set attempts=case when diagnostic_private.admin_login_attempts.window_start<now()-interval '15 minutes' then 1 else diagnostic_private.admin_login_attempts.attempts+1 end,window_start=case when diagnostic_private.admin_login_attempts.window_start<now()-interval '15 minutes' then now() else diagnostic_private.admin_login_attempts.window_start end returning attempts`;
  if(limit.attempts>10){res.setHeader('Retry-After','900');return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'});}
  if(!await verifyPassword(body.password))return res.status(401).json({error:'Senha incorreta. Confira e tente novamente.'});
  const token=randomBytes(32).toString('base64url');
  await sql.transaction([
   sql`insert into diagnostic_private.admin_sessions(token_hash,password_version,expires_at) values(${digest(token)},${digest(config)},now()+${SESSION_SECONDS}*interval '1 second')`,
   sql`delete from diagnostic_private.admin_sessions where expires_at<=now()`,
   sql`delete from diagnostic_private.admin_login_attempts where ip_hash=${ipHash} or window_start<now()-interval '1 day'`
  ]);
  res.setHeader('Set-Cookie',sessionCookie(token));
  return res.json({authenticated:true});
 }catch{return res.status(503).json({error:'Não foi possível acessar o painel. Tente novamente em instantes.'});}
}
