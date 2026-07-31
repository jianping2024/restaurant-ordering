# Schema baseline for Mode B

`baseline_public.sql` is a **schema-only** dump of `public` from a green Mesa database
(local `supabase start` at export time). It is required because the historical
`supabase/migrations` chain does not replay cleanly on an empty self-hosted Postgres.

Regenerate after schema-changing migrations land on a green DB:

```bash
./scripts/export-schema-baseline.sh
```

`apply-migrations.sh` loads this baseline, seeds the `menu-images` storage bucket,
and records migration filenames in `mesa_schema_migrations`.
