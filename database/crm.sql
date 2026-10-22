create table if not exists public.crm_leads (
 id uuid primary key default gen_random_uuid(),
 phone text unique,
 linkedin text,
 constraint crm_leads_contact_required check(phone is not null or linkedin is not null),
 data jsonb not null default '{}',
 stage text not null default 'new' check(stage in ('new','contacted','qualification','meeting','proposal','won','lost')),
 messages jsonb not null default '{}',
 diagnostic jsonb,
 diagnostic_event_id uuid unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 stage_entered_at timestamptz not null default now(),
 last_contact_at timestamptz,
 replied_at timestamptz,
 next_due timestamptz,
 version integer not null default 1
);
create unique index if not exists crm_leads_linkedin_idx on public.crm_leads(linkedin);
create index if not exists crm_leads_stage_idx on public.crm_leads(stage,stage_entered_at);
create index if not exists crm_leads_due_idx on public.crm_leads(next_due) where stage not in ('won','lost');
alter table public.crm_leads enable row level security;
revoke all on public.crm_leads from public;
create table if not exists public.crm_history (
 id uuid primary key,
 lead_id uuid not null references public.crm_leads(id) on delete cascade,
 kind text not null,
 description text not null,
 from_stage text,
 to_stage text,
 message text,
 created_at timestamptz not null default now()
);
create index if not exists crm_history_lead_idx on public.crm_history(lead_id,created_at desc);
alter table public.crm_history enable row level security;
revoke all on public.crm_history from public;
create or replace function public.crm_mutate(p_id uuid,p_version integer,p_event_id uuid,p_kind text,p_description text,p_patch jsonb,p_message text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.crm_leads; updated public.crm_leads; target text;
begin
 select * into old from public.crm_leads where id=p_id for update;
 if old.id is null then raise exception 'not_found'; end if;
 if exists(select 1 from public.crm_history where id=p_event_id and lead_id=p_id) then return to_jsonb(old);end if;
 if old.version<>p_version then raise exception 'version_conflict';end if;
 target=coalesce(p_patch->>'stage',old.stage);
 update public.crm_leads set
 data=case when p_patch?'data' then p_patch->'data' else data end,
 phone=case when p_patch?'phone' then p_patch->>'phone' else phone end,
 linkedin=case when p_patch?'linkedin' then p_patch->>'linkedin' else linkedin end,stage=target,
 messages=case when p_patch?'messages' then p_patch->'messages' else messages end,
 stage_entered_at=case when target<>old.stage then now() else stage_entered_at end,
 next_due=case when p_patch?'next_due' then (p_patch->>'next_due')::timestamptz else next_due end,
 last_contact_at=case when p_kind like 'whatsapp_%' or p_kind like 'linkedin_%' then now() else last_contact_at end,
 replied_at=case when p_kind in ('whatsapp_second','linkedin_second') then coalesce(replied_at,now()) else replied_at end,
 updated_at=now(),version=version+1 where id=p_id returning * into updated;
 insert into public.crm_history(id,lead_id,kind,description,from_stage,to_stage,message)
 values(p_event_id,p_id,p_kind,p_description,old.stage,target,p_message);
 return to_jsonb(updated);
end $$;
revoke all on function public.crm_mutate(uuid,integer,uuid,text,text,jsonb,text) from public;
