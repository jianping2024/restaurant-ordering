# Print job `claimed_by` enforcement — phased fix plan

**Issue (medium):** Any paired device in a restaurant can complete or fail another device’s claimed print job.

**Root cause:** `PATCH /api/print-agent/jobs/[id]` enforces `restaurant_id` and status transitions for `done` and `processing` → `failed`, but does not require `claimed_by = ctx.device_id` on those updates.

**Primary file:** `src/app/api/print-agent/jobs/[id]/route.ts` (lines 82–114).

**Suggested fix (high confidence):** Add `.eq('claimed_by', ctx.device_id)` to Supabase updates for `done` and for `failed` when `current === 'processing'`.

**Out of scope for this fix:** Database migration, RLS policy changes, print-agent binary changes (unless verification finds regressions).

---

## Phase 1 — Confirm vulnerability and baseline behavior

### Goal

Prove the cross-device `done` / `failed` issue exists today and record expected HTTP codes and DB state before changing code.

### Files affected

| File | Role |
|------|------|
| `src/app/api/print-agent/jobs/[id]/route.ts` | Read-only: understand transitions |
| `docs/ai-schema.md` | Reference `print_jobs.claimed_by` |
| (No code edits) | |

### Risk level

**Low** — read-only investigation; no production impact.

### What will be changed

Nothing in the repository. Optional: short notes in this doc’s “Baseline” subsection with observed status codes.

### What must not be changed

- Route handler logic
- Paired devices, JWTs, or `print_jobs` rows in production (use dev/staging only)

### Manual tests required

Prerequisites: one restaurant, two paired print agents (device A and device B) with distinct `device_id` values and valid `agentjwt` tokens; one `print_jobs` row in `pending` (e.g. test receipt or dashboard retry).

1. **Device A claims job:** `PATCH` job with `{ "status": "processing" }` using A’s JWT.  
   - Expect `200`, `status: processing`, `claimed_by` = A’s `device_id`.
2. **Device B completes A’s job (vulnerability):** `PATCH` same job with `{ "status": "done" }` using B’s JWT.  
   - **Current (bug):** `200`, job becomes `done` while A held the claim.
3. **Repeat for fail:** Reset job to `processing` with `claimed_by` = A (DB or re-queue). B sends `{ "status": "failed", "error_message": "cross-device test" }`.  
   - **Current (bug):** `200`, job `failed` without A printing or failing it.
4. **Sanity — single device still works:** A: `pending` → `processing` → `done`. Expect full `200` chain.

Record job id, `claimed_by`, and response bodies for Phase 4 regression comparison.

---

## Phase 2 — Enforce claim ownership on terminal transitions (core fix)

### Goal

Only the device that set `claimed_by` may move a job from `processing` to `done` or `processing` to `failed`.

### Files affected

| File | Role |
|------|------|
| `src/app/api/print-agent/jobs/[id]/route.ts` | **Only file that must change** for the security fix |

### Risk level

**Low–medium**

- **Low** for normal single-device operation: claim and complete use the same JWT/`device_id`.
- **Medium** if legacy rows exist with `status = 'processing'` and `claimed_by` null or wrong device — those jobs could no longer be completed via API until reset (dashboard retry or manual DB fix). Confirm no such rows in prod before deploy, or accept one-time stuck jobs.

### What will be changed

In `src/app/api/print-agent/jobs/[id]/route.ts`:

1. **`status === 'done'`** (lines 86–92): extend the update filter:
   - `.eq('id', jobId)`
   - `.eq('status', 'processing')`
   - **`.eq('claimed_by', ctx.device_id)`** ← add

2. **`status === 'failed'` when `current === 'processing'`** (lines 104–114): same filter on the update:
   - `.eq('status', current)` (already `processing`)
   - **`.eq('claimed_by', ctx.device_id)`** ← add when `current === 'processing'`

3. **Optional (same phase, same file):** After loading the job, if `current === 'processing'` and `job.claimed_by` is set and `job.claimed_by !== ctx.device_id`, return `403` with `{ error: 'forbidden' }` before attempting update. Requires adding `claimed_by` to the initial `.select(...)`. Improves clarity vs generic `409 optimistic_lock_failed`.

**Do not change** in this phase:

- `processing` claim path (`pending` → `processing`): keep optimistic lock on `status = 'pending'` only; still sets `claimed_by: ctx.device_id`.
- `failed` from `pending` (routing/config failure before print): keep current behavior (may set `claimed_by` on update without prior claim).
- Restaurant check (`job.restaurant_id !== ctx.restaurant_id`).
- JWT verification (`verifyAgentBearer`).
- Response shape for success (`{ ok: true, job }`).
- `apps/print-agent/*` — no change required; agent already treats non-2xx PATCH as error.

### What must not be changed

| Area | Reason |
|------|--------|
| `supabase/migrations/*` | No schema change; `claimed_by` already exists |
| RLS on `print_jobs` | Agent uses service-role admin client; enforcement is app-layer |
| `src/app/api/print-agent/print-jobs/[id]/retry/route.ts` | Owner dashboard retry; different auth (`getOwnerRestaurantId`) |
| Claim/list/heartbeat/pairing routes | Unrelated to PATCH ownership |
| Print-agent release / `VERSION` | No Go changes |
| `docs/ai-schema.md` | Unless documenting behavioral guarantee (optional follow-up) |

### Manual tests required

Use the same two-device setup as Phase 1.

| # | Steps | Expected after fix |
|---|--------|-------------------|
| 1 | A: `pending` → `processing` | `200`, `claimed_by` = A |
| 2 | B: `processing` → `done` | **409** `optimistic_lock_failed` (or **403** if pre-check added); job stays `processing`, `claimed_by` still A |
| 3 | A: `processing` → `done` | `200`, `status: done` |
| 4 | A: new job to `processing`; B: `failed` + `error_message` | **409** (or **403**); job unchanged |
| 5 | A: same job `failed` + message | `200`, `failed` |
| 6 | B: `pending` → `failed` + message (no prior claim) | `200` (pre-print routing failure path unchanged) |
| 7 | Single device: full print flow (claim → print → done) | `200` throughout; agent logs “Last print OK” |
| 8 | Race: A and B both `pending` → `processing` | One `200`, one `409` (unchanged optimistic claim) |

**Verify command shape (example):**

```bash
curl -sS -X PATCH "$BASE/api/print-agent/jobs/$JOB_ID" \
  -H "Authorization: Bearer $DEVICE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}'
```

---

## Phase 3 — Regression checks and operational safety

### Goal

Ensure the fix does not break multi-device happy paths, dashboard retry, or agent error handling.

### Phase 3 status (what we verified in repo)

- **Dashboard retry path clears claim**: `src/app/api/print-agent/print-jobs/[id]/retry/route.ts` sets `claimed_by: null` when re-queuing a failed job.
- **Print agent tolerates `done` PATCH failure**: `apps/print-agent/agent_poll.go` logs `log_mark_done_error` if marking `done` fails and continues running.
- **Repo lint**: `npm run lint` passed (Next.js lint: no warnings/errors).
- **Automated manual matrix** (`node scripts/verify-print-agent-claimed-by.mjs`): 11/11 passed against local `http://127.0.0.1:3000` (2026-05-29).

### Files affected

| File | Role |
|------|------|
| `src/app/api/print-agent/jobs/[id]/route.ts` | Verify only Phase 2 edits present |
| `apps/print-agent/agent_poll.go` | Read-only: confirm agent handles failed `done` PATCH (logs `log_mark_done_error`) |
| `src/app/api/print-agent/print-jobs/[id]/retry/route.ts` | Read-only: owner retry still clears `claimed_by` |

### Risk level

**Low** — validation and lint/build only.

### What will be changed

No functional code unless Phase 2 testing finds a gap. Run project checks:

```bash
npm run lint
```

Run `npm run build` only if other server routes or shared types were touched in the same PR (Phase 2 alone is a single route file; lint is the minimum bar per AGENTS.md).

### What must not be changed

- Broad refactors of print-agent polling or queue logic
- New npm dependencies
- Print-agent `VERSION` or release workflow

### Manual tests required

1. **Dashboard retry:** Failed job → owner retry → `pending`, `claimed_by` null → any device can claim again.
2. **Device revocation (if enabled in env):** Revoked device cannot PATCH (existing `401`); unrelated to this fix but smoke-test so Phase 2 didn’t break auth order.
3. **Stuck `processing`:** If A crashes after claim, B must **not** be able to force `done`/`failed`; job remains until retry/TTL/product policy (document as accepted behavior unless a separate “steal claim” feature is added later).

---

## Phase 4 — Ship web fix

### Goal

Deploy the API change to production via normal web release process.

### Files affected

- Git: commit containing Phase 2 change only (recommended).
- Vercel production deployment (via `main`).

### Risk level

**Low** for deploy mechanics; **medium** business impact only if many stuck `processing` jobs exist (see Phase 2).

### What will be changed

- Merge/push to `main` per team workflow (`npm run push` or equivalent when user requests ship).
- No print-agent tag required (no `apps/print-agent` changes).

### What must not be changed

- `print-agent-release.yml` or agent installer
- Database migrations

### Manual tests required

Post-deploy smoke on production or staging:

1. One real paired agent: enqueue test print → completes `done`.
2. If two agents available: repeat Phase 2 test #2 (B cannot complete A’s job).

---

## Summary

| Phase | Delivers |
|-------|----------|
| 1 | Documented proof of cross-device PATCH |
| 2 | **Security fix** — `claimed_by` on `done` and `processing`→`failed` updates |
| 3 | Lint + multi-path regression |
| 4 | Production deploy |

**Implementation size:** Small surgical diff in one route file (~2–6 lines of `.eq('claimed_by', ...)` plus optional select/pre-check).

**No migration** — enforcement is entirely in the route handler’s conditional updates.
