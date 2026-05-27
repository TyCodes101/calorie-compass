# Phase 6C Known Blockers Register

This register tracks release-candidate blockers before real Mac/Xcode/TestFlight execution. It is not proof of readiness; it is the current handoff risk list.

## Severity Definitions

- `Critical` — blocks TestFlight upload.
- `High` — blocks safe internal testing.
- `Medium` — should fix before external users.
- `Low` — polish or documentation cleanup.

## Blockers

| ID | Severity | Blocker | Status | Owner | Evidence needed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P6C-B01 | Critical | Mac/Xcode manual QA not completed | Open | TBD | Xcode build/run logs and completed QA script | Local Linux container cannot run Xcode. |
| P6C-B02 | High | Real iPhone QA not completed | Open | TBD | Device model/iOS version plus pass/fail evidence | Required before claiming real-device confidence. |
| P6C-B03 | Critical | Bundle ID/signing/team verification not completed | Open | TBD | Apple Developer/Xcode signing evidence | Blocks upload if signing is wrong. |
| P6C-B04 | Medium | App icons/artwork finalization not verified | Open | TBD | Final icon/artwork approval | Placeholder or unapproved assets should not ship. |
| P6C-B05 | High | Privacy/support URLs production verification not completed | Open | TBD | Live privacy/support URLs and review notes | Required before App Store submission readiness. |
| P6C-B06 | High | App Store account deletion compliance verification not completed | Open | TBD | Signed-in delete flow evidence + policy review | Must align in-app behavior, support/privacy docs, and App Store notes. |
| P6C-B07 | Medium | Screenshot capture not completed | Open | TBD | Privacy-safe screenshot set with approval | Needed for App Store metadata and release notes. |
| P6C-B08 | Critical | TestFlight upload not completed | Open | TBD | Archive/upload/build processing evidence | TestFlight readiness is not claimed. |
| P6C-B09 | High | Internal TestFlight install not completed | Open | TBD | Internal tester group/install/launch evidence | Depends on upload and processing. |
| P6C-B10 | Low | Premium/subscriptions intentionally not started | Accepted deferral | Product owner | Explicit product decision | Not a blocker for current free/guest-safe RC path. Do not add subscription metadata. |

## Newly Discovered Code Blockers

None recorded in Phase 6C. If a runtime blocker appears during manual QA, document reproduction steps here before broad app changes.

## Current Release Gate

- TestFlight upload: `Blocked`
- Safe internal testing: `Blocked`
- External user testing: `Blocked`
- App Store submission: `Blocked`

Reason: required manual Mac/Xcode, Apple Developer, real iPhone, App Store Connect, screenshot, and upload evidence has not been collected.
