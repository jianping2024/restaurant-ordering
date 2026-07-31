# Schema baseline for Mode B

`baseline_public.sql` is a **schema-only** dump of `public` from a green Mesa database
(local `supabase start` at export time). It is required because the historical
`supabase/migrations` chain does not replay cleanly on an empty self-hosted Postgres.

Regenerate after schema-changing migrations land on a green DB:

```bash
./scripts/export-schema-baseline.sh
```

`apply-migrations.sh`: baseline → mark covered → pending incrementals → **`ensure_realtime_publication.sql` every run**.

Publication membership is **not** in the public dump; covered migrations skip the initial
`ALTER PUBLICATION`. Do not remove the ensure step or the `pack-release.sh` gate.
Ops: `docs/technical/on-prem-pack-install-upgrade.zh.md` §2.3.
