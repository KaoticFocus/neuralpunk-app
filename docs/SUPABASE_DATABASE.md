# Supabase database foundation

Neuralpunk uses one Supabase Postgres database. The versioned schema is in `supabase/migrations`; reference seed data is in `supabase/seed.sql`. The JSON store remains the runtime fallback until a Deploy Preview proves the database adapter.

## Security boundary

- RLS is enabled on every public table and public roles receive explicit, least-privilege grants.
- Anonymous access is limited to approved public actors, active public rooms/signals, approved messages in active public rooms, and public canon metadata.
- Control Room, audit, restriction, provider, cost, and health data are denied to anonymous callers.
- Administrative authorization uses protected `admin_roles`, never user-editable metadata.
- `private.is_admin()` is the single documented `SECURITY DEFINER` exception. It lives in an unexposed schema, requires `auth.uid()`, uses an empty search path, and is executable only by `authenticated`.
- Provider secrets are not database data. They remain server-only Netlify environment variables.

## Local verification

Install Docker and the Supabase CLI, then run:

```bash
supabase start
supabase db reset
supabase test db supabase/tests/database_foundation.sql
supabase db lint --level error
```

The SQL tests require pgTAP supplied by the local Supabase stack. They prove an allowed anonymous public read, a denied anonymous administrative read, RLS coverage, and the canon-mutability constraint.

## Remote application

Link only after confirming the Neuralpunk project reference in the Supabase dashboard:

```bash
supabase login
supabase link --project-ref <confirmed-neuralpunk-project-ref>
supabase migration list
supabase db push --dry-run
supabase db push
```

Do not link or push to a similarly named project by inference. After application, run both Security and Performance Advisors and verify Data API grants separately from RLS. New Supabase projects no longer expose new public tables automatically, so this migration contains explicit grants for the intentionally public surface.
