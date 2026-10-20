-- Fonte do esquema do dashboard. Dados pessoais só podem ser lidos pelo administrador.
create schema if not exists diagnostic_private;
revoke all on schema diagnostic_private from public;

create table public.diagnostic_events (
 id uuid primary key,
 session_id uuid not null,
 run_id uuid not null,
 event text not null check(event in ('page_view','start','question','answer','form','result','whatsapp','download','chatgpt','google')),
 step smallint check(step between -1 and 11),
 payload jsonb not null default '{}'::jsonb check(octet_length(payload::text)<=20000),
 created_at timestamptz not null default now()
);
create index diagnostic_events_created_idx on public.diagnostic_events(created_at);
create index diagnostic_events_session_idx on public.diagnostic_events(session_id,created_at);
create index diagnostic_results_created_idx on public.diagnostic_events(created_at desc) where event='result';
create unique index diagnostic_once_idx on public.diagnostic_events(session_id,run_id,event) where event in ('page_view','start','form','result');
create unique index diagnostic_question_once_idx on public.diagnostic_events(session_id,run_id,step) where event='question';
alter table public.diagnostic_events enable row level security;
revoke all on public.diagnostic_events from public;


-- Acesso somente pelo servidor; nenhum cliente recebe conexão ou credenciais do Postgres.
create table diagnostic_private.ingest_limits (
 ip_hash text not null,
 bucket timestamptz not null,
 requests integer not null,
 primary key(ip_hash,bucket)
);
alter table diagnostic_private.ingest_limits enable row level security;

create function public.diagnostic_ingest(p_event jsonb,p_ip_hash text) returns void
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into diagnostic_private.ingest_limits values(p_ip_hash,date_trunc('minute',now()),1)
 on conflict(ip_hash,bucket) do update set requests=diagnostic_private.ingest_limits.requests+1 returning requests into n;
 if n>120 then raise exception 'rate_limit'; end if;
 if (select count(*) from public.diagnostic_events where session_id=(p_event->>'session_id')::uuid and created_at>now()-interval '1 hour')>500 then raise exception 'rate_limit'; end if;
 insert into public.diagnostic_events(id,session_id,run_id,event,step,payload)
 values((p_event->>'id')::uuid,(p_event->>'session_id')::uuid,(p_event->>'run_id')::uuid,p_event->>'event',(p_event->>'step')::smallint,p_event->'payload') on conflict do nothing;
 delete from diagnostic_private.ingest_limits where bucket<now()-interval '2 hours';
end $$;
revoke all on function public.diagnostic_ingest(jsonb,text) from public;


create function public.diagnostic_metrics(start_at timestamptz,end_at timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
with cohort as (
 select distinct session_id from public.diagnostic_events where event='page_view' and created_at>=start_at and created_at<end_at
), sessions as (
 select e.session_id,bool_or(event='start') started,bool_or(event='result') completed,
 bool_or(event='whatsapp') whatsapp,max(e.step) filter(where event in ('question','form')) last_step,max(created_at) last_seen
 from public.diagnostic_events e join cohort c using(session_id) where created_at<end_at group by e.session_id
), totals as (
 select count(*) visits,count(*) filter(where started) starts,count(*) filter(where completed) completions,
 count(*) filter(where whatsapp) whatsapp_sessions,
 count(*) filter(where started and not completed and last_seen<=now()-interval '30 minutes') abandoned,
 count(*) filter(where started and not completed and last_seen>now()-interval '30 minutes') active from sessions
), daily as (
 select (created_at at time zone 'America/Sao_Paulo')::date as day,count(distinct session_id) visits from public.diagnostic_events
 where event='page_view' and created_at>=start_at and created_at<end_at group by 1 order by 1
), dropped as (
 select coalesce(last_step,-1) step,count(*) total from sessions
 where started and not completed and last_seen<=now()-interval '30 minutes' group by 1 order by 1
), clicks as (
 select event,count(*) total,count(distinct session_id) sessions from public.diagnostic_events
 where event in ('start','whatsapp','download','chatgpt','google') and created_at>=start_at and created_at<end_at group by event
), origins as (
 select coalesce(nullif(payload->'source'->>'source',''),'direto') source,coalesce(payload->'source'->>'campaign','') campaign,count(distinct session_id) total
 from public.diagnostic_events where event='page_view' and created_at>=start_at and created_at<end_at group by 1,2 order by 3 desc limit 12
), scores as (
 select count(*) leads,round(avg((payload->>'total')::numeric)) avg_total,
 round(avg((payload->'scores'->>0)::numeric)) avg_leads,round(avg((payload->'scores'->>1)::numeric)) avg_site,round(avg((payload->'scores'->>2)::numeric)) avg_service
 from public.diagnostic_events where event='result' and created_at>=start_at and created_at<end_at
)
select jsonb_build_object('totals',(select to_jsonb(totals) from totals),'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb),
 'drops',coalesce((select jsonb_agg(dropped) from dropped),'[]'::jsonb),'clicks',coalesce((select jsonb_agg(clicks) from clicks),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(origins) from origins),'[]'::jsonb),'scores',(select to_jsonb(scores) from scores))
$$;
revoke all on function public.diagnostic_metrics(timestamptz,timestamptz) from public;
