export function percent(n,d){return Number(d)>0?(Number(n)/Number(d)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—';}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
