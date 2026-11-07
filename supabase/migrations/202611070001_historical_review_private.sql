-- PREPARED ONLY. Not applied. Approval is separate from public.audits.
-- Future operator must confirm the target project, backup and review this migration.
begin;
create table if not exists public.historical_review_catalogs (
  digest text primary key check (digest ~ '^[a-f0-9]{64}$'),
  document jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.historical_review_states (
  review_key text primary key check (review_key ~ '^[a-f0-9]{64}$'),
  audit_id text not null,
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  version integer not null check (version >= 0),
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(document) = 'object'),
  check (document ?& array['reviewKey','auditId','snapshotHash','version','draft','challenge','approval']),
  check (jsonb_typeof(document->'draft') = 'object'),
  check (document->>'reviewKey' = review_key),
  check (document->>'auditId' = audit_id),
  check (document->>'snapshotHash' = snapshot_hash),
  check ((document->>'version')::integer = version)
);
alter table public.historical_review_catalogs enable row level security;
alter table public.historical_review_states enable row level security;
-- Intentionally no browser policies. Explicit revokes also block non-RLS clients.
revoke all on public.historical_review_catalogs from public, anon, authenticated;
revoke all on public.historical_review_states from public, anon, authenticated;
grant select, insert on public.historical_review_catalogs to service_role;
grant select, insert, update on public.historical_review_states to service_role;

create or replace function public.guard_historical_review_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'historical_review_catalogs' or tg_op = 'DELETE' then
    raise exception 'Historical review evidence and history are immutable';
  end if;
  if tg_op = 'INSERT' then
    if new.version <> 0 or new.document->'approval' is distinct from 'null'::jsonb
      or new.document->'challenge' is distinct from 'null'::jsonb then
      raise exception 'New private revision must start unsigned at version zero';
    end if;
    return new;
  end if;
  if old.document->'approval' is not null and old.document->'approval' <> 'null'::jsonb then
    raise exception 'Approved historical review is frozen';
  end if;
  if new.review_key <> old.review_key or new.audit_id <> old.audit_id
    or new.snapshot_hash <> old.snapshot_hash or new.version <> old.version + 1
    or new.created_at <> old.created_at then
    raise exception 'Invalid historical review compare-and-swap transition';
  end if;
  if new.document->'approval' is not null and new.document->'approval' <> 'null'::jsonb then
    if new.document->'approval'->>'publication' is distinct from 'UNPUBLISHED'
      or new.document->'challenge' is distinct from 'null'::jsonb then
      raise exception 'Approval must atomically consume challenge and remain unpublished';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists historical_review_catalogs_immutable on public.historical_review_catalogs;
create trigger historical_review_catalogs_immutable before update or delete on public.historical_review_catalogs
for each row execute function public.guard_historical_review_mutation();
drop trigger if exists historical_review_states_guard on public.historical_review_states;
create trigger historical_review_states_guard before insert or update or delete on public.historical_review_states
for each row execute function public.guard_historical_review_mutation();
commit;
