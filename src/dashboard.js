import {csvCell,percent} from './metrics.js';
const root=document.getElementById('dashboard'),signout=document.getElementById('signout');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=['Leads qualificados','Site, Google e IAs','Automações e atendimento'];
const questionList=window.AmorimQuestions;
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const date=s=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(s));
const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
let accessKey='',rows=[],page=0,hasMore=false,search='',metrics=null,loading=false;
const today=day(new Date());
let start=day(new Date(Date.now()-29*86400000)),end=today;
function ranges(){return{start:new Date(start+'T00:00:00-03:00').toISOString(),end:new Date(Date.parse(end+'T00:00:00-03:00')+86400000).toISOString()};}
function errorMessage(e){return e?.message||'Não foi possível concluir. Tente novamente.';}
async function api(action,extra={}){
 if(!accessKey)throw Error('Abra o painel pelo seu link privado.');
 const params=new URLSearchParams({...ranges(),action,...extra});
 const response=await fetch('/api/dashboard?'+params,{headers:{Authorization:'Bearer '+accessKey},cache:'no-store'});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Não foi possível carregar os dados.');return body;
}
function privateAccess(message='Abra o link privado completo que recebeu para acessar seu painel.'){
 signout.hidden=true;
 root.innerHTML=`<section class="login"><p class="eyebrow">ACESSO PRIVADO</p><h1>Seu painel de oportunidades.</h1><p>${esc(message)}</p><p>Este painel é acessado por um link exclusivo, sem senha ou código por e-mail.</p><a class="back" href="/">← Voltar à landing page</a></section>`;
}
function skeleton(){
 signout.hidden=false;
 root.innerHTML=`<section class="panel-heading"><div><p class="eyebrow">INTELIGÊNCIA COMERCIAL</p><h1>Diagnósticos & oportunidades</h1><p class="admin-sub">Captação, resultados e o caminho de cada sessão.</p></div><form class="filters" id="period"><label>De<input type="date" name="start" required value="${start}"></label><label>Até<input type="date" name="end" required value="${end}"></label><button class="btn" type="submit">Atualizar</button></form></section><div id="load-status" class="notice" role="status">Carregando dados…</div><div id="overview"></div><section class="panel"><div class="data-head"><div><h2>Contatos e resultados</h2><p class="muted">Formulários concluídos no período selecionado.</p></div><input id="search" type="search" placeholder="Buscar nome, imobiliária, cidade ou telefone" aria-label="Buscar contatos"><button id="export" class="small-btn">↓ Exportar CSV</button></div><div id="contacts"></div><div class="pagination"><span id="page-info"></span><div><button id="prev" class="small-btn">← Anterior</button> <button id="next" class="small-btn">Próxima →</button></div></div></section><p class="privacy-admin">Dados privados da Amorim Soluções Digitais. Evite compartilhar arquivos exportados sem necessidade. Não há registro retroativo anterior à ativação deste painel.</p>`;
 document.getElementById('period').onsubmit=e=>{e.preventDefault();const f=e.target;start=f.elements.start.value;end=f.elements.end.value;page=0;refresh();};
 let timer;
 document.getElementById('search').oninput=e=>{search=e.target.value;clearTimeout(timer);timer=setTimeout(()=>{page=0;loadContacts().catch(showError)},350);};
 document.getElementById('prev').onclick=()=>{if(page>0){page--;loadContacts().catch(showError)}};
 document.getElementById('next').onclick=()=>{if(hasMore){page++;loadContacts().catch(showError)}};
 document.getElementById('export').onclick=exportCsv;
}
function showError(err){const box=document.getElementById('load-status');if(box){box.hidden=false;box.textContent=errorMessage(err);box.className='notice inline-error';}}
async function showDashboard(){
 const initial=await api('metrics');
 skeleton();metrics=initial;renderMetrics(initial);await loadContacts();
 document.getElementById('load-status').textContent='Dados atualizados em '+date(new Date())+'. Horários de Brasília.';
}
async function refresh(){
 if(loading)return;loading=true;const status=document.getElementById('load-status');status.hidden=false;status.textContent='Atualizando dados…';status.className='notice';
 try{metrics=await api('metrics');renderMetrics(metrics);await loadContacts();status.textContent='Dados atualizados em '+date(new Date())+'. Horários de Brasília.';}catch(err){showError(err)}finally{loading=false;}
}
function renderMetrics(m){
 const t=m.totals,s=m.scores,closed=Number(t.completions)+Number(t.abandoned);
 const cards=[['Sessões',t.visits,'Sessões iniciadas no período'],['Diagnósticos concluídos',t.completions,percent(t.completions,t.starts)+' dos inícios'],['Cliques no WhatsApp',t.whatsapp_sessions,'Sessões com clique no botão'],['Taxa de desistência',percent(t.abandoned,closed),`${fmt(t.abandoned)} sem conclusão · ${fmt(t.active)} em andamento`]];
 const funnel=[['Acessaram a página',t.visits],['Iniciaram o diagnóstico',t.starts],['Concluíram o diagnóstico',t.completions],['Clicaram no WhatsApp',t.whatsapp_sessions]];
 const max=Math.max(1,...m.daily.map(d=>Number(d.visits)));
 document.getElementById('overview').innerHTML=`<div class="kpis">${cards.map(c=>`<article class="kpi"><span>${c[0]}</span><strong>${typeof c[1]==='string'&&c[1].includes('%')?c[1]:fmt(c[1])}</strong><small>${esc(c[2])}</small></article>`).join('')}</div><div class="admin-grid"><section class="panel"><h2>Funil da landing page</h2><p class="muted">Sessões que acessaram a página no período.</p>${funnel.map((f,i)=>`<div class="funnel-row"><div class="bar-label"><span>${f[0]}</span><b>${fmt(f[1])}</b></div><div class="bar"><i style="width:${Number(t.visits)?Math.min(100,Number(f[1])/Number(t.visits)*100):0}%"></i></div><small>${i?percent(f[1],funnel[i-1][1])+' da etapa anterior':'100% da base selecionada'}</small></div>`).join('')}<p class="metric-note">Uma sessão é identificada neste navegador e renovada após 30 minutos sem atividade registrada. Clique no WhatsApp não confirma mensagem enviada ou venda. A contagem considera eventos recebidos até o fim do período selecionado.</p></section><section class="panel"><h2>Sessões por dia</h2><p class="muted">Cada sessão conta uma vez por dia em que abriu a página.</p>${m.daily.length?`<div class="chart">${m.daily.map(d=>`<div class="chart-day" title="${esc(d.day)}: ${fmt(d.visits)} sessões"><span>${fmt(d.visits)}</span><div class="chart-bar" style="height:${Number(d.visits)/max*115}px"></div><small>${esc(String(d.day).slice(5).split('-').reverse().join('/'))}</small></div>`).join('')}</div>`:'<p class="empty">As primeiras sessões aparecerão aqui.</p>'}<h2 style="margin-top:28px">Notas médias</h2>${names.map((n,i)=>`<div class="bar-label"><span>${n}</span><b>${s[['avg_leads','avg_site','avg_service'][i]]??'—'} / 100</b></div>`).join('')}<p class="metric-note">Média dos ${fmt(s.leads)} formulários enviados no período; não representa desempenho comercial comprovado.</p></section></div><div class="admin-grid"><section class="panel"><h2>Onde as sessões pararam</h2><p class="muted">Somente inícios sem conclusão e sem atividade há mais de 30 minutos.</p>${m.drops.length?`<div class="table-wrap"><table><thead><tr><th>Última etapa alcançada</th><th>Sessões</th><th>% das desistências</th></tr></thead><tbody>${m.drops.map(d=>`<tr><td>${Number(d.step)===11?'Formulário de contato':Number(d.step)>=0?'Pergunta '+(Number(d.step)+1):'Antes da primeira pergunta'}</td><td>${fmt(d.total)}</td><td>${percent(d.total,t.abandoned)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhuma desistência consolidada neste período.</p>'}<p class="metric-note">Taxa de desistência = desistências ÷ (conclusões + desistências). Sessões ainda em andamento ficam fora desse cálculo. Se alguém retornar e concluir na mesma sessão, o diagnóstico passa a contar como concluído.</p></section><section class="panel"><h2>Origem e campanhas</h2><p class="muted">Origem identificada pelos parâmetros UTM do link.</p>${m.sources.length?`<ul class="origin-list">${m.sources.map(s=>`<li><span>${esc(s.source||'direto')}${s.campaign?'<small> · '+esc(s.campaign)+'</small>':''}</span><b>${fmt(s.total)}</b></li>`).join('')}</ul>`:'<p class="empty">Nenhuma origem registrada.</p>'}<h2 style="margin-top:24px">Cliques registrados</h2><ul class="origin-list">${m.clicks.map(c=>`<li><span>${({start:'Iniciar diagnóstico',whatsapp:'WhatsApp',download:'Baixar diagnóstico',chatgpt:'Teste no ChatGPT',google:'Pesquisa no Google'})[c.event]}</span><b>${fmt(c.total)}</b></li>`).join('')||'<li>Aguardando os primeiros cliques.</li>'}</ul></section></div>`;
}
async function loadContacts(){
 const result=await api('leads',{page:String(page),search});rows=result.rows;hasMore=result.more;
 document.getElementById('contacts').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Contato / imobiliária</th><th>Cidade</th><th>WhatsApp</th><th>Nota</th><th>Contato comercial</th><th></th></tr></thead><tbody>${rows.map((r,i)=>{const p=r.payload,l=p.lead;return`<tr><td>${date(r.created_at)}</td><td><b>${esc(l.name)}</b><small>${esc(l.business)}</small></td><td>${esc(l.city)}</td><td>${esc(l.phone)}${l.email?'<small>'+esc(l.email)+'</small>':''}</td><td><span class="badge ${p.total<40?'low':''}">${p.total}/100</span></td><td>${l.contact_consent?'Autorizado':'Não autorizado'}</td><td><button class="small-btn" data-detail="${i}">Ver respostas</button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">Nenhum contato encontrado. Os próximos formulários concluídos aparecerão aqui.</p>';
 document.getElementById('page-info').textContent=rows.length?`Página ${page+1} · ${rows.length} resultados`:'Sem resultados';
 document.getElementById('prev').disabled=page===0;document.getElementById('next').disabled=!hasMore;
 document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(rows[Number(b.dataset.detail)]));
}
function detail(row){const p=row.payload,l=p.lead;
 document.getElementById('detail-content').innerHTML=`<p class="eyebrow">DIAGNÓSTICO INDIVIDUAL</p><h2>${esc(l.business)}</h2><p>${esc(l.name)} · ${esc(l.city)}<br>${esc(l.phone)} ${l.email?'· '+esc(l.email):''}<br>${date(row.created_at)}</p><p><strong>Nota geral: ${p.total}/100</strong><br>${names.map((n,i)=>`${n}: ${p.scores[i]}/100`).join('<br>')}</p><p>Contato comercial: ${l.contact_consent?'autorizado no formulário':'não autorizado no formulário'}</p>${questionList.map((q,i)=>`<div class="detail-block"><b>${i+1}. ${esc(q.q)}</b><p>${esc(Array.isArray(p.answers[i])?p.answers[i].map(k=>q.o[k]).join('; '):q.o[p.answers[i]])}</p></div>`).join('')}<p class="metric-note">Origem: ${esc(p.source?.source||'direto')} · Campanha: ${esc(p.source?.campaign||'não informada')}<br>Aviso de coleta: ${esc(p.notice_version)}</p>`;
 document.getElementById('lead-detail').showModal();
}
async function exportCsv(){const button=document.getElementById('export');button.disabled=true;button.textContent='Preparando…';try{const all=[];let n=0,more=true;while(more){const data=await api('leads',{page:String(n++),search});all.push(...data.rows);more=data.more;}
 const header=['Data','Nome','Imobiliária','Cidade','WhatsApp','Email','Autorizou contato','Nota geral',...names,'Origem','Campanha',...questionList.map((q,i)=>`${i+1}. ${q.q}`)];
 const csv=[header,...all.map(r=>{const p=r.payload,l=p.lead;return[date(r.created_at),l.name,l.business,l.city,l.phone,l.email,l.contact_consent?'Sim':'Não',p.total,...p.scores,p.source?.source,p.source?.campaign,...questionList.map((q,i)=>Array.isArray(p.answers[i])?p.answers[i].map(k=>q.o[k]).join('; '):q.o[p.answers[i]])]})].map(line=>line.map(csvCell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`diagnosticos-${start}-${end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(err){showError(err)}finally{button.disabled=false;button.textContent='↓ Exportar CSV';}}
signout.onclick=()=>{accessKey='';try{sessionStorage.removeItem('amorim.admin.access')}catch{}rows=[];metrics=null;document.getElementById('lead-detail').close();document.getElementById('detail-content').replaceChildren();privateAccess('Acesso encerrado. Abra novamente seu link privado quando quiser consultar o painel.');};
document.getElementById('close-detail').onclick=()=>document.getElementById('lead-detail').close();
try{
 const fromLink=new URLSearchParams(location.hash.slice(1)).get('access');
 if(fromLink){accessKey=fromLink;try{sessionStorage.setItem('amorim.admin.access',accessKey)}catch{}history.replaceState(null,'',location.pathname+location.search);}
 else{try{accessKey=sessionStorage.getItem('amorim.admin.access')||''}catch{}}
 if(accessKey)await showDashboard();else privateAccess();
}catch(err){accessKey='';try{sessionStorage.removeItem('amorim.admin.access')}catch{}privateAccess('Não foi possível abrir o painel: '+errorMessage(err));}
