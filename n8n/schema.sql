-- Proof Rider — Supabase schema. Run once in Supabase → SQL Editor.
-- RLS is on with no policies: only the service_role key (used by n8n) can read/write.

create sequence if not exists evidence_seq;
create sequence if not exists case_seq;

create table if not exists riders (
  phone        text primary key,            -- WhatsApp number, e.g. 919876543210
  name         text,
  lang         text not null default 'hi-IN',  -- te-IN | hi-IN | kn-IN | en-IN
  state        text,                        -- TG | KA
  platform     text,
  store        text,
  union_share  boolean not null default false,
  stage        text not null default 'lang', -- lang | state | consent | ready
  consent_at   timestamptz,
  synthetic    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists pr_seen (          -- WhatsApp sometimes delivers a message twice
  wa_message_id text primary key,
  at            timestamptz not null default now()
);

create table if not exists evidence (
  id            text primary key default ('PR-' || lpad(nextval('evidence_seq')::text, 4, '0')),
  phone         text not null references riders(phone) on delete cascade,
  sha256        text not null unique,
  received_at   timestamptz not null default now(),
  wa_message_id text unique,
  storage_path  text,
  mime          text,
  size          integer,
  synthetic     boolean not null default false
);

create table if not exists screens (
  id           bigserial primary key,
  evidence_id  text references evidence(id) on delete cascade,
  phone        text references riders(phone) on delete cascade,
  screen_type  text not null,
  platform     text,
  store        text,
  date         date,
  confidence   numeric,
  data         jsonb not null,
  synthetic    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists screens_phone_type on screens(phone, screen_type);
create index if not exists screens_store_type on screens(store, screen_type);

create table if not exists rate_cards (
  id              bigserial primary key,
  store           text not null,
  platform        text,
  effective_from  date,
  base_per_order  numeric,
  per_km          numeric,
  included_km     numeric,
  slabs           jsonb,
  evidence_id     text references evidence(id) on delete set null,
  phone           text references riders(phone) on delete set null,
  synthetic       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists rate_cards_store on rate_cards(store, effective_from desc);

create table if not exists cases (
  id               text primary key default ('C-' || lpad(nextval('case_seq')::text, 3, '0')),
  phone            text references riders(phone) on delete cascade,
  type             text not null,           -- deactivation | rate_change
  platform         text,
  store            text,
  findings         jsonb,
  deadline         date,
  timeline         jsonb,
  statement_en     text,
  statement_native text,
  shortfall        numeric,
  riders_affected  integer,
  status           text not null default 'new',  -- new | drafted | filed
  created_at       timestamptz not null default now()
);

create table if not exists interviews (
  phone      text primary key references riders(phone) on delete cascade,
  case_id    text references cases(id) on delete cascade,
  step       integer not null default 1,
  retries    integer not null default 0,
  answers    jsonb not null default '{}'::jsonb,
  status     text not null default 'active'  -- active | done
);

create or replace function pr_store_rider_count(p_store text)
returns json language sql stable as $$
  select json_build_object('riders', count(*)) from riders where store = p_store;
$$;

alter table riders     enable row level security;
alter table pr_seen    enable row level security;
alter table evidence   enable row level security;
alter table screens    enable row level security;
alter table rate_cards enable row level security;
alter table cases      enable row level security;
alter table interviews enable row level security;

-- Newer Supabase projects don't auto-grant tables made in the SQL editor to service_role (n8n's key)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Private bucket for original screenshots
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- ---------- Demo seed (all marked synthetic) ----------
insert into riders (phone, name, lang, state, platform, store, union_share, stage, consent_at, synthetic)
select '9100000' || lpad(g::text, 3, '0'), 'Demo rider ' || g, 'te-IN', 'TG', 'ZipDrop', 'ZipDrop Madhapur', true, 'ready', now(), true
from generate_series(1, 40) g
on conflict (phone) do nothing;

insert into rate_cards (store, platform, effective_from, base_per_order, per_km, included_km, slabs, synthetic)
select 'ZipDrop Madhapur', 'ZipDrop', '2026-11-01', 25, 6, 2, '[{"min_orders": 60, "bonus": 500}]'::jsonb, true
where not exists (select 1 from rate_cards where store = 'ZipDrop Madhapur' and synthetic);
