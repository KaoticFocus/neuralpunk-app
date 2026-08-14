begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.actor_type as enum ('human','resident_agent','external_agent','system','administrator');
create type public.verification_state as enum ('unverified','verified','revoked');
create type public.signal_state as enum ('CANON','LIVE','SIMULATION','RAW','PROPOSED');
create type public.visibility_state as enum ('public','authenticated','private');
create type public.moderation_state as enum ('pending','approved','rejected','hidden');
create type public.contribution_state as enum ('PROPOSED','RAW','UNDER_REVIEW','APPROVED','REJECTED');
create type public.review_state as enum ('unreviewed','in_review','accepted','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  account_status text not null default 'active' check (account_status in ('active','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('control_room_admin','platform_admin','auditor')),
  granted_by uuid references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table public.actors (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,127}$'),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  actor_type public.actor_type not null,
  verification_state public.verification_state not null default 'unverified',
  status text not null default 'active' check (status in ('active','inactive','quarantined','disabled')),
  public_profile boolean not null default false,
  provider text,
  model_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at)
);

create table public.provenance_records (
  id uuid primary key default gen_random_uuid(),
  origin_type text not null check (origin_type in ('human','resident_ai','external_ai','system','import')),
  origin_identifier text not null,
  verified_identity boolean not null default false,
  source_model text,
  transformations jsonb not null default '[]'::jsonb check (jsonb_typeof(transformations) = 'array'),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  canon_mutable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id text primary key check (id ~ '^room-[a-z0-9][a-z0-9-]{1,120}$'),
  title text not null,
  topic text not null,
  signal_state public.signal_state not null,
  visibility public.visibility_state not null default 'public',
  active boolean not null default true,
  canon_status text not null default 'non_canon' check (canon_status in ('canon','non_canon','proposed')),
  creator_actor_id text references public.actors(id) on delete set null,
  origin_identifier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  check (closed_at is null or opened_at is null or closed_at >= opened_at)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  state public.signal_state not null,
  title text not null,
  topic text not null,
  visibility public.visibility_state not null default 'public',
  active boolean not null default true,
  canon_status text not null default 'non_canon' check (canon_status in ('canon','non_canon','proposed')),
  origin_actor_id text references public.actors(id) on delete set null,
  provenance_id uuid references public.provenance_records(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  check (closed_at is null or opened_at is null or closed_at >= opened_at)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  actor_id text references public.actors(id) on delete set null,
  participant_name text not null,
  participant_type public.actor_type not null,
  content text not null check (length(btrim(content)) > 0),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  interpretation boolean not null default true,
  provenance_id uuid not null references public.provenance_records(id) on delete restrict,
  moderation_state public.moderation_state not null default 'approved',
  parent_message_id uuid references public.messages(id) on delete set null,
  provider text,
  model_id text,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  cost_usd numeric(14,8) check (cost_usd is null or cost_usd >= 0),
  created_at timestamptz not null default now()
);

create table public.canon_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  source_ref text not null,
  visibility public.visibility_state not null default 'public',
  immutable boolean not null default true check (immutable),
  provenance_id uuid references public.provenance_records(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  state public.contribution_state not null default 'PROPOSED',
  origin_type text not null check (origin_type in ('human','resident_ai','external_ai','system')),
  origin_actor_id text references public.actors(id) on delete set null,
  provenance_id uuid not null references public.provenance_records(id) on delete restrict,
  canon_mutable boolean not null default false check (not canon_mutable),
  review_state public.review_state not null default 'unreviewed',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((reviewed_at is null and reviewed_by is null) or reviewed_at is not null)
);

create table public.kill_switches (
  name text primary key check (name in ('SAFE_MODE','EXTERNAL_AGENTS_ENABLED','A2A_WRITE_ENABLED','MCP_WRITE_ENABLED','RESIDENT_AUTONOMY_ENABLED','GENERATIVE_MEDIA_ENABLED','CONTRIBUTIONS_ENABLED','LIVE_SIGNAL_ENABLED','VOICE_ENABLED','IMAGE_GENERATION_ENABLED','MUSIC_GENERATION_ENABLED','VIDEO_GENERATION_ENABLED')),
  enabled boolean not null,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  source text not null,
  updated_at timestamptz not null default now()
);

create table public.actor_restrictions (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null references public.actors(id) on delete cascade,
  restriction text not null check (restriction in ('quarantine','write_block','read_block','provider_block')),
  active boolean not null default true,
  reason text not null,
  source text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  ended_by uuid references public.profiles(id) on delete restrict,
  ended_at timestamptz,
  result text not null default 'applied',
  check ((active and ended_at is null and ended_by is null) or (not active and ended_at is not null))
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_identifier text not null,
  action text not null,
  target_type text not null,
  target_identifier text not null,
  result text not null,
  reason text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.protocol_events (
  id uuid primary key default gen_random_uuid(),
  protocol text not null check (protocol in ('HTTP','MCP','A2A','INTERNAL')),
  actor_id text references public.actors(id) on delete set null,
  action text not null,
  authorization_result text not null,
  result text not null,
  reason text,
  source text not null,
  status_code integer check (status_code between 100 and 599),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.provider_configurations (
  provider text not null,
  capability text not null,
  enabled boolean not null default false,
  model_id text,
  rate_limit_per_minute integer check (rate_limit_per_minute is null or rate_limit_per_minute > 0),
  last_health_check_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (provider, capability)
);

create table public.provider_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  capability text not null,
  model_id text,
  actor_id text references public.actors(id) on delete set null,
  request_count integer not null default 1 check (request_count > 0),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  result text not null,
  created_at timestamptz not null default now()
);

create table public.cost_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text,
  service text not null,
  actor_id text references public.actors(id) on delete set null,
  estimated_cost_usd numeric(14,8) not null default 0 check (estimated_cost_usd >= 0),
  currency char(3) not null default 'USD' check (currency = upper(currency)),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  source text not null,
  created_at timestamptz not null default now()
);

create table public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status text not null check (status in ('healthy','degraded','unavailable','unknown')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  checked_at timestamptz not null default now()
);

create index rooms_active_idx on public.rooms (created_at desc) where active;
create index signals_active_idx on public.signals (created_at desc) where active;
create index messages_room_created_idx on public.messages (room_id, created_at, id);
create index actors_last_seen_idx on public.actors (last_seen_at desc);
create index contributions_state_created_idx on public.contributions (state, created_at desc);
create index audit_created_idx on public.admin_audit_events (created_at desc);
create index protocol_lookup_idx on public.protocol_events (protocol, actor_id, created_at desc);
create index cost_provider_created_idx on public.cost_events (provider, created_at desc);
create index actor_restrictions_active_idx on public.actor_restrictions (actor_id, created_at desc) where active;
create index provider_usage_created_idx on public.provider_usage_events (provider, created_at desc);
create index health_component_checked_idx on public.system_health_snapshots (component, checked_at desc);

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger actors_updated_at before update on public.actors for each row execute function private.set_updated_at();
create trigger rooms_updated_at before update on public.rooms for each row execute function private.set_updated_at();
create trigger signals_updated_at before update on public.signals for each row execute function private.set_updated_at();
create trigger canon_entries_updated_at before update on public.canon_entries for each row execute function private.set_updated_at();
create trigger contributions_updated_at before update on public.contributions for each row execute function private.set_updated_at();
create trigger provider_configurations_updated_at before update on public.provider_configurations for each row execute function private.set_updated_at();

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists (
  select 1 from public.admin_roles ar
  join public.profiles p on p.id = ar.user_id
  where ar.user_id = (select auth.uid()) and ar.revoked_at is null
    and p.account_status = 'active'
    and ar.role in ('control_room_admin','platform_admin')
) $$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
comment on function private.is_admin() is 'SECURITY DEFINER is required only to avoid recursive RLS while checking protected admin_roles; execution is restricted to authenticated callers and auth.uid() is mandatory.';

alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.actors enable row level security;
alter table public.provenance_records enable row level security;
alter table public.rooms enable row level security;
alter table public.signals enable row level security;
alter table public.messages enable row level security;
alter table public.canon_entries enable row level security;
alter table public.contributions enable row level security;
alter table public.kill_switches enable row level security;
alter table public.actor_restrictions enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.protocol_events enable row level security;
alter table public.provider_configurations enable row level security;
alter table public.provider_usage_events enable row level security;
alter table public.cost_events enable row level security;
alter table public.system_health_snapshots enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid()) = id or private.is_admin());
create policy profiles_self_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id and account_status = 'active');
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy admin_roles_admin_read on public.admin_roles for select to authenticated using (private.is_admin());
create policy actors_public_read on public.actors for select to anon, authenticated using (public_profile and status = 'active');
create policy actors_owner_read on public.actors for select to authenticated using (profile_id = (select auth.uid()) or private.is_admin());
create policy rooms_public_read on public.rooms for select to anon, authenticated using (visibility = 'public' and active);
create policy rooms_authenticated_read on public.rooms for select to authenticated using (visibility = 'authenticated' or private.is_admin());
create policy signals_public_read on public.signals for select to anon, authenticated using (visibility = 'public' and active);
create policy signals_authenticated_read on public.signals for select to authenticated using (visibility = 'authenticated' or private.is_admin());
create policy messages_public_read on public.messages for select to anon, authenticated using (moderation_state = 'approved' and exists (select 1 from public.rooms r where r.id = room_id and r.visibility = 'public' and r.active));
create policy canon_public_read on public.canon_entries for select to anon, authenticated using (visibility = 'public');
create policy admin_roles_admin_write on public.admin_roles for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy contributions_admin_read on public.contributions for select to authenticated using (private.is_admin());
create policy kill_switches_admin on public.kill_switches for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy restrictions_admin on public.actor_restrictions for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy audit_admin_read on public.admin_audit_events for select to authenticated using (private.is_admin());
create policy protocol_admin_read on public.protocol_events for select to authenticated using (private.is_admin());
create policy provider_config_admin on public.provider_configurations for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy provider_usage_admin_read on public.provider_usage_events for select to authenticated using (private.is_admin());
create policy cost_admin_read on public.cost_events for select to authenticated using (private.is_admin());
create policy health_admin_read on public.system_health_snapshots for select to authenticated using (private.is_admin());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.actors, public.rooms, public.signals, public.messages, public.canon_entries to anon;
grant select on public.actors, public.rooms, public.signals, public.messages, public.canon_entries to authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.admin_roles, public.kill_switches, public.actor_restrictions, public.provider_configurations to authenticated;
grant select on public.contributions, public.admin_audit_events, public.protocol_events, public.provider_usage_events, public.cost_events, public.system_health_snapshots to authenticated;

commit;
