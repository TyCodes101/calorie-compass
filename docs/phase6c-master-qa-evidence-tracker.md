# Phase 6C Master RC QA Evidence Tracker

Phase 6C consolidates release-candidate QA evidence workflow after Phase 6B. This tracker does **not** claim TestFlight readiness or App Store submission readiness. It is the control sheet for collecting real evidence from Mac/Xcode, Apple Developer, App Store Connect, simulator, and physical iPhone execution.

## Status Legend

Use only these statuses:

- `Not started` — no execution evidence yet.
- `Blocked` — cannot proceed; blocker is listed with reproduction/setup details.
- `Needs Mac/Xcode` — requires a local Mac/Xcode environment.
- `Needs Apple Developer access` — requires Apple Developer portal or App Store Connect permissions.
- `Needs real iPhone` — requires physical device validation.
- `Passed with evidence` — executed and evidence location is recorded.
- `Failed with reproduction steps` — executed and failure steps are recorded.

## Linked Evidence Sources

| Source | Purpose | Current status |
| --- | --- | --- |
| `docs/phase6a-testflight-rc-qa.md` | Phase 6A release-candidate QA checklist | Not started |
| `docs/testflight-build-handoff.md` | Mac/Xcode/TestFlight build handoff | Needs Mac/Xcode + Apple Developer access |
| `docs/phase6b-testflight-execution-evidence.md` | TestFlight execution evidence tracker | Not started |
| `docs/phase6b-rc-qa-results-template.md` | Structured pass/fail QA results template | Not started |
| `docs/phase6b-app-store-connect-evidence.md` | App Store Connect readiness evidence | Needs Apple Developer access |
| `docs/phase6c-manual-qa-script.md` | Step-by-step Mac/iPhone QA script | Not started |
| `docs/phase6c-screenshot-workflow.md` | Screenshot capture workflow | Not started |
| `docs/phase6c-blockers-register.md` | Known blockers and severity register | Active |

## Master Evidence Matrix

| Area | Status | Evidence location | Owner | Notes |
| --- | --- | --- | --- | --- |
| Pull latest main / release candidate commit | Not started | TBD | TBD | Record exact SHA before QA. |
| Mac/Xcode setup | Needs Mac/Xcode | TBD | TBD | Requires local Mac. |
| Apple Developer team / signing | Needs Apple Developer access | TBD | TBD | Bundle ID/team/capabilities must be verified. |
| App icon/artwork finalization | Blocked | TBD | TBD | Final icon/artwork evidence not recorded. |
| Simulator build | Needs Mac/Xcode | TBD | TBD | `xcodebuild` unavailable in Linux container. |
| Real iPhone build | Needs real iPhone | TBD | TBD | Required before readiness claim. |
| Guest mode | Not started | TBD | TBD | Must remain unblocked. |
| Meal logging | Not started | TBD | TBD | Guest and signed-in where possible. |
| Dashboard / History / Profile | Not started | TBD | TBD | Navigation and data consistency. |
| Sign in with Apple | Needs Apple Developer access | TBD | TBD | Requires configured Apple auth environment. |
| Backend session persistence | Not started | TBD | TBD | Validate backend-session envelope only. |
| Logout / revocation | Not started | TBD | TBD | Backend logout and local clear. |
| Guest migration | Not started | TBD | TBD | Duplicate-safe/idempotent evidence. |
| Export account data | Not started | TBD | TBD | No sensitive data in screenshots/logs. |
| Delete account | Not started | TBD | TBD | Destructive confirmation + scoped backend delete. |
| Offline/network failure states | Not started | TBD | TBD | Safe failures and retry. |
| Reinstall/session clearing | Needs real iPhone | TBD | TBD | Include Keychain/session behavior. |
| Accessibility / VoiceOver | Needs real iPhone | TBD | TBD | Simulator acceptable for first pass; device needed for final. |
| Dynamic Type | Not started | TBD | TBD | Large accessibility sizes. |
| Keyboard/input | Not started | TBD | TBD | Profile/logger input. |
| Screenshot capture | Blocked | TBD | TBD | Requires approved sample data/device frames. |
| Privacy/support URLs | Needs Apple Developer access | TBD | TBD | Production URLs not verified. |
| Account deletion compliance | Needs Apple Developer access | TBD | TBD | Requires policy/support review. |
| TestFlight upload / processing | Blocked | TBD | TBD | Upload not approved/completed. |
| Internal tester install | Blocked | TBD | TBD | Depends on upload/processing. |
| Go/no-go decision | Not started | TBD | TBD | Cannot be go until evidence complete. |

## Evidence Rules

- Do not paste secrets, API keys, provisioning profiles, Apple private data, bearer tokens, Apple identity tokens, token hashes, full exports, or sensitive meal/profile data.
- Do not mark any manual Apple-side item as complete without actual evidence.
- Do not claim TestFlight readiness without simulator/device evidence and release-owner approval.
- Do not claim App Store submission readiness without App Store Connect metadata, privacy/support URLs, and account deletion compliance evidence.
- Premium/subscriptions remain intentionally not started.
- Phase 7 remains not started.

## Current Consolidated Result

- Overall result: `Blocked`
- Blocking categories: Mac/Xcode access, Apple Developer access, real iPhone QA, icon/artwork finalization, production URL verification, account deletion compliance verification, screenshot capture, TestFlight upload/install evidence.
- Runtime changes in Phase 6C: none.
