import {neon} from '@neondatabase/serverless';
import {readFileSync} from 'node:fs';
const sql=neon(process.env.DATABASE_URL_UNPOOLED);
const parts=readFileSync(new URL('../database/crm.sql',import.meta.url),'utf8').split(/;\s*(?=(?:--[^\n]*\n)*\s*(?:create|alter|revoke|grant)\b)/i).map(x=>x.trim()).filter(Boolean);
await sql.transaction(parts.map(p=>sql.query(p)));
console.log('CRM schema applied transactionally.');
