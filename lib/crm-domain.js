export const STAGES=[['new','Novo'],['contacted','1ª abordagem'],['qualification','Em qualificação'],['meeting','Reunião agendada'],['proposal','Proposta enviada'],['won','Ganho'],['lost','Perdido']];
export const STAGE_KEYS=STAGES.map(x=>x[0]);
export const LEAD_TYPES={agency:'Imobiliária',broker:'Corretor',manager:'Gestor imobiliário'};
export const ACTIONS={first:{label:'1ª abordagem aberta no WhatsApp',stage:'contacted',days:2},second:{label:'Resposta registrada e diagnóstico aberto no WhatsApp',stage:'qualification',days:3},meeting:{label:'Convite para conversa aberto no WhatsApp',stage:null,days:1},followup:{label:'Retomada aberta no WhatsApp',stage:null,days:3},proposal:{label:'Acompanhamento da proposta aberto no WhatsApp',stage:null,days:3}};
export function normalizePhone(value){const raw=String(value||'').trim();let p=raw.replace(/\D/g,'');const international=raw.startsWith('+')||p.startsWith('00');if(p.startsWith('00'))p=p.slice(2);if(!international&&(p.length===10||p.length===11))p='55'+p;if(!/^[1-9]\d{10,14}$/.test(p))throw Error('WhatsApp inválido. Informe DDD e número; use DDI para contatos internacionais.');return p;}
const text=(v,n=160)=>String(v??'').trim().slice(0,n);
export function normalizeLinkedIn(value){
 const raw=String(value||'').trim();if(!raw)return null;
 let url;try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}catch{throw Error('LinkedIn inválido. Informe o link do perfil profissional.');}
 if(!['http:','https:'].includes(url.protocol)||!/(^|\.)linkedin\.com$/i.test(url.hostname)||url.username||url.password||url.port)throw Error('LinkedIn inválido. Use um perfil em linkedin.com/in/.');
 const match=url.pathname.match(/^\/in\/([^/]+)\/?$/i);if(!match)throw Error('LinkedIn inválido. Use um perfil em linkedin.com/in/.');
 let slug;try{slug=decodeURIComponent(match[1]);}catch{throw Error('LinkedIn inválido.');}
 if(!slug||/[\s/\\?#]/.test(slug)||slug.length>250)throw Error('LinkedIn inválido.');
 return 'https://www.linkedin.com/in/'+encodeURIComponent(slug);
}
export function validateLead(input){
 const lead_type=input.lead_type||'agency';if(!Object.hasOwn(LEAD_TYPES,lead_type))throw Error('Tipo de lead inválido. Selecione Imobiliária, Corretor ou Gestor imobiliário.');
 const business=text(input.business),name=text(input.name,100);if(!business&&!name)throw Error('Informe o nome ou a imobiliária.');
 const phone=String(input.phone||'').trim()?normalizePhone(input.phone):null,linkedin=normalizeLinkedIn(input.linkedin);
 if(!phone&&!linkedin)throw Error('Informe um WhatsApp com DDD ou um perfil do LinkedIn para cadastrar o contato.');
 const email=text(input.email,160);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('E-mail inválido.');
 const stage=input.stage||'new';if(!STAGE_KEYS.includes(stage))throw Error('Etapa inválida.');
 const focus=['leads','site','automation'].includes(input.focus)?input.focus:'leads';
 const response_type=['interest','price','supplier','later'].includes(input.response_type)?input.response_type:'interest';
 const next_due=input.next_due?new Date(input.next_due):null;if(next_due&&!Number.isFinite(+next_due))throw Error('Data de retorno inválida.');
 const value=Number(input.deal_value||0);if(!Number.isFinite(value)||value<0||value>1e9)throw Error('Valor inválido.');
 return{lead_type,name,business,phone,linkedin,job_title:text(input.job_title,250),email,city:text(input.city),website:text(input.website,400),instagram:text(input.instagram,250),source:text(input.source||'Manual',120),notes:text(input.notes,6000),focus,response_type,last_reply:text(input.last_reply,3000),stage,next_due:next_due?.toISOString()||null,deal_value:value,do_not_contact:input.do_not_contact===true,lost_reason:text(input.lost_reason,300)};
}
export function diagnosticLink(lead){const u=new URL('https://amorim-diagnostico-imobiliarias.vercel.app/');u.searchParams.set('utm_source','crm');u.searchParams.set('utm_medium','whatsapp');u.searchParams.set('utm_campaign','diagnostico');if(lead.id)u.searchParams.set('crm_lead',lead.id);return u.href;}
export function makeMessages(l){
 const broker=l.lead_type==='broker';
 const manager=l.lead_type==='manager';
 const who=l.name?l.name.split(/\s+/)[0]:'equipe';const business=l.business||(manager?'sua empresa':'sua imobiliária');
 const theme={leads:'atrair interessados com perfil para os imóveis da carteira',site:broker?'melhorar sua presença profissional no Google e nas ferramentas de IA':manager?'melhorar a presença da empresa no Google e nas ferramentas de IA':'melhorar a presença da imobiliária no Google e nas ferramentas de IA',automation:'organizar respostas, qualificação e acompanhamento no WhatsApp'}[l.focus]||'melhorar a captação de interessados';
 const company=l.business||(l.source==='Importação'?l.name:'')||(manager?'sua empresa':'sua imobiliária');
 const greeting=l.name||l.business?`Oi, ${(l.name||l.business).split(/\s+/)[0]}! Tudo bem?`:'Oi! Tudo bem?';
 const result=Array.isArray(l.diagnostic?.scores)?`${broker?'No seu diagnóstico':'No diagnóstico da '+business}, os índices foram: leads ${l.diagnostic.scores[0]}/100, presença digital ${l.diagnostic.scores[1]}/100 e atendimento ${l.diagnostic.scores[2]}/100. São indicadores das respostas, não uma auditoria técnica. `:'';
 return{
 first:manager?`Oi, ${who}!\nSou Rhenan, tudo bem?\nVi sua atuação como ${l.job_title||'gestor no setor imobiliário'}${l.business?' na '+l.business:''}.\n\nEstava fazendo uns testes com corretores em ${l.city||'sua região'}, perguntando ao ChatGPT qual o melhor corretor da região ou com quem comprar um apartamento e você não apareceu. Montei um diagnóstico rápido que mostra o porquê. Posso te mandar?`:broker?`${greeting}\nEstava fazendo uns testes com corretores de ${l.city||'sua região'}, perguntando ao ChatGPT qual corretor de imóveis procurar para comprar um apartamento ou uma casa, e você não apareceu. Montei um diagnóstico rápido que mostra o porquê. Posso te mandar?`:`${greeting}\nEstava fazendo uns testes com imobiliárias de ${l.city||'sua região'}, perguntando ao ChatGPT qual a melhor imobiliária da região, e a sua não apareceu. Montei um diagnóstico rápido que mostra o porquê. Posso te mandar?`,
 second:`${broker?'Aqui está o seu diagnóstico'+(l.name?', '+who:''):'Aqui está o diagnóstico para a '+company}:\n\n${diagnosticLink(l)}\n\nLeva cerca de 3 minutos e o resultado sai na hora.`,
 meeting:`Olá, ${who}! ${result}Podemos conversar por 20 minutos para entender ${broker?'sua captação e seu atendimento':'a captação e o atendimento da '+business} e definir um próximo passo? Qual dia e horário funcionam melhor para você?`,
 followup:`Olá, ${who}! Passando para retomar nossa conversa sobre ${theme}${broker?' no seu trabalho como corretor':' na '+business}. Esse assunto faz sentido para ${broker?'você':'vocês'} neste momento? Se preferir deixar para depois, me avise e combinamos uma data melhor.`,
 proposal:`Olá, ${who}! Gostaria de saber se ficou alguma dúvida sobre ${broker?'a proposta que te enviei':'a proposta para a '+business}. Podemos alinhar escopo, prioridades e próximos passos antes de decidir?`
 };
}
export function actionStage(current,action){if(!ACTIONS[action])throw Error('Ação inválida.');if(['won','lost'].includes(current))throw Error('Reabra o lead antes de iniciar uma conversa.');if(action==='first')return current==='new'?'contacted':current;if(action==='second')return ['new','contacted'].includes(current)?'qualification':current;return current;}
export function waLink(phone,message){return 'https://wa.me/'+normalizePhone(phone)+'?text='+encodeURIComponent(message);}

// LinkedIn compose URLs are best-effort; always provide clipboard/profile fallback.
export function linkedInMessageLink(profile,message){
 const canonical=normalizeLinkedIn(profile);if(!canonical)throw Error('Adicione o perfil do LinkedIn na ficha.');
 const id=decodeURIComponent(new URL(canonical).pathname.split('/')[2]);
 if(!/^AC[ow]A[A-Za-z0-9_-]+$/.test(id))return{url:canonical,mode:'profile'};
 const url=new URL('https://www.linkedin.com/messaging/compose/');
 url.searchParams.set('recipient',id);url.searchParams.set('profileUrn','urn:li:fsd_profile:'+id);
 url.searchParams.set('body',String(message));
 return{url:url.href,mode:'compose'};
}
