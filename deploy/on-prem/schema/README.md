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

`apply-migrations.sh`:

- **Fresh install** (no `__baseline_public__`): load tip baseline dump → **then** mark covered (dump already has that schema) → pending (ideally 0) → **`ensure_realtime_publication.sql`**.
- **Live upgrade** (`MESA_MIGRATE_INCREMENTAL_ONLY=1`, or re-run when marker already present): **do not** stamp covered. Only run migration files missing from `mesa_schema_migrations` (each file in **one** `psql -1` transaction), then ensure realtime. Stamping covered on upgrade skips SQL and left Pirata without `station_print_*` / `time_slot_id` while the ledger claimed applied (2026-10-21). Without `-1`, `TEMP … ON COMMIT DROP` fails on the next statement (Pirata 2026-10-31).

Publication membership is **not** in the public dump; covered migrations skip the initial
`ALTER PUBLICATION`. Do not remove the ensure step or the `pack-release.sh` gate.
Ops: `docs/technical/on-prem-pack-install-upgrade.zh.md` §2.3.
