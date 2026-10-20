# Schema baseline for Mode B

`baseline_public.sql` is a **schema-only** dump of `public` from a green Mesa database
(local `supabase start` at export time). It is required because the historical
`supabase/migrations` chain does not replay cleanly on an empty self-hosted Postgres.

Regenerate after schema-changing migrations land on a green DB **before packing**:

```bash
./scripts/export-schema-baseline.sh
```

That rewrite sets `baseline_covered_migrations.txt` to **every** `supabase/migrations/*.sql` so fresh install **pending=0**.  
`pack-release.sh` **fail-closed** if any migration file is missing from covered (forces tip re-export; do not ship old baseline + long pending).

`apply-migrations.sh`: baseline → mark covered → pending incrementals (ideally none on fresh pack) → **`ensure_realtime_publication.sql` every run**.

Publication membership is **not** in the public dump; covered migrations skip the initial
`ALTER PUBLICATION`. Do not remove the ensure step or the `pack-release.sh` gate.
Ops: `docs/technical/on-prem-pack-install-upgrade.zh.md` §2.3.
