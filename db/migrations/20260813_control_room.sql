-- THE CONTROL ROOM production persistence target for Supabase/Postgres.
-- No public policies are defined here. Admin/service access must be configured explicitly.

create table if not exists control_room_audit (
  id uuid primary key,
  actor_id text not null,
  actor_type text not null,
  action text not null,
  target text,
  result text not null,
  source text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists control_room_audit_actor_idx on control_room_audit(actor_id, created_at desc);

create table if not exists control_room_actor_controls (
  id uuid primary key,
  actor_id text not null,
  action text not null,
  reason text not null,
  admin_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists control_room_actor_controls_active_idx on control_room_actor_controls(actor_id, active);

create table if not exists control_room_switches (
  name text primary key,
  enabled boolean not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists control_room_protocol_events (
  id uuid primary key,
  protocol text not null,
  actor_id text not null,
  action text not null,
  authorization text not null,
  status integer not null,
  created_at timestamptz not null default now()
);
create index if not exists control_room_protocol_events_recent_idx on control_room_protocol_events(protocol, created_at desc);

create table if not exists control_room_cost_events (
  id uuid primary key,
  provider text not null,
  service text not null,
  actor_id text not null,
  estimated_cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists control_room_cost_events_recent_idx on control_room_cost_events(created_at desc);

alter table control_room_audit enable row level security;
alter table control_room_actor_controls enable row level security;
alter table control_room_switches enable row level security;
alter table control_room_protocol_events enable row level security;
alter table control_room_cost_events enable row level security;
