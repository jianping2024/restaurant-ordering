# ADR-004: On-prem entitlement control plane

- Status: Accepted
- Date: 2026-07-30

## Context

Local (on-prem) stores are the business authority (ADR-001/002). Platform Ops still needs remote suspend, renew (+1m/+1y), and a 7-day offline grace. Cloud SaaS create/suspend must stay unchanged.

## Decision

1. **Two delivery modes** via `restaurants.deployment_mode`: `cloud` | `on_prem`. Create UI must choose; cloud keeps `createRestaurantWithOwner`; on-prem uses `registerOnPremRestaurant` (registry only).
2. **One runtime gate**: `restaurants.suspended_at` + `isRestaurantSuspended()` + existing maintenance UI / `restaurant_suspended`. No second license gate or error code.
3. **One license clock**: `license_valid_until` (renamed from unused `service_valid_until` where present). Extend only via `extendLicenseValidUntil`.
4. **One offline ticket**: signed lease JWT (`license_lease_token`) with `server_time` / `lease_until` (~7d). Materialize via `decideLicenseMaterialize` → write/clear `suspended_at` only.
5. **One install identity**: `restaurant_installations` (pending → claimed | revoked). Not print pairing.
6. **Ops UI single surface**: `/ops/licenses` for extend / suspend / resume / issue-revoke install codes. Restaurant detail only links there.
7. **Upgrade**: offline package only — no upgrade API.
8. **Invoice**: not in product yet; suspend blocks Mesa operations only.

## Consequences

- Platform claim/check-in: `/api/platform/license/claim`, `/api/platform/license/check-in` (install credential, not admin cookie).
- On-prem web reconciles on dashboard enter (lifecycle one-shot): optional platform check-in then materialize — not interval polling of read models.
- Cloud path does not require lease/check-in; may still materialize `license_valid_until` expiry into `suspended_at`.
