import {db} from '../lib/db.js';
import {requireAdmin} from '../lib/admin-auth.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).end();
 try{await requireAdmin(req);}catch{return res.status(401).json({error:'Acesso restrito ao administrador.'});}
 const start=new Date(String(req.query.start)),end=new Date(String(req.query.end));
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||end-start>367*86400000)return res.status(400).json({error:'Selecione um período válido, de até 366 dias.'});
 try{
  const sql=db(),startIso=start.toISOString(),endIso=end.toISOString();
  if(req.query.action==='metrics'){
   const [row]=await sql`select public.diagnostic_metrics(${startIso}::timestamptz,${endIso}::timestamptz) as metrics`;
   return res.json(row.metrics);
  }
  const page=Math.max(0,Math.min(100000,Number(req.query.page)||0)),offset=page*50;
  const search=String(req.query.search||'').trim().slice(0,100);
  const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
  const rows=await sql`select id,created_at,payload from public.diagnostic_events where event='result' and created_at>=${startIso}::timestamptz and created_at<${endIso}::timestamptz and (${search}='' or payload->'lead'->>'name' ilike ${pattern} or payload->'lead'->>'business' ilike ${pattern} or payload->'lead'->>'city' ilike ${pattern} or payload->'lead'->>'phone' ilike ${pattern}) order by created_at desc,id limit 51 offset ${offset}`;
  return res.json({rows:rows.slice(0,50),more:rows.length>50});
 }catch{return res.status(503).json({error:'Não foi possível consultar o banco. Tente novamente.'});}
}
