# ADR-004: On-prem entitlement control plane

- Status: Accepted
- Date: 2026-07-30

## Context

Local (on-prem) stores are the business authority (ADR-001/002). Platform Ops still needs remote suspend, renew (+1d/+1m/+1y or set calendar day), and a 7-day offline grace. Cloud SaaS create/suspend must stay unchanged.

## Decision

1. **Two delivery modes** via `restaurants.deployment_mode`: `cloud` | `on_prem`. Create UI must choose; cloud keeps `createRestaurantWithOwner`; on-prem uses `registerOnPremRestaurant` (registry only — no cloud Auth owner, no store business DB writes).
2. **One runtime gate**: `restaurants.suspended_at` + `isRestaurantSuspended()` + existing maintenance UI / `restaurant_suspended`. No second license gate or error code.
3. **One license clock**: `license_valid_until`. Ops calendar days are **Europe/Lisbon**; stored value is that day's `23:59:59.999` local. Relative renew via `extendLicenseValidUntil`; absolute set via `resolveLicenseCalendarDate` → one write path (`writeRestaurantLicenseValidUntil`).
4. **One offline ticket**: signed lease JWT (`license_lease_token`) with `server_time` / `lease_until` (~7d). Materialize via `decideLicenseMaterialize` → write/clear `suspended_at` only.
5. **One install identity**: `restaurant_installations` (pending → claimed | revoked). Not print pairing. **Platform “claimed” signal is only `restaurant_installations.status === 'claimed'`** — not cloud `restaurants.owner_id`.
6. **Ops UI single surface**: `/ops/licenses` for extend / suspend / resume / issue-revoke install codes. Restaurant detail only links there.
7. **Upgrade**: offline package only — no upgrade API.
8. **Invoice**: not in product yet; suspend blocks Mesa operations only.
9. **Cross-DB claim (store install bridge)** — end-state (must ship; see handoff §1.4):
   - Platform `POST /api/platform/license/claim`: validate install code → mark installation `claimed` → mint lease + `checkinCredential` → return restaurant snapshot (`restaurantId`, slug, ownerEmail, lease, credential). **Must not** `createUser` on platform Auth; **must not** set cloud `restaurants.owner_id` for on-prem.
   - On-prem web **`/setup`**: sole claim UI (install code + owner password). One local apply-claim path: insert local `restaurants` with **the same UUID** as platform `restaurantId` (first claim), or **rebind** lease + platform license config and reset owner password when the local restaurant already has `owner_id` (recovery after lost license file). Pack pre-configures **only** `MESA_PLATFORM_LICENSE_URL`. Platform claim response returns `checkinCredential` + `leaseSecret`; persist the trio to host **`deploy/on-prem/license-state/platform.json`** (compose volume; survives web rebuild). Env lease/checkin must not be required for claim. Missing file + unverifiable lease → fail-closed suspend. Then materialize.
   - Install/upgrade gate: sole `scripts/verify-on-prem-ready.sh` (`install` = URL + runtime essentials; `post-claim` = complete `platform.json` hard-fail; `upgrade` = install checks + validate `platform.json` if present, else warn and continue so `/setup` can recover).
   - Customer suspension copy: sole `licenseSuspensionAction` + web `licenseSuspensionCopy` (renew vs reconfigure `/setup`).
   - Platform claim with a fresh pending install code **revokes** any prior `claimed` installation for that restaurant (re-claim), then marks the new row claimed.
   - On success: redirect to **`/auth/login` only** — **no auto-login**. Owner signs in with registry email + chosen password, then `/dashboard`.
   - On failure: stay on `/setup`; do not create local restaurant.
   - Cloud SaaS first-time `RestaurantOnboarding` on `/dashboard` stays for `cloud` only; on-prem empty store must not use free-name create as a parallel path.

## Consequences

- Platform claim/check-in: `/api/platform/license/claim`, `/api/platform/license/check-in` (install credential, not admin cookie).
- On-prem web reconciles on business boundaries via sole `reconcileRestaurantLicense` (staff login / guest menu+order with `checkIn:false` / dashboard enter with check-in): optional platform check-in then materialize — not interval polling of read models.
- Cloud path does not require lease/check-in; may still materialize `license_valid_until` expiry into `suspended_at`.
- Existing cloud tenants (`deployment_mode=cloud`) are unaffected by the on-prem claim bridge when mode split is preserved.
- Engineering completion / blockers (Mode B pack, gitignore of `deploy/`, `/setup` + apply-claim not yet coded, cloud UAT): see [`../on-prem-handoff.zh.md`](../on-prem-handoff.zh.md).