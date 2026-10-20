export const eventNames=new Set(['page_view','start','question','answer','form','result','whatsapp','download','chatgpt','google']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(x,n)=>typeof x==='string'?x.trim().slice(0,n):'';
export function validateEvent(b){
 if(!b||![b.id,b.session_id,b.run_id].every(x=>typeof x==='string'&&uuid.test(x))||!eventNames.has(b.event))throw Error('invalid_event');
 if(b.step!==null&&(!Number.isInteger(b.step)||b.step< -1||b.step>11))throw Error('invalid_step');
 const input=b.payload||{},s=input.source||{};
 const payload={source:{source:clean(s.source,80),medium:clean(s.medium,80),campaign:clean(s.campaign,120),referrer:clean(s.referrer,100),device:s.device==='mobile'?'mobile':'desktop'}};
 if(b.event==='answer'){payload.step=b.step;payload.answer=Array.isArray(input.answer)?input.answer.filter(x=>Number.isInteger(x)&&x>=0&&x<7).slice(0,7):Number.isInteger(input.answer)?input.answer:null;}
 if(b.event==='result'){
  const a=input.answers,l=input.lead||{};
  if(!Array.isArray(a)||a.length!==11||!Number.isInteger(a[0])||a[0]<0||a[0]>3||!Array.isArray(a[1])||!a[1].length||a[1].some(x=>!Number.isInteger(x)||x<0||x>6)||a.slice(2).some(x=>!Number.isInteger(x)||x<0||x>3))throw Error('invalid_answers');
  const phone=clean(l.phone,25).replace(/\D/g,'');
  if(!clean(l.name,80)||!clean(l.business,120)||!clean(l.city,100)||phone.length<10||phone.length>13)throw Error('invalid_contact');
  const email=clean(l.email,120);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('invalid_email');
  const points=[0,0,0];a.slice(2).forEach((x,i)=>points[Math.floor(i/3)]+=3-x);
  payload.lead={name:clean(l.name,80),business:clean(l.business,120),city:clean(l.city,100),phone,email,contact_consent:l.contact_consent===true};
  payload.answers=a;payload.scores=points.map(x=>Math.round(x/9*100));payload.total=Math.round(points.reduce((a,b)=>a+b,0)/27*100);payload.notice_version='2026-10-20-v1';
 }
 return{id:b.id,session_id:b.session_id,run_id:b.run_id,event:b.event,step:b.step,payload};
}
