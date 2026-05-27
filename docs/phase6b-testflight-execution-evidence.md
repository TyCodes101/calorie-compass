# Phase 6B TestFlight Execution Evidence Tracker

Phase 6B tracks actual TestFlight release-candidate execution evidence. This file starts as an incomplete evidence template. Do not mark any item complete unless the named manual Apple/Xcode/device work was actually performed and evidence was recorded.

## Status

- Overall status: **not ready / evidence incomplete**
- TestFlight readiness claimed: **No**
- App Store submission readiness claimed: **No**
- Phase 7 started: **No**

## Execution Metadata

| Field | Evidence | Status | Notes |
| --- | --- | --- | --- |
| QA run date/time | Not verified | Incomplete | Record local timezone and UTC. |
| Tester / owner | Not verified | Incomplete | Record initials/name. |
| Git commit SHA | Not verified | Incomplete | Use the exact release-candidate commit. |
| Branch/tag | Not verified | Incomplete | Record branch or tag used for archive. |
| Backend environment/base URL | Not verified | Incomplete | Confirm staging/production target. |
| Database environment | Not verified | Incomplete | Confirm persistence enabled. |
| macOS version | Not verified | Incomplete | Required for reproducibility. |
| Xcode version | Not verified | Incomplete | Record exact Xcode build if possible. |
| Simulator model | Not verified | Incomplete | Example: iPhone 16. |
| Simulator iOS version | Not verified | Incomplete | Record exact runtime. |
| Physical iPhone model | Not verified | Incomplete | Required before readiness claim. |
| Physical iOS version | Not verified | Incomplete | Required before readiness claim. |
| Apple Developer Team | Not verified | Incomplete | Requires Apple Developer access. |
| Bundle ID | Not verified | Incomplete | Must match Apple auth audience/backend config. |

## Signing and Capability Evidence

| Item | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Signing team selected | Not verified | Incomplete | Manual Xcode/Apple Developer check. |
| Development signing works | Not verified | Incomplete | Build on simulator and real device. |
| Distribution signing works | Not verified | Incomplete | Required for archive/upload. |
| Bundle ID registered | Not verified | Incomplete | Apple Developer portal evidence. |
| Sign in with Apple capability enabled | Not verified | Incomplete | Confirm target and identifier. |
| Keychain/session behavior checked | Not verified | Incomplete | Confirm backend-session envelope only. |
| No premium/subscription capability added | Not verified | Incomplete | Should remain absent. |
| App icon final assets present | Not verified | Incomplete | Placeholder icon must be replaced before final RC. |

## Archive and Upload Evidence

| Item | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Xcode archive created | Not verified | Incomplete | Record archive date/build number. |
| Archive validation passed | Not verified | Incomplete | Organizer validation result. |
| Upload to App Store Connect completed | Not verified | Incomplete | Requires explicit approval. |
| TestFlight processing completed | Not verified | Incomplete | Record processing state. |
| Internal tester group selected | Not verified | Incomplete | Do not add testers without approval. |
| Internal tester install completed | Not verified | Incomplete | Record device/user. |
| First TestFlight launch completed | Not verified | Incomplete | Record result and screenshots if safe. |

## Pass/Fail Notes

Use this section for concise evidence and blockers. Attach screenshots/log references by filename or secure internal link only; do not paste secrets, tokens, private Apple ID data, full account exports, or sensitive meal/profile data.

- Blockers: none recorded yet because execution has not started.
- Deferrals: none recorded yet.
- Follow-up owner: not assigned.

## Final Evidence Gate

Before changing status to ready, all of these must be complete:

- [ ] Simulator build/run evidence recorded.
- [ ] Real-device build/run evidence recorded.
- [ ] TestFlight archive/upload evidence recorded, if upload is in scope.
- [ ] Internal tester install evidence recorded, if upload is in scope.
- [ ] Privacy/support/account deletion evidence recorded.
- [ ] Guest mode, account auth, migration, export, delete, offline, accessibility, Dynamic Type, and crash-free navigation results recorded.
- [ ] Release owner explicitly approves readiness claim.

If any box is unchecked, TestFlight readiness is **not claimed**.
