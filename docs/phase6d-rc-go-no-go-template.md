# Phase 6D Release-Candidate Go / No-Go Template

Use this template only after real QA evidence has been collected. Do not mark `Go` without Mac/Xcode, real-device, and release-owner evidence.

## Decision Header

- Decision date/time:
- Release owner:
- QA owner:
- Git commit SHA:
- App version/build number:
- Backend environment:
- Decision: No-go / Conditional go / Go
- Final recommendation:

## Manual Evidence Summary

| Evidence area | Status | Evidence link/location | Notes |
| --- | --- | --- | --- |
| Latest main pulled | Not started | TBD | Record SHA. |
| Xcode project opens | Needs Mac/Xcode | TBD | Required. |
| Bundle ID/team/signing verified | Needs Apple Developer access | TBD | Required. |
| Simulator build/run | Needs Mac/Xcode | TBD | Required. |
| Real iPhone build/run | Needs real iPhone | TBD | Required before readiness claim. |
| Backend production URL verified | Not started | TBD | Required. |
| Guest smoke test | Not started | TBD | Required; must remain unblocked. |
| Meal logging smoke test | Not started | TBD | Required. |
| Dashboard/history/profile smoke test | Not started | TBD | Required. |
| Sign in with Apple smoke test | Needs Apple Developer access | TBD | Required for auth confidence. |
| Backend session persistence | Not started | TBD | Required. |
| Account lifecycle migration/export/delete | Not started | TBD | Required before account-readiness claim. |
| Offline/network smoke test | Not started | TBD | Required. |
| Accessibility smoke test | Not started | TBD | Required. |
| Screenshot capture | Not started | TBD | Required before App Store assets. |
| TestFlight archive/upload | Blocked | TBD | Not complete. |
| Internal TestFlight install | Blocked | TBD | Not complete. |

## Critical Blocker List

Critical blockers block TestFlight upload.

| ID | Issue | Owner | Status | Evidence | Required action |
| --- | --- | --- | --- | --- | --- |
| TBD | Mac/Xcode manual QA not completed | TBD | Open | TBD | Execute QA packet. |
| TBD | Bundle ID/signing/team verification not completed | TBD | Open | TBD | Verify in Xcode/Apple Developer. |
| TBD | TestFlight upload not completed | TBD | Open | TBD | Archive/upload after approval. |

## High-Risk Issues

High-risk issues block safe internal testing.

| ID | Issue | Owner | Status | Evidence | Required action |
| --- | --- | --- | --- | --- | --- |
| TBD | Real iPhone QA not completed | TBD | Open | TBD | Execute real-device QA. |
| TBD | Account deletion compliance not verified | TBD | Open | TBD | Verify app behavior and policy metadata. |
| TBD | Internal TestFlight install not completed | TBD | Open | TBD | Install from processed build. |

## Known Limitations / Accepted Deferrals

| Item | Severity | Deferral rationale | Owner approval | Notes |
| --- | --- | --- | --- | --- |
| Premium/subscriptions intentionally not started | Low | Out of current RC scope | TBD | Do not add subscription metadata. |
| External App Store submission readiness not claimed | High | Manual App Store Connect evidence missing | TBD | Must remain no-go for submission. |

## App Store Connect Readiness

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| App name/subtitle/category | Not started | TBD | Manual ASC verification required. |
| Age rating | Not started | TBD | Manual ASC verification required. |
| Privacy labels | Not started | TBD | Must match real data behavior. |
| Health/nutrition disclaimer | Not started | TBD | Avoid medical claims. |
| Support URL | Not started | TBD | Must be live. |
| Privacy URL | Not started | TBD | Must be live and accurate. |
| Account deletion notes | Not started | TBD | Must match in-app flow. |
| Review notes | Not started | TBD | Include Sign in with Apple guidance if needed. |
| Export/delete availability | Not started | TBD | Verify signed-in account tools. |
| Internal tester group | Not started | TBD | Manual ASC verification required. |
| Build/version number tracking | Not started | TBD | Record archive/upload build. |

## TestFlight Upload Readiness

| Gate | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Clean archive created | Not started | TBD | Requires Mac/Xcode. |
| Archive uploaded | Not started | TBD | Requires Apple Developer/ASC. |
| Build processed | Not started | TBD | Requires ASC. |
| Internal tester group assigned | Not started | TBD | Requires ASC. |
| Internal install launched | Not started | TBD | Requires TestFlight/iPhone. |

## Final Recommendation

Recommendation: No-go / Conditional go / Go

Rationale:

- 

Required fixes before go:

- 

Accepted deferrals:

- 

Approvals:

- Release owner:
- QA owner:
- Product owner:

## Current Default Decision

Until this template is filled with real evidence, the default decision is **No-go** for TestFlight readiness and **No-go** for App Store submission readiness.
