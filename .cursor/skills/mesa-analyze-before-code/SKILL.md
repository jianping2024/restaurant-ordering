---
name: mesa-analyze-before-code
description: >-
  Mesa analyze-before-code workflow with end-state shape, reuse checklist,
  branch isolation, and one-representation verification. Use when the user says
  先分析/plan first, or for non-trivial behavior/multi-layer changes before editing.
---

# Mesa: analyze before code

## Overview

Do not edit first on non-trivial work. Analyze the full business flow, lock an **end-state shape**, get confirmation, then implement once — no copy-then-dedupe.

Hard phrase gate and short always-on summary: `.cursor/rules/analysis-before-code.mdc`.

## When to use

- User said: `先分析` / `先方案` / `不要直接改` / `先别改` / `等确认再改` / `analyze first` / `plan first` / `don't change code yet` / `do not edit yet`
- Behavior bugs, state machines, checkout/session/order/print
- Changes touching UI + API + DB or multiple modules

**Skip** (no trigger phrase): typo/one-line apply; format/lint/docs-only; plan already approved in-thread.

## Process

### Analyze turn (no code)

1. Do not edit, create implementation branches, or mutate.
2. Output these **exact** headings in order:

### 1. 当前业务流程和状态流转
### 2. 问题根因
### 3. 推荐方案和理由
### 4. 需要修改的文件/组件
### 5. 风险点和验证方式

3. Under heading 3:
   - Prefer robust end-to-end design; reject temporary if/else patches.
   - **End-state shape (1–2 sentences):** after this change, how each owned concept is represented (e.g. “a step is `{ title, body }` in one `steps[]`; guest label is `bill.guest`”). Do not plan “add fields onto a shape that remaps/duplicates.” End-state wins over minimal patch / copy-nearby-layout. Design what remains — no delete/merge inventories.
   - **Reuse checklist** (UI/helpers): search and state findings — reuse ≠ “no new files.”
     1. Same feature domain (nearby screens for the same interaction)
     2. Shared primitives (`apps/web/src/components/ui/*`, `docs/design/03-component-rules.md`)
     3. Existing lib + i18n/`messages` for same calc or **user-visible label**
     4. Verdict: reuse X / extend Y / new Z only if no suitable reuse (one sentence)
4. Heading 4: reused vs new; if new file, what duplication it **removes**.
5. Ask user to confirm before implementing.

### After confirmation

1. State base branch; create/switch from **`main`** (or user-named baseline) without touching other tasks’ WIP. If worktree has unrelated dirty files, use a **separate git worktree** — do not stash their WIP.
2. Implement only the approved plan (end-state shape already).
3. **Implementation gate (answerable from the diff):**
   - No parallel component/helper vs reuse verdict
   - New shared file only if it deleted duplicated call-site logic
   - **One representation:** for each end-state concept, not two live forms (e.g. flat `stepFooTitle` **and** `steps[]`; intro `previewGuest*` **and** `bill.guest`)
4. Checks per `AGENTS.md`. List every manual test: `pass` / `fail` / `skip`.
5. Commit only if user asks. `push` / `ship` / `pnpm push` → follow `.cursor/rules/push-verification.mdc` then `release-and-ci.mdc`.

### Principles

- One representation per business fact; no copy-then-dedupe; touched-file same-concept debt is **in scope** for this diff
- Dedupe must shrink net lines; no helper+wrapper stacks that only move code
- Small complete change set; no drive-by of unrelated modules
- Never `supabase db reset` without explicit in-thread permission

### Retrospective

User-caught redundancy or the same mistake twice → update one line in `AGENTS.md` or this skill in the same change set.

## Verification

Before finishing an implementation turn:

- [ ] Plan (or approved plan) had an **end-state shape** sentence for owned concepts
- [ ] Diff has **one representation** per those concepts (no parallel flat+array / parallel labels)
- [ ] Reuse search covered domain UI + `messages` labels when UI/copy changed
- [ ] Branch/base isolation respected; unrelated WIP untouched
- [ ] `AGENTS.md` checks run; manual items reported pass/fail/skip
- [ ] No commit unless user asked (unless push/ship)
