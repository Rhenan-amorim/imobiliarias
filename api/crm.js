import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin} from '../lib/admin-auth.js';
import {validateLead,makeMessages,ACTIONS,actionStage,waLink,normalizePhone,linkedInMessageLink,phoneStatusPatch,assertWhatsAppAvailable} from '../lib/crm-domain.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const merge=r=>({...r.data,phone_invalid:r.data.phone_invalid===true,lead_type:r.data.lead_type||'agency',id:r.id,phone:r.phone,linkedin:r.linkedin??r.data.linkedin??null,stage:r.stage,messages:r.messages,diagnostic:r.diagnostic,created_at:r.created_at,updated_at:r.updated_at,stage_entered_at:r.stage_entered_at,last_contact_at:r.last_contact_at,replied_at:r.replied_at,next_due:r.next_due,version:r.version});
async function insertLeads(items,source='Cadastro'){
 const data=items.map(input=>{const d=validateLead(input),id=randomUUID();return{id,phone:d.phone,linkedin:d.linkedin,data:d,stage:d.stage,messages:makeMessages({...d,id}),next_due:d.next_due};});
 const [result]=await db()`with inserted as (
 insert into public.crm_leads(id,phone,linkedin,data,stage,messages,next_due)
 select id,phone,linkedin,data,stage,messages,next_due from jsonb_to_recordset(${JSON.stringify(data)}::jsonb) as x(id uuid,phone text,linkedin text,data jsonb,stage text,messages jsonb,next_due timestamptz)
 on conflict do nothing returning *
 ), history as (insert into public.crm_history(id,lead_id,kind,description,to_stage) select gen_random_uuid(),id,'created',${source},stage from inserted)
 select coalesce(jsonb_agg(to_jsonb(inserted)),'[]'::jsonb) as rows from inserted`;
 return result.rows;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try{await requireAdmin(req);}catch{return res.status(401).json({error:'Acesso privado necessário.'});}
 const sql=db();
 try{
  if(req.method==='GET'){
   if(req.query.id){if(!uuid.test(String(req.query.id)))throw Error('Lead inválido.');const [r]=await sql`select * from public.crm_leads where id=${String(req.query.id)}::uuid`;if(!r)return res.status(404).json({error:'Lead não encontrado.'});const history=await sql`select * from public.crm_history where lead_id=${r.id} order by created_at desc limit 200`;return res.json({lead:merge(r),history});}
   const q=String(req.query.search||'').trim().slice(0,100),pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%',stage=String(req.query.stage||''),mode=String(req.query.mode||'all'),invalid=req.query.phone_status==='invalid';
   const offset=Math.max(0,Math.min(1000000,Number(req.query.offset)||0));
   const rows=await sql`select * from public.crm_leads where (coalesce(data->>'phone_invalid','false')='true')=${invalid} and (${q}='' or data->>'name' ilike ${pattern} or data->>'business' ilike ${pattern} or data->>'city' ilike ${pattern} or data->>'job_title' ilike ${pattern} or linkedin ilike ${pattern} or phone ilike ${pattern}) and (${stage}='' or stage=${stage}) and (${mode}='all' or (${mode}='overdue' and next_due<now() and stage not in ('won','lost')) or (${mode}='today' and (next_due at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date and stage not in ('won','lost')) or (${mode}='open' and stage not in ('won','lost'))) order by case when next_due<now() and stage not in ('won','lost') then 0 else 1 end,updated_at desc,id limit 101 offset ${offset}`;
   const summary=await sql`select stage,coalesce(data->>'phone_invalid','false')='true' as phone_invalid,count(*)::int as total,count(*) filter(where next_due<now() and stage not in ('won','lost') and coalesce(data->>'phone_invalid','false')<>'true')::int as overdue,coalesce(sum((data->>'deal_value')::numeric),0) as value from public.crm_leads group by stage,coalesce(data->>'phone_invalid','false')='true'`;
   return res.json({rows:rows.slice(0,100).map(merge),more:rows.length>100,summary});
  }
  if(req.method!=='POST')return res.status(405).end();
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!b||JSON.stringify(b).length>1200000)return res.status(413).json({error:'Importação muito grande. Divida em lotes menores.'});
  if(b.action==='create'||b.action==='import'){
   const items=b.action==='create'?[b.lead]:b.leads;
   if(!Array.isArray(items)||!items.length||items.length>200)throw Error('Envie entre 1 e 200 leads por lote.');
   const rows=await insertLeads(items,b.action==='create'?'Cadastro manual':'Importação em massa');
   return res.json({created:rows.length,duplicates:items.length-rows.length,lead:rows[0]?merge(rows[0]):null});
  }
  if(b.action==='sync'){
   const result=await sql`select id,payload from public.diagnostic_events where event='result' order by created_at desc limit 2000`;
   let created=0,updated=0;const seen=new Set();
   for(const event of result){
    const p=event.payload,l=p.lead;let phone;try{phone=normalizePhone(l.phone)}catch{continue;}if(seen.has(phone))continue;seen.add(phone);
    const d=validateLead({...l,phone,stage:'qualification',source:'Diagnóstico',focus:['leads','site','automation'][p.scores.indexOf(Math.min(...p.scores))],do_not_contact:!l.contact_consent});
    const id=randomUUID();
    const [r]=await sql`insert into public.crm_leads(id,phone,data,stage,messages,diagnostic,diagnostic_event_id) values(${id},${phone},${JSON.stringify(d)}::jsonb,'qualification',${JSON.stringify(makeMessages({...d,id,diagnostic:p}))}::jsonb,${JSON.stringify(p)}::jsonb,${event.id}) on conflict(phone) do update set diagnostic=excluded.diagnostic,diagnostic_event_id=excluded.diagnostic_event_id,updated_at=now(),version=public.crm_leads.version+1 where public.crm_leads.diagnostic_event_id is distinct from excluded.diagnostic_event_id returning id,(xmax=0) as inserted`;
    if(r){if(r.inserted)created++;else updated++;await sql`insert into public.crm_history(id,lead_id,kind,description) values(${randomUUID()},${r.id},'diagnostic','Resultado do diagnóstico vinculado ao lead')`;}
   }return res.json({created,updated});
  }
  if(!uuid.test(String(b.id)))throw Error('Lead inválido.');
  const [row]=await sql`select * from public.crm_leads where id=${b.id}::uuid`;
  if(!row)return res.status(404).json({error:'Lead não encontrado.'});
  const lead=merge(row),eventId=uuid.test(String(b.event_id))?b.event_id:randomUUID();
  let patch,kind,description,message=null,wa=null,channel=null,openMode=null;
  if(b.action==='phone_status'){
   const {data}=phoneStatusPatch({...row.data,phone:row.phone},b.invalid);
   if(b.invalid&&!row.phone)throw Error('Este lead não tem telefone cadastrado.');
   patch={data};kind=b.invalid?'phone_invalid':'phone_restored';description=b.invalid?'Número marcado como inválido; lead separado do funil comercial':'Número liberado; lead devolvido ao funil comercial';
  }else if(b.action==='save'){
   const data=validateLead({...lead,...b.lead});
   const messages=b.regenerate?makeMessages({...data,id:lead.id,diagnostic:lead.diagnostic}):Object.fromEntries(Object.keys(ACTIONS).map(k=>[k,String(b.messages?.[k]??lead.messages[k]??'').slice(0,6000)]));
   patch={data,phone:data.phone,linkedin:data.linkedin,stage:data.stage,messages,next_due:['won','lost'].includes(data.stage)?null:data.next_due};kind='edited';description=data.phone_invalid!==lead.phone_invalid?(data.phone_invalid?'Número marcado como inválido; lead separado do funil comercial':'Número liberado; lead devolvido ao funil comercial'):data.stage!==lead.stage?'Etapa alterada manualmente':'Dados e mensagens atualizados';
  }else if(b.action==='message'){
   if(lead.do_not_contact)throw Error('Este lead está marcado como não contatar.');
   channel=b.channel||'whatsapp';if(!['whatsapp','linkedin'].includes(channel))throw Error('Canal de contato inválido.');
   if(channel==='whatsapp')assertWhatsAppAvailable(lead);
   if(channel==='linkedin'&&!lead.linkedin)throw Error('Adicione o perfil do LinkedIn na ficha.');
   const a=ACTIONS[b.type];if(!a)throw Error('Mensagem inválida.');
   message=String(b.message??lead.messages[b.type]??'').trim().slice(0,6000);if(!message)throw Error('Preencha a mensagem antes de abrir a conversa.');
   const stage=actionStage(lead.stage,b.type);
   const next=new Date(Date.now()+a.days*86400000).toISOString();
   patch={stage,next_due:next,messages:{...lead.messages,[b.type]:message}};kind=channel+'_'+b.type;
   if(channel==='linkedin'){const target=linkedInMessageLink(lead.linkedin);wa=target.url;openMode=target.mode;description=({first:'1ª abordagem preparada para o LinkedIn',second:'Resposta registrada e diagnóstico preparado para o LinkedIn',meeting:'Convite para conversa preparado para o LinkedIn',followup:'Retomada preparada para o LinkedIn',proposal:'Acompanhamento da proposta preparado para o LinkedIn'})[b.type];}
   else{description=a.label;wa=waLink(lead.phone,message);}
  }else throw Error('Ação inválida.');
  const [r]=await sql`select public.crm_mutate(${lead.id}::uuid,${Number(b.version)}::integer,${eventId}::uuid,${kind},${description},${JSON.stringify(patch)}::jsonb,${message}) as lead`;
  return res.json({lead:merge(r.lead),url:wa,channel,open_mode:openMode});
 }catch(e){const msg=String(e.message);if(msg.includes('version_conflict'))return res.status(409).json({error:'Este lead foi atualizado em outra aba. Reabra a ficha antes de salvar.'});if(msg.includes('duplicate key'))return res.status(409).json({error:'Este WhatsApp ou perfil do LinkedIn já está cadastrado no CRM.'});if(e.code)return res.status(503).json({error:'Não foi possível salvar no banco. Tente novamente.'});return res.status(400).json({error:msg.slice(0,250)});}
}
