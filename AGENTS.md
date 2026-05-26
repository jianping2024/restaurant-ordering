# AGENTS.md

## Tech Stack
- Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS.
- Supabase for Auth, Postgres, Storage, Realtime, RLS, and migrations.
- Go 1.22 print agent in `apps/print-agent` for ESC/POS LAN TCP and Windows USB printing.
- Deployed on Vercel; CI uses Node 20 and npm.

## Package Manager
- Use npm. `package-lock.json` is committed; install with `npm ci` in clean/CI environments.
- Go module commands run from `apps/print-agent`.

## Common Commands
- `npm run dev` - start Next.js on `0.0.0.0:3000`.
- `npm run lint` - run Next/TypeScript ESLint checks.
- `npm run build` - production build; needs placeholder or real Supabase env vars.
- `npm run print`, `npm run printstop`, `npm run printlog` - local print-agent Docker dev helpers.
- `cd apps/print-agent && go test ./...` - print agent unit tests.
- `cd apps/print-agent && go vet ./...` - Go static checks.
- `cd apps/print-agent && GOOS=windows GOARCH=amd64 go build -o /dev/null .` - CI cross-compile gate.
- `supabase db push` - apply migrations after `supabase link`.

## Folder Structure
- `src/app` - App Router pages, layouts, and route handlers.
- `src/app/api` - API routes; many use server-only Supabase/admin clients.
- `src/components` - UI and feature components grouped by area: menu, dashboard, kitchen, waiter, staff.
- `src/lib` - shared business logic, Supabase clients, auth, printing, i18n, validation.
- `src/types` - shared TypeScript types.
- `supabase/migrations` - ordered database migrations; append new migrations, do not edit applied history.
- `supabase/seed.sql` - optional seed data.
- `apps/print-agent` - Go print agent, tests, Windows installer files, and local dev tooling.
- `docs` - durable design and implementation notes.

## Coding Rules
- Prefer existing patterns in nearby files; keep changes scoped to the requested behavior.
- Use the `@/*` path alias for imports from `src`.
- Keep server-only Supabase/service-role logic in server code and route handlers; never expose service keys to client components.
- Preserve tenant boundaries: restaurant-scoped queries and print-job APIs must filter by authenticated restaurant context.
- Use existing UI primitives from `src/components/ui` and existing brand/Tailwind tokens.
- Keep table identity rules intact: `table_id` is the stable UUID, `display_name` is the human label.
- For print payloads that reference tables, include both `table_id` and `display_name`; do not revive legacy `table_number`.
- For Go code, keep standard `gofmt` formatting and add focused table-driven tests for parser/routing behavior.

## Testing Rules
- For web changes, run `npm run lint`; run `npm run build` when touching routes, server code, env-dependent code, or shared types.
- For print-agent changes, run `go test ./...`, `go vet ./...`, and the Windows cross-compile command above.
- For migration/RLS changes, inspect policies carefully and verify tenant isolation paths, not just happy paths.
- There is no broad web unit-test suite; add targeted tests only where the repo already supports them or the risk justifies setup.

## Dangerous Areas To Avoid
- Do not commit `.env.local`, real Supabase keys, JWT secrets, pairing codes, or restaurant/customer data.
- Do not edit old Supabase migrations unless explicitly repairing local history; create a new timestamped migration instead.
- Avoid weakening RLS, service-role boundaries, staff auth, print-agent JWT checks, or rate limits.
- Do not print or expose table UUIDs on receipts; paper output should use `display_name`.
- Be careful with checkout, billing, table transfer/merge, auto-close sessions, and print-job claiming; these affect money or operations.
- Do not hard-delete restaurant tables or live operational records unless the product flow explicitly requires it.
