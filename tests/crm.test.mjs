import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,normalizeLinkedIn,validateLead,makeMessages,actionStage,waLink} from '../lib/crm-domain.js';
import {parseTable} from '../src/crm-import.js';
test('normalizes WhatsApp and rejects malformed leads',()=>{
 assert.equal(normalizePhone('(21) 97114-6102'),'5521971146102');
 assert.equal(normalizePhone('+55 21 97114-6102'),'5521971146102');
 assert.throws(()=>validateLead({name:'A',phone:'123'}));
 assert.throws(()=>validateLead({phone:'21971146102'}));
 assert.throws(()=>validateLead({name:'A',phone:'21971146102',stage:'unknown'}));
});
test('commercial actions preserve later stages and block closed opportunities',()=>{
 assert.equal(actionStage('new','first'),'contacted');
 assert.equal(actionStage('contacted','second'),'qualification');
 assert.equal(actionStage('proposal','second'),'proposal');
 assert.equal(actionStage('meeting','first'),'meeting');
 assert.throws(()=>actionStage('won','first'));
});
test('lead profile persists and existing leads default to agencies',()=>{
 const base={name:'Amorim',phone:'21900000000'};
 assert.equal(validateLead(base).lead_type,'agency');
 const broker=validateLead({...base,lead_type:'broker'});
 assert.equal(validateLead(JSON.parse(JSON.stringify(broker))).lead_type,'broker');
 assert.throws(()=>validateLead({...base,lead_type:'unknown'}));
});
test('LinkedIn contacts keep valid case-sensitive profile identifiers and reject unsafe links',()=>{
 assert.equal(normalizeLinkedIn('https://br.linkedin.com/in/ACwAAExample/?trk=search#details'),'https://www.linkedin.com/in/ACwAAExample');
 assert.equal(normalizeLinkedIn('linkedin.com/in/gestor-exemplo/'),'https://www.linkedin.com/in/gestor-exemplo');
 for(const value of ['https://linkedin.com.evil.test/in/name','javascript:alert(1)','https://www.linkedin.com/company/example','https://user:secret@linkedin.com/in/name'])assert.throws(()=>normalizeLinkedIn(value));
 const manager=validateLead({lead_type:'manager',name:'Gestor Exemplo',business:'Construtora Exemplo',job_title:'Gerente comercial',city:'Niterói, RJ',linkedin:'https://www.linkedin.com/in/gestor-exemplo'});
 assert.equal(manager.phone,null);assert.equal(manager.lead_type,'manager');assert.equal(manager.job_title,'Gerente comercial');
 assert.equal(manager.business,'Construtora Exemplo');assert.equal(manager.city,'Niterói, RJ');
 assert.throws(()=>validateLead({lead_type:'manager',name:'Sem canal'}));
 assert.throws(()=>validateLead({...manager,phone:'123'}));
 const messages=makeMessages(manager);assert.match(messages.first,/Gerente comercial/);assert.match(messages.first,/Construtora Exemplo/);
});
test('manager CSV maps every source column and accepts several contacts without phone',()=>{
 const csv='Nome,Cargo,Empresa,Local,LinkedIn\r\nGestor Um,Gerente comercial,Construtora Exemplo,"São Gonçalo, RJ",https://www.linkedin.com/in/gestor-um\r\nGestora Dois,Diretora comercial,Incorporadora Exemplo,"Niterói, RJ",https://www.linkedin.com/in/gestora-dois';
 const rows=parseTable(csv).map(r=>validateLead({...r.lead,lead_type:'manager'}));
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.phone===null));assert.notEqual(rows[0].linkedin,rows[1].linkedin);
 assert.equal(rows[0].name,'Gestor Um');assert.equal(rows[0].job_title,'Gerente comercial');assert.equal(rows[0].business,'Construtora Exemplo');assert.equal(rows[0].city,'São Gonçalo, RJ');
 assert.equal(rows[0].linkedin,'https://www.linkedin.com/in/gestor-um');
});
test('broker messages address the professional across the entire sales flow',()=>{
 const messages=makeMessages({lead_type:'broker',name:'Amorim Silva',business:'Empresa Associada',city:'São Gonçalo',id:'broker-test',focus:'site',diagnostic:{scores:[20,30,40]}});
 assert.match(messages.first,/Oi, Amorim!/);
 assert.match(messages.first,/testes com corretores de São Gonçalo/);
 assert.match(messages.first,/qual corretor de imóveis procurar para comprar um apartamento ou uma casa, e você não apareceu/);
 assert.match(messages.second,/Aqui está o seu diagnóstico, Amorim:/);
 assert.match(messages.second,/crm_lead=broker-test/);
 assert.ok(messages.second.endsWith('Leva cerca de 3 minutos e o resultado sai na hora.'));
 assert.match(messages.meeting,/sua captação e seu atendimento/);
 assert.match(messages.followup,/seu trabalho como corretor/);
 assert.match(messages.proposal,/proposta que te enviei/);
 for(const message of Object.values(messages))assert.doesNotMatch(message,/imobiliária|Empresa Associada/);
 const agency=makeMessages({name:'Empresa',city:'São Gonçalo'});
 assert.match(agency.first,/testes com imobiliárias de São Gonçalo/);
});
test('messages include contact, region and tracked diagnostic',()=>{
 const m=makeMessages({id:'test-id',name:'Maria Silva',business:'Imobiliária Teste',city:'Niterói',focus:'site',response_type:'price'});
 assert.match(m.first,/Maria/);assert.match(m.first,/Niterói/);
 assert.match(m.second,/Aqui está o diagnóstico para a Imobiliária Teste:/);assert.match(m.second,/crm_lead=test-id/);
 const u=new URL(waLink('21971146102',m.second));
 assert.equal(u.pathname,'/5521971146102');assert.equal(u.searchParams.get('text'),m.second);
});
test('outreach follows the approved copy and keeps the diagnostic delivery concise',()=>{
 const messages=makeMessages({id:'lead-example',name:'Imobiliária Exemplo',source:'Importação',city:'São Gonçalo'});
 assert.match(messages.first,/testes com imobiliárias de São Gonçalo, perguntando ao ChatGPT/);
 assert.match(messages.first,/Posso te mandar\?/);
 assert.match(messages.first,/e a sua não apareceu/);
 assert.match(messages.second,/Aqui está o diagnóstico para a Imobiliária Exemplo:/);
 assert.ok(messages.second.endsWith('Leva cerca de 3 minutos e o resultado sai na hora.'));
 assert.match(messages.second,/crm_lead=lead-example/);
 const fallback=makeMessages({name:'Maria'});
 assert.match(fallback.first,/de sua região/);
 assert.doesNotMatch(fallback.first,/undefined|null/);
});
test('bulk parser handles Excel paste, BOM, quoted delimiters and line breaks',()=>{
 const rows=parseTable('\uFEFFNome;Imobiliária;WhatsApp;Observações\r\nMaria;"Casa; Sul";21971146102;"Duas\nlinhas"');
 assert.equal(rows.length,1);assert.equal(rows[0].lead.business,'Casa; Sul');assert.equal(rows[0].lead.notes,'Duas\nlinhas');
 assert.equal(parseTable('nome\ttelefone\nJoão\t21971146102')[0].lead.name,'João');
 assert.throws(()=>parseTable('nome;telefone\n"aberto;123'));
 assert.throws(()=>parseTable('nome;cidade\nA;B'));
});
test('imports the original Nome/Telefone/Bairro/Site format without losing the neighborhood',()=>{
 const [row]=parseTable('Nome,Telefone,Bairro,Site\nImobiliária Exemplo,+55 21 90000-0000,Ipanema,https://example.com');
 assert.equal(row.lead.city,'Ipanema');
 assert.equal(validateLead(row.lead).city,'Ipanema');
 assert.equal(row.lead.website,'https://example.com');
});
test('combines city and neighborhood, falls back from empty columns and avoids duplicate regions',()=>{
 const cases=[
  ['Cidade;Bairro','Rio de Janeiro;Ipanema','Rio de Janeiro · Ipanema'],
  ['Cidade;Bairro',';Ipanema','Ipanema'],
  ['Cidade;Região','Niterói;Niterói','Niterói'],
  ['Cidade / Região','Leblon','Leblon'],
  ['Município;Bairro','Rio de Janeiro;Leblon','Rio de Janeiro · Leblon'],
  ['address/city;address/neighborhood','Rio de Janeiro;Copacabana','Rio de Janeiro · Copacabana'],
  ['City;Neighborhood',';Ipanema','Ipanema'],
  ['Cidade;City;Bairro',';Rio de Janeiro;Leblon','Rio de Janeiro · Leblon'],
 ];
 for(const [headers,values,expected]of cases){assert.equal(parseTable(`Nome;Telefone;${headers}\nExemplo;21900000000;${values}`)[0].lead.city,expected,headers);}
});
