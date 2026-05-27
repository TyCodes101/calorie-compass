# Phase 6B App Store Connect Readiness Evidence

This document tracks App Store Connect readiness evidence for TestFlight and eventual App Store review. It starts incomplete. Do not mark any item complete without manual App Store Connect / Apple Developer evidence.

## Status

- App Store Connect readiness: **not verified**
- TestFlight readiness claimed: **No**
- App Store submission readiness claimed: **No**
- Phase 7 started: **No**

## App Metadata Evidence

| Item | Evidence | Status | Notes |
| --- | --- | --- | --- |
| App name | Not verified | Incomplete | Confirm in App Store Connect. |
| Bundle ID | Not verified | Incomplete | Must match Xcode and backend Apple audience. |
| SKU | Not verified | Incomplete | App Store Connect only. |
| Primary category | Not verified | Incomplete | Recommended: Health & Fitness only after review. |
| Secondary category | Not verified | Incomplete | Optional. |
| Age rating | Not verified | Incomplete | Confirm nutrition/health app responses. |
| Copyright | Not verified | Incomplete | Confirm owner/legal name. |
| App icon | Not verified | Incomplete | Final assets required. |

## URLs and Support Evidence

| Item | URL / evidence | Status | Notes |
| --- | --- | --- | --- |
| Production privacy URL | Not verified | Incomplete | Must be public and accurate. |
| Production support URL | Not verified | Incomplete | Must be public and monitored. |
| Marketing URL | Not verified | Optional | Only if used. |
| Account deletion support path | Not verified | Incomplete | Must match in-app/backend behavior. |
| Nutrition/health disclaimer location | Not verified | Incomplete | Confirm visible in app/support docs. |

## Privacy Labels Evidence

| Data category | Collected? | Linked to user? | Used for tracking? | Evidence / notes | Status |
| --- | --- | --- | --- | --- | --- |
| Contact info | Not verified | Not verified | No tracking intended | Account email may exist after Apple sign-in. | Incomplete |
| Health/fitness/nutrition data | Not verified | Not verified | No tracking intended | Meals/macros/profile goals require careful labeling. | Incomplete |
| User content | Not verified | Not verified | No tracking intended | Meal text/preferences may qualify. | Incomplete |
| Identifiers | Not verified | Not verified | No tracking intended | Backend session/user IDs; no ad ID intended. | Incomplete |
| Diagnostics | Not verified | Not verified | Not verified | No telemetry SDK added in repo; hosting logs may exist. | Incomplete |
| Purchases | No | No | No | Premium/subscriptions not implemented. | Incomplete |
| Location | No | No | No | No location feature known. | Incomplete |

A privacy label owner must verify final answers against actual production behavior before any submission claim.

## Account Deletion Evidence

| Requirement | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Delete action findable in app | Not verified | Incomplete | Signed-in Profile flow. |
| Delete requires explicit confirmation | Not verified | Incomplete | Destructive dialog exists; needs device evidence. |
| Delete scope explained | Not verified | Incomplete | Signed-in account backend data. |
| Backend deletes/revokes expected data | Not verified | Incomplete | Requires test account evidence. |
| Local session clears after delete | Not verified | Incomplete | Requires device evidence. |
| User returns to guest mode after delete | Not verified | Incomplete | Requires device evidence. |
| Support/privacy docs align | Not verified | Incomplete | Requires public URLs. |
| App Store policy owner reviewed | Not verified | Incomplete | Manual review required. |

## Review Notes Drafting Evidence

| Item | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Demo/test credentials needed? | Not verified | Incomplete | Apple sign-in may require reviewer guidance. |
| Backend environment for review | Not verified | Incomplete | Must be stable and production-like. |
| Account deletion notes | Not verified | Incomplete | Explain signed-in Profile delete flow. |
| Nutrition disclaimer notes | Not verified | Incomplete | Avoid medical/dietary claims. |
| Known limitations/deferrals | Not verified | Incomplete | Do not overclaim TestFlight/App Store readiness. |

## Screenshot Evidence

| Screenshot | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Guest Dashboard | Not captured | Incomplete | Avoid private data. |
| Meal Logger | Not captured | Incomplete | Show safe sample meal. |
| History | Not captured | Incomplete | Safe sample data only. |
| Profile guest mode | Not captured | Incomplete | Optional sign-in copy. |
| Profile signed-in account tools | Not captured | Incomplete | Avoid Apple ID/private data. |
| Account deletion confirmation | Not captured | Internal only | Capture only if useful for QA; avoid App Store screenshots unless approved. |

## Final App Store Connect Gate

Before marking ready:

- [ ] Privacy URL is live and accurate.
- [ ] Support URL is live and monitored.
- [ ] Privacy labels reviewed against real data behavior.
- [ ] Account deletion flow verified on real device/backend.
- [ ] Review notes drafted and approved.
- [ ] Screenshots approved.
- [ ] Age rating/category approved.
- [ ] Final app icon approved.
- [ ] No premium/subscription metadata is configured unless product work has actually started and been approved.

If any box is unchecked, App Store submission readiness is **not claimed**.
