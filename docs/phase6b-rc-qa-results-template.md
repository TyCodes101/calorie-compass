# Phase 6B Release-Candidate QA Results Template

Use this template to record actual simulator/device QA results. Leave status as `Not run` until the flow is executed on the named environment.

## Run Header

- Run ID:
- Date/time:
- Tester:
- Commit SHA:
- App version/build number:
- Backend environment:
- Device/simulator:
- iOS version:
- Network profile:
- Install state: clean / upgrade / reinstall
- Overall result: Not run / Pass / Fail / Blocked

## Result Legend

- `Pass`: executed successfully with evidence.
- `Fail`: executed and failed; blocker recorded.
- `Blocked`: could not execute due to setup/access/environment issue.
- `Not run`: no evidence yet.

## Core QA Matrix

| Area | Status | Evidence | Notes / blockers |
| --- | --- | --- | --- |
| Launch smoke test | Not run | None | Confirm first launch, tab load, no crash. |
| Guest mode | Not run | None | Confirm no login required. |
| Meal logging | Not run | None | Log realistic meal as guest and signed-in user if available. |
| Dashboard | Not run | None | Confirm totals/progress update. |
| History | Not run | None | Confirm logged meals appear and navigation is stable. |
| Profile | Not run | None | Confirm guest and signed-in copy/actions. |
| Sign in with Apple | Not run | None | Confirm backend session required before signed-in state. |
| Backend session persistence | Not run | None | Force-close/relaunch and verify Keychain backend-session behavior. |
| Logout/revocation | Not run | None | Confirm backend logout when token exists and local clear. |
| Guest migration | Not run | None | Confirm migration count, duplicate-safe retry, account data display. |
| Export account data | Not run | None | Confirm signed-in only; no sensitive tokens/logs visible. |
| Delete account | Not run | None | Confirm destructive confirmation, scoped delete, local session clear. |
| Offline/network failure states | Not run | None | Confirm safe failures and retry. |
| Reinstall/session clear | Not run | None | Confirm clean guest state or valid backend session only. |
| Accessibility / VoiceOver | Not run | None | Confirm labels/hints for account actions and destructive dialog. |
| Dynamic Type | Not run | None | Confirm no clipping/overlap at large accessibility sizes. |
| Keyboard/input | Not run | None | Confirm profile/logger input remains usable. |
| Screenshots | Not run | None | Capture safe screenshots without tokens/private data. |
| Crash-free navigation | Not run | None | Rapid tabs, background/foreground, loading state navigation. |

## Detailed Flow Notes

### Guest Mode

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Meal Logging

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Sign in with Apple

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Backend Session Persistence

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Logout / Revocation

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Guest Migration

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Export Account Data

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Delete Account

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Offline / Network Failure

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Reinstall / Session Clear

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

### Accessibility / Dynamic Type

- Steps executed:
- Expected result:
- Actual result:
- Evidence:
- Status: Not run

## Blocker Log

| ID | Severity | Area | Description | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | No blockers recorded yet. | TBD | Not started |

## Go / No-Go Decision

- Decision: Not ready / no decision yet
- Required fixes before go:
- Accepted deferrals:
- Release owner:
- Approval date/time:

Do not mark `Go` until manual simulator/device evidence is complete and reviewed.
