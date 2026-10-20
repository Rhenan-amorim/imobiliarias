import {createHmac} from 'node:crypto';
import {db} from '../lib/db.js';
import {validateEvent} from '../lib/events.js';
const origins=new Set(['https://amorim-diagnostico-imobiliarias.vercel.app','http://localhost:4174',...(process.env.VERCEL_URL?['https://'+process.env.VERCEL_URL]:[])]);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 if(!origins.has(req.headers.origin)||!String(req.headers['content-type']).startsWith('application/json'))return res.status(403).json({error:'forbidden'});
 let event;
 try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(body).length>22000)return res.status(413).end();event=validateEvent(body);}catch{return res.status(400).json({error:'invalid_event'});}
 try{
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
  const hash=createHmac('sha256',process.env.DATABASE_URL).update(ip).digest('hex');
  await db()`select public.diagnostic_ingest(${JSON.stringify(event)}::jsonb,${hash})`;
  return res.status(200).json({ok:true});
 }catch(error){if(String(error.message).includes('rate_limit'))return res.status(429).json({error:'rate_limit'});return res.status(503).json({error:'storage_unavailable'});}
}
