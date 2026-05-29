# [AGENTS.md](http://AGENTS.md)

Guidance for AI coding agents working in this repository.

## Priority Rules

When rules conflict, follow this order:

1. Safety and data protection.
2. Tenant isolation and RLS correctness.
3. User-requested scope.
4. Token-saving rules.
5. Style and formatting preferences.

Do not broaden the task unless the user explicitly asks.

## Tech Stack

- Next.js 14 App Router, React 18, TypeScript strict mode, Tailwind CSS.
- Supabase for Auth, Postgres, Storage, Realtime, RLS, and migrations.
- Go 1.22 print agent in `apps/print-agent` for ESC/POS LAN TCP and Windows USB printing.
- Deployed on Vercel.
- CI uses Node 20 and npm.

## Package Manager

- Use **npm**.
- `package-lock.json` is committed.
- Use `npm ci` in clean or CI environments.
- Do not use yarn, pnpm, or bun unless explicitly requested.
- Go commands must be run through Docker because Go may not be installed locally.
- Do not ask the user to install Go locally unless explicitly requested.

## Common Commands

```bash
npm run dev
```

Start Next.js on `0.0.0.0:3000` (loads `.env.local.supabase` — local Supabase).

```bash
npm run cloud
```

Start Next.js against cloud Supabase (uses `.env.local`).

```bash
npm run lint
```

Run Next.js / TypeScript ESLint checks.

```bash
npm run build
```

Run production build. Requires placeholder or real Supabase environment variables.

```bash
npm run print
npm run printstop
npm run printlog
```

Local print-agent Docker development helpers.

```bash
supabase db push
```

Apply migrations after `supabase link`.

## Print-Agent Commands

The local machine may not have Go installed. Use Docker for all Go tooling.

Run from the repository root.

```bash
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go test ./...
```

Run print-agent unit tests.

```bash
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go vet ./...
```

Run Go static checks.

```bash
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent -e GOOS=windows -e GOARCH=amd64 golang:1.22 go build -o /dev/null .
```

Run CI Windows cross-compile gate.

Do not run local `go test`, `go vet`, or `go build` commands.

## Folder Structure

- `src/app` — App Router pages, layouts, and route handlers.
- `src/app/api` — API routes; many use server-only Supabase/admin clients.
- `src/components` — UI and feature components grouped by area: menu, dashboard, kitchen, waiter, staff.
- `src/lib` — Shared business logic, Supabase clients, auth, printing, i18n, and validation.
- `src/types` — Shared TypeScript types.
- `supabase/migrations` — Ordered database migrations. Append new migrations; do not edit applied history.
- `supabase/seed.sql` — Optional seed data.
- `apps/print-agent` — Go print agent, tests, Windows installer files, and local dev tooling.
- `docs` — Durable design and implementation notes.

## Coding Rules

- Prefer existing patterns in nearby files.
- Keep changes scoped to the requested behavior.
- Use the `@/*` path alias for imports from `src`.
- Keep server-only Supabase/service-role logic in server code and route handlers.
- Never expose service keys to client components.
- Preserve tenant boundaries. Restaurant-scoped queries and print-job APIs must filter by authenticated restaurant context.
- Use existing UI primitives from `src/components/ui` and existing brand/Tailwind tokens.
- Keep table identity rules intact:
  - `table_id` is the stable UUID.
  - `display_name` is the human label.
- For print payloads that reference tables, include both `table_id` and `display_name`.
- Do not revive legacy `table_number`.
- For Go code:
  - Use Docker commands from the **Print-Agent Commands** section.
  - Keep standard `gofmt` formatting.
  - Add focused table-driven tests for parser/routing behavior.

## Database Context

- For database structure, read `docs/ai-schema.md` first.
- Do not inspect `supabase/migrations/` unless exact SQL, migration history, RLS definitions, indexes, generated columns, or defaults are required.
- If exact database details are needed, inspect only the specific relevant migration or schema section.
- Do not scan all migrations to answer general schema questions.
- If database schema changes, update `docs/ai-schema.md` in the same change.

## Testing Rules

- For web changes, run:

```bash
npm run lint
```

- Run production build only when touching routes, server code, environment-dependent code, build config, or shared types:

```bash
npm run build
```

- For print-agent changes, run:

```bash
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go test ./...
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent golang:1.22 go vet ./...
docker run --rm -v "$PWD:/repo" -w /repo/apps/print-agent -e GOOS=windows -e GOARCH=amd64 golang:1.22 go build -o /dev/null .
```

- For migration/RLS changes:
  - Inspect policies carefully.
  - Verify tenant isolation paths.
  - Do not test only happy paths.
- There is no broad web unit-test suite.
- Add targeted tests only where the repo already supports them or where risk justifies setup.
- Do not run full-project test/build loops repeatedly. If a command fails, summarize the relevant error and fix the narrow cause before rerunning.

## Dangerous Areas To Avoid

- Do not commit:
  - `.env.local`
  - real Supabase keys
  - JWT secrets
  - pairing codes
  - restaurant/customer data
- Do not edit old Supabase migrations unless explicitly repairing local history.
- Create a new timestamped migration instead.
- Avoid weakening:
  - RLS
  - service-role boundaries
  - staff auth
  - print-agent JWT checks
  - rate limits
- Do not print or expose table UUIDs on receipts.
- Paper output should use `display_name`.
- Be careful with checkout, billing, table transfer/merge, auto-close sessions, and print-job claiming. These affect money or live operations.
- Do not hard-delete restaurant tables or live operational records unless the product flow explicitly requires it.

## 🪙 Token Saving & Output Rules (CRITICAL)

These rules are mandatory. They exist to reduce wasted context and prevent broad, unfocused edits.

### Plan Before Tool Use

- Before using tools or opening files, state the intended search/edit plan in 2–4 bullets.
- The plan must include:
  - what needs to be found
  - which search terms or file paths will be used
  - what files may need editing
- Do not start broad exploration without a plan.

### Search First, Read Later

- Before reading file contents, run a targeted semantic search or filename search.
- Do not open files only to “understand the project.”
- Open files only when each file has a clear reason to be relevant.
- Do not read or recursively scan entire directories.

### Strict File Targeting

- Default maximum: inspect 3–5 files.
- If more than 5 files seem necessary, stop and explain:
  - why more files are needed
  - which files will be opened
  - what specific question each file answers
- Do not continue broad exploration without user confirmation.
- If the relevant file is unclear, ask for the specific file path instead of scanning broadly.
- Before editing, list the exact files you plan to inspect or modify.

### Output Rules

- Be concise.
- Keep explanations to an absolute minimum.
- Before code, state the approach in 1–2 sentences maximum.
- Prefer minimal Git diffs/patches for surgical code changes.
- Use standard Git diff format when practical:
  - `+` for additions
  - `-` for deletions
- Do not output or rewrite an entire file unless explicitly necessary.
- If a full file rewrite is necessary, explain why before outputting it.
- Use standard comments to mark unchanged sections:
  - `// ... existing code ...`
  - `# ... existing code ...`

### No Large Dumps

- Do not paste large logs, full schemas, full files, or full command outputs into the response.
- Summarize only the relevant lines.
- For long command output, show the error block and 5–10 lines of surrounding context only.
- Do not dump generated files into the response when a downloadable file or patch is more appropriate.

## Additional Safety Rules

### Stop When Uncertain

- If the required file, behavior, schema detail, or product requirement is unclear, stop and ask a focused question.
- Do not infer missing business rules from unrelated files.
- Do not make broad architectural changes to solve unclear requirements.

### Dependency Changes

- Do not add, remove, or upgrade npm packages unless explicitly requested.
- Do not change `package-lock.json` unless a dependency change is approved.
- Prefer existing utilities and patterns before introducing new dependencies.

### Migration Safety

- Never edit an already-applied migration unless explicitly instructed.
- Create a new timestamped migration for schema changes.
- For RLS changes, explain the tenant-isolation impact before editing.
- For public policies, explicitly state why public access is safe.
- If a table contains restaurant/customer/order/billing data, assume tenant isolation is required unless proven otherwise.

### Command Safety

- Do not run destructive commands without explicit approval.
- This includes:
  - `rm -rf`
  - database reset commands
  - migration repair commands
  - force push
  - deleting branches
  - clearing storage buckets
- Prefer dry-run or read-only commands first when available.

### Secrets and Environment Safety

- Do not print environment variables, tokens, cookies, JWTs, service-role keys, or connection strings.
- If a command output contains secrets, redact them before summarizing.
- Use placeholder values in examples.

## Preferred Workflow For AI Agents

1. Read the user request carefully.
2. Identify the smallest relevant area of the codebase.
3. State a short search/edit plan.
4. Use semantic search or filename search before opening files.
5. Open only the top 3–5 relevant files.
6. List the files that will be inspected or modified.
7. Make surgical changes.
8. Output a minimal Git diff or focused code snippets.
9. State which checks should be run.
10. Avoid full-project scans unless explicitly requested.

## Failure Mode To Avoid

Do not browse the repository blindly, recursively scan directories, rewrite whole files, dump large code blocks, add dependencies, or run destructive commands. These waste context and increase the chance of incorrect or unsafe edits.