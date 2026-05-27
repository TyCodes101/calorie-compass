# Phase 6E RC Go / No-Go Tracker

This tracker is the final release-candidate decision sheet for TestFlight upload and internal tester rollout. It starts as **No-go** because no real Mac/Xcode/App Store Connect/iPhone upload evidence has been captured in this environment.

## Decision Header

- Decision date/time: TBD
- Release owner: TBD
- QA owner: TBD
- Product owner: TBD
- Git commit SHA: TBD
- App version/build number: TBD
- Backend environment/base URL: TBD
- Decision: No-go
- Final recommendation: Do not claim TestFlight readiness until required evidence is complete.

## Critical Blockers

Critical blockers prevent TestFlight upload or successful launch.

| ID | Blocker | Status | Owner | Evidence needed | Notes |
| --- | --- | --- | --- | --- | --- |
| P6E-C01 | Mac/Xcode archive not completed | Open | TBD | Archive screenshot/log | Required. |
| P6E-C02 | Bundle ID/signing/team not verified | Open | TBD | Redacted signing/capability evidence | Required. |
| P6E-C03 | App Store Connect build upload not completed | Open | TBD | Upload success evidence | Required. |
| P6E-C04 | Build processing not completed | Open | TBD | ASC processing evidence | Required. |
| P6E-C05 | Internal TestFlight install not completed | Open | TBD | TestFlight install/launch evidence | Required. |

## High-Risk Issues

High-risk issues block safe internal testing.

| ID | Issue | Status | Owner | Evidence needed | Notes |
| --- | --- | --- | --- | --- | --- |
| P6E-H01 | Real iPhone QA not completed | Open | TBD | Device/iOS run evidence | Required before readiness claim. |
| P6E-H02 | Sign in with Apple TestFlight smoke not completed | Open | TBD | Auth pass/fail notes | Required if native auth included. |
| P6E-H03 | Account lifecycle smoke not completed | Open | TBD | Migration/export/delete evidence | Required. |
| P6E-H04 | Privacy/support URLs not verified | Open | TBD | Production URL evidence | Required before submission readiness. |
| P6E-H05 | Account deletion/export compliance not verified | Open | TBD | In-app + ASC/review note evidence | Required before submission readiness. |

## Manual QA Evidence Summary

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Latest main pulled | Pending | TBD | Must record exact SHA. |
| Local lint/build/tests | Pending | TBD | Required before archive. |
| Xcode project opens | Pending | TBD | Requires Mac/Xcode. |
| Simulator build/run | Pending | TBD | Requires Mac/Xcode. |
| Real iPhone build/run | Pending | TBD | Required before readiness claim. |
| Guest smoke test | Pending | TBD | Must stay unblocked. |
| Meal logging smoke test | Pending | TBD | Privacy-safe sample data. |
| Dashboard/history/profile smoke test | Pending | TBD | Core navigation. |
| Sign in with Apple smoke test | Pending | TBD | No private Apple ID evidence. |
| Backend session persistence | Pending | TBD | Backend session only. |
| Account migration/export/delete | Pending | TBD | Test/disposable account only. |
| Offline/network smoke test | Pending | TBD | Safe failures and retry. |
| Accessibility smoke test | Pending | TBD | VoiceOver/Dynamic Type. |

## Screenshots

| Screenshot set | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Guest Dashboard | Pending | TBD | Privacy-safe sample data. |
| Meal Logger | Pending | TBD | Privacy-safe sample data. |
| Meal review/save | Pending | TBD | Privacy-safe sample data. |
| History | Pending | TBD | Privacy-safe sample data. |
| Profile guest | Pending | TBD | Optional sign-in copy. |
| Profile signed-in account tools | Pending | TBD | No private Apple ID data. |
| App icon/home screen | Pending | TBD | Icon/artwork verification. |

## Privacy and Support URLs

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Privacy URL live and accurate | Pending | TBD | Required before submission readiness. |
| Support URL live and monitored | Pending | TBD | Required before submission readiness. |
| Health/nutrition disclaimer reviewed | Pending | TBD | Avoid medical claims. |
| Privacy labels reviewed | Pending | TBD | Must match actual data behavior. |

## Account Deletion / Export Verification

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Export available to signed-in user | Pending | TBD | No full private export screenshots. |
| Delete available to signed-in user | Pending | TBD | Destructive confirmation required. |
| Delete cancel path works | Pending | TBD | No side effects. |
| Delete confirmed path clears backend/local session | Pending | TBD | Disposable test account only. |
| Guest mode returns after delete | Pending | TBD | Required. |
| ASC/review notes align | Pending | TBD | Required before submission readiness. |

## Sign-In / Auth Verification

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Sign in cancel preserves guest mode | Pending | TBD | Required. |
| Sign in completion creates backend session | Pending | TBD | Required. |
| Relaunch restores backend session | Pending | TBD | Required. |
| Logout clears backend/local session | Pending | TBD | Required. |
| Token/private data not exposed in logs/screenshots | Pending | TBD | Required. |

## TestFlight Upload Readiness

| Gate | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Archive created | Pending | TBD | Required. |
| Archive validated | Pending | TBD | Required if Xcode offers validation. |
| Build uploaded to ASC | Pending | TBD | Required. |
| Build processed | Pending | TBD | Required. |
| Internal tester group assigned | Pending | TBD | Required. |
| TestFlight install succeeds | Pending | TBD | Required. |
| First launch from TestFlight succeeds | Pending | TBD | Required. |

## Final Approval Fields

- Release owner approval: Pending
- QA owner approval: Pending
- Product owner approval: Pending
- Go/no-go decision: No-go
- Approved build number: TBD
- Approved commit SHA: TBD
- Required fixes before go:
  - TBD
- Accepted deferrals:
  - Premium/subscriptions intentionally not started.

## Current Default Recommendation

Do **not** upload or roll out through TestFlight until the critical blockers and required manual evidence are complete. Do **not** claim App Store submission readiness from this tracker.
