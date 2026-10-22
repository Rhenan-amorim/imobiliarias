import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,validateLead,makeMessages,actionStage,waLink} from '../lib/crm-domain.js';
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
test('messages include grounded context, objections and tracked diagnostic',()=>{
 const m=makeMessages({id:'test-id',name:'Maria Silva',business:'Imobiliária Teste',city:'Niterói',focus:'site',response_type:'price'});
 assert.match(m.first,/Maria/);assert.match(m.first,/Niterói/);
 assert.match(m.second,/investimento depende/);assert.match(m.second,/crm_lead=test-id/);
 const u=new URL(waLink('21971146102',m.second));
 assert.equal(u.pathname,'/5521971146102');assert.equal(u.searchParams.get('text'),m.second);
});
test('outreach asks about ChatGPT visibility and offers the diagnostic without inventing a search',()=>{
 const messages=makeMessages({id:'lead-example',name:'Imobiliária Exemplo',source:'Importação',city:'São Gonçalo'});
 assert.match(messages.first,/ChatGPT.*São Gonçalo.*Imobiliária Exemplo aparece\?/);
 assert.match(messages.first,/Posso te mandar\?/);
 assert.doesNotMatch(messages.first,/não apareceu|fazendo.*testes|Oi, Imobiliária/);
 assert.match(messages.second,/Aqui está o diagnóstico para a Imobiliária Exemplo:/);
 assert.match(messages.second,/resultado sai na hora/);
 assert.match(messages.second,/crm_lead=lead-example/);
 const fallback=makeMessages({name:'Maria'});
 assert.match(fallback.first,/na sua região/);
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
