# M1 Hardening

## What changed
- RLS policies on `family_photos`, `media_uploads`, `wellbeing_logs` (family-scoped).
- Storage policies for `family-media` bucket (path prefix by family_id).
- Unique constraint on `calls.conversation_id` for idempotency.
- New Edge Function `elevenlabs-webhook` with HMAC verification and upsert.

## Deploy
1. `supabase db push`
2. `supabase functions deploy elevenlabs-webhook`
3. In ElevenLabs console, enable **Post-call Webhooks** and set the URL to this function. Store `ELEVENLABS_WEBHOOK_SECRET` in project env.

## Test plan
- Send a signed POST (valid signature) → 200 OK, rows created.
- Replay same event → 200 OK, no duplicates (unique on conversation_id).
- Invalid signature → 401.

## Notes
- No secrets are committed; `.env.example` lists names only.
- If your schema uses `household_id/tenant_id` instead of `family_id`, policies should be adapted accordingly.

## Fix M1 (RLS & Idempotency)
- Enabled **RLS on family_photos** (policies now effective).  
- Added **RLS policies on wellbeing_logs** (health data, household-scoped via relatives table).  
- Moved idempotency to **calls.conversation_id** via a **UNIQUE INDEX** (partial on `IS NOT NULL` to avoid NULL duplicates).  
- Added indexes to support RLS lookups.  

### Notes
- RLS must be **enabled** on public tables to be enforced.  
- In Postgres, **UNIQUE allows multiple NULLs**; hence we used a partial unique index or ensure column is NOT NULL before adding a UNIQUE constraint.  
- For zero-downtime, prefer **CREATE UNIQUE INDEX CONCURRENTLY** then bind as a constraint if the column is NOT NULL.

## RLS Audit
Use this query to detect tables with RLS enabled but no policies:

```sql
select n.nspname as schema, c.relname as table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public' and c.relrowsecurity = true
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = n.nspname and p.tablename = c.relname
  );
```
Result should be empty after this fix. RLS must be enabled *and* policies must exist for exposed tables.

## Internal-only table: invite_rate_limiter
- RLS is enabled and explicit-deny policies are defined for client roles (`authenticated`, `anon`).
- Access happens **only** via Edge Functions using the **service_role** key, which bypasses RLS. Never use service_role in the browser. 
- Reference: Supabase RLS & service role bypass docs.