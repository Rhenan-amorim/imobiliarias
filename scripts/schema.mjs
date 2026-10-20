import {neon} from '@neondatabase/serverless';
import {readFileSync} from 'node:fs';
const sql=neon(process.env.DATABASE_URL_UNPOOLED);
const commands=readFileSync(new URL('../database/schema.sql',import.meta.url),'utf8').split(/;\s*(?=(?:--[^\n]*\n)*\s*(?:create|alter|revoke|grant)\b)/i).map(x=>x.trim()).filter(Boolean);
await sql.transaction(commands.map(command=>sql.query(command)));
console.log('Schema created in a single transaction.');
