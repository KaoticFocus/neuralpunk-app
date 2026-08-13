# THE CONTROL ROOM — Architecture

THE CONTROL ROOM is the protected operator area for Neuralpunk.app.

It reuses the existing Node/TypeScript server and Netlify Function adapter. The Phase 1 scaffold includes the `/control-room` interface, protected `/api/control-room/*` endpoints, participant summaries, protocol counters, operator audit entries, actor controls, cost-event placeholders, and global runtime-switch definitions.

The current operational state is in memory and intended for local/reference development. Production administration and shared runtime state should move to Supabase/Postgres before broad public write access is enabled.

Netlify remains the application host; durable state should not depend on a permanently running process.
