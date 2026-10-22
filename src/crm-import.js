const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={name:['nome','name','contato','responsavel','nomedocontato'],business:['imobiliaria','empresa','business','company','title','nomedaempresa'],phone:['whatsapp','telefone','phone','celular','numero','phoneunformatted'],email:['email','emailaddress'],city:['cidade','city','regiao','localidade'],website:['site','website','url','web'],instagram:['instagram','insta'],notes:['observacoes','observacao','notes','notas','contexto'],source:['origem','source','fonte'],focus:['foco','focus','interesse']};
export function parseTable(text){
 text=String(text).replace(/^\uFEFF/,'');
 const head=text.split(/\r?\n/)[0];
 const delimiter=['\t',';',','].sort((a,b)=>head.split(b).length-head.split(a).length)[0];
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Há uma célula com aspas não fechadas. Confira o CSV.');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('Inclua o cabeçalho e pelo menos um contato.');
 const headers=rows.shift().map(key),mapping={};for(const [field,names]of Object.entries(aliases)){const n=headers.findIndex(h=>names.includes(h));if(n>=0)mapping[field]=n;}
 if(mapping.phone===undefined||mapping.name===undefined&&mapping.business===undefined)throw Error('O cabeçalho precisa de WhatsApp/telefone e nome ou imobiliária.');
 if(rows.length>5000)throw Error('Limite de 5.000 linhas por arquivo. Divida a importação.');
 return rows.map((r,i)=>({line:i+2,lead:Object.fromEntries(Object.entries(mapping).map(([k,n])=>[k,(r[n]||'').trim()]))}));
}
