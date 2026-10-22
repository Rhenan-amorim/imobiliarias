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
test('bulk parser handles Excel paste, BOM, quoted delimiters and line breaks',()=>{
 const rows=parseTable('\uFEFFNome;Imobiliária;WhatsApp;Observações\r\nMaria;"Casa; Sul";21971146102;"Duas\nlinhas"');
 assert.equal(rows.length,1);assert.equal(rows[0].lead.business,'Casa; Sul');assert.equal(rows[0].lead.notes,'Duas\nlinhas');
 assert.equal(parseTable('nome\ttelefone\nJoão\t21971146102')[0].lead.name,'João');
 assert.throws(()=>parseTable('nome;telefone\n"aberto;123'));
 assert.throws(()=>parseTable('nome;cidade\nA;B'));
});
