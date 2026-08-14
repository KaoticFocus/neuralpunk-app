-- Netlify Functions use a server-only secret key, which assumes service_role.
-- Explicit grants are required independently of RLS on new Supabase projects.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
