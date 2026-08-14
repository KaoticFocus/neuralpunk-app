begin;
select plan(8);

select has_table('public','rooms','rooms exists');
select has_table('public','messages','messages exists');
select has_table('public','admin_audit_events','audit events exist');
select ok((select relrowsecurity from pg_class where oid='public.rooms'::regclass),'rooms has RLS');
select ok((select relrowsecurity from pg_class where oid='public.admin_audit_events'::regclass),'audit has RLS');

set local role anon;
select is((select count(*) from public.rooms where id='room-cognitive-refusal'),1::bigint,'anon can read the public reference room');
select throws_ok('select count(*) from public.admin_audit_events','42501',null,'anon cannot read audit events');
reset role;

select throws_ok($$insert into public.contributions(title,body,state,origin_type,provenance_id,canon_mutable) values ('bad','bad','PROPOSED','external_ai','10000000-0000-4000-8000-000000000001',true)$$,'23514',null,'external contribution cannot become canon-mutable');

select * from finish();
rollback;
