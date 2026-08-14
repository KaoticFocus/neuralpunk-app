begin;

create index admin_roles_granted_by_idx on public.admin_roles (granted_by) where granted_by is not null;
create index rooms_creator_actor_idx on public.rooms (creator_actor_id) where creator_actor_id is not null;
create index signals_room_idx on public.signals (room_id);
create index signals_origin_actor_idx on public.signals (origin_actor_id) where origin_actor_id is not null;
create index signals_provenance_idx on public.signals (provenance_id) where provenance_id is not null;
create index messages_actor_idx on public.messages (actor_id) where actor_id is not null;
create index messages_provenance_idx on public.messages (provenance_id);
create index messages_parent_idx on public.messages (parent_message_id) where parent_message_id is not null;
create index canon_entries_provenance_idx on public.canon_entries (provenance_id) where provenance_id is not null;
create index contributions_origin_actor_idx on public.contributions (origin_actor_id) where origin_actor_id is not null;
create index contributions_provenance_idx on public.contributions (provenance_id);
create index contributions_reviewed_by_idx on public.contributions (reviewed_by) where reviewed_by is not null;
create index kill_switches_updated_by_idx on public.kill_switches (updated_by);
create index actor_restrictions_created_by_idx on public.actor_restrictions (created_by);
create index actor_restrictions_ended_by_idx on public.actor_restrictions (ended_by) where ended_by is not null;
create index admin_audit_actor_idx on public.admin_audit_events (actor_profile_id, created_at desc);
create index protocol_actor_idx on public.protocol_events (actor_id, created_at desc) where actor_id is not null;
create index provider_usage_actor_idx on public.provider_usage_events (actor_id, created_at desc) where actor_id is not null;
create index cost_actor_idx on public.cost_events (actor_id, created_at desc) where actor_id is not null;

drop policy actors_public_read on public.actors;
drop policy actors_owner_read on public.actors;
create policy actors_public_read on public.actors for select to anon using (public_profile and status = 'active');
create policy actors_authenticated_read on public.actors for select to authenticated
  using ((public_profile and status = 'active') or profile_id = (select auth.uid()) or private.is_admin());

drop policy rooms_public_read on public.rooms;
drop policy rooms_authenticated_read on public.rooms;
create policy rooms_public_read on public.rooms for select to anon using (visibility = 'public' and active);
create policy rooms_authenticated_read on public.rooms for select to authenticated
  using ((visibility = 'public' and active) or visibility = 'authenticated' or private.is_admin());

drop policy signals_public_read on public.signals;
drop policy signals_authenticated_read on public.signals;
create policy signals_public_read on public.signals for select to anon using (visibility = 'public' and active);
create policy signals_authenticated_read on public.signals for select to authenticated
  using ((visibility = 'public' and active) or visibility = 'authenticated' or private.is_admin());

drop policy admin_roles_admin_write on public.admin_roles;
create policy admin_roles_admin_insert on public.admin_roles for insert to authenticated with check (private.is_admin());
create policy admin_roles_admin_update on public.admin_roles for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admin_roles_admin_delete on public.admin_roles for delete to authenticated using (private.is_admin());

commit;
