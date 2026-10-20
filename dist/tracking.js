/* Sessões anônimas; dados de contato são enviados somente ao concluir o formulário. */
window.AmorimMetrics=(()=>{

 const noop={track:()=>Promise.resolve(false),newRun(){}};

 let memory=null;
 const storage={get(){try{return JSON.parse(sessionStorage.getItem('amorim.metrics')||'null')}catch{return memory}},set(v){memory=v;try{sessionStorage.setItem('amorim.metrics',JSON.stringify(v))}catch{}}};
 const old=storage.get();
 let session=old&&Date.now()-old.last<1800000?old:{id:crypto.randomUUID(),run:crypto.randomUUID(),last:Date.now()};
 const sent=new Set(),pending=new Map();
 const params=new URLSearchParams(location.search);
 const source={source:(params.get('utm_source')||'direto').slice(0,80),medium:(params.get('utm_medium')||'').slice(0,80),campaign:(params.get('utm_campaign')||'').slice(0,120),referrer:(()=>{try{return document.referrer?new URL(document.referrer).hostname:''}catch{return ''}})(),device:matchMedia('(max-width:650px)').matches?'mobile':'desktop'};
 async function send(body){
  for(let attempt=0;attempt<3;attempt++){
   try{const r=await fetch('/api/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true});if(r.ok){return true}if(r.status<500&&r.status!==429)return false;}catch{}
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)));
  }return false;
 }
 function track(event,payload={},unique=false){
  const key=session.run+':'+event+':'+(payload.step??'');
  if(unique&&sent.has(key))return pending.get(key)||Promise.resolve(true);
  if(unique)sent.add(key);
  session.last=Date.now();storage.set(session);
  const body={id:crypto.randomUUID(),session_id:session.id,run_id:session.run,event,step:payload.step??null,payload:{...payload,source}};
  const promise=send(body).then(ok=>{if(!ok&&unique)sent.delete(key);pending.delete(key);return ok});
  if(unique)pending.set(key,promise);
  return promise;
 }
 track('page_view',{},true);
 return{track,newRun(){session.run=crypto.randomUUID();storage.set(session)}};
})();
