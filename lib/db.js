import {neon} from '@neondatabase/serverless';
let client;
export function db(){return client??=neon(process.env.DATABASE_URL);}
