import {neon} from '@neondatabase/serverless';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const sql=neon(process.env.DATABASE_URL);
const [empty]=await sql`select public.diagnostic_metrics(now()-interval '30 days',now()) as metrics`;
assert.ok(empty.metrics.totals);
const session=randomUUID(),run=randomUUID();
// A transação é encerrada com erro intencional: nenhum registro de teste é persistido.
try{await sql.transaction([
 sql`insert into public.diagnostic_events(id,session_id,run_id,event,payload,created_at) values(${randomUUID()},${session},${run},'page_view','{}',now()-interval '1 hour'),(${randomUUID()},${session},${run},'start','{}',now()-interval '1 hour')`,
 sql`do $$ declare m jsonb; begin select public.diagnostic_metrics(now()-interval '2 hours',now()) into m; if (m->'totals'->>'abandoned')::integer<1 then raise exception 'metric_test_failed'; end if; raise exception 'rollback_test_ok'; end $$`
]);throw Error('Rollback expected')}catch(e){assert.match(e.message,/rollback_test_ok/)}
const [left]=await sql`select count(*)::int as count from public.diagnostic_events where session_id=${session}`;
assert.equal(left.count,0);
console.log('PASS: database metrics, abandonment window, and transaction rollback.');
