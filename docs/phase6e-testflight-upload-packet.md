# Phase 6E TestFlight Upload Execution Packet

This packet is the final operator handoff for creating, uploading, processing, and internally installing a TestFlight build. It does **not** claim TestFlight readiness. Mark items complete only after real Mac/Xcode/App Store Connect/iPhone evidence exists.

## Current Status

- Required base main: `1326030e38edd14a24da42efd82cd813a5ed1f23`
- TestFlight readiness: **not claimed**
- App Store submission readiness: **not claimed**
- Real upload evidence captured in this environment: **none**
- Mac/Xcode availability in this environment: **unavailable**
- App Store Connect availability in this environment: **unavailable**
- Premium/subscriptions: **not started**
- Telemetry SDKs: **not added**
- Phase 7: **not started**

## Evidence Rules

For every completed upload step, record:

- Operator name/initials
- Date/time and timezone
- Git commit SHA
- App version/build number
- Xcode version
- macOS version
- Bundle ID
- Apple Developer Team
- Device/simulator model and iOS version where applicable
- App Store Connect build processing state
- Internal tester group/install evidence
- Links or paths to privacy-safe screenshots/logs

Never record secrets, API keys, provisioning profiles, certificates, private keys, bearer tokens, Apple identity tokens, token hashes, private Apple ID data, or real user nutrition/profile data.

## 1. Mac/Xcode Prerequisites

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Supported Mac available | Pending | TBD | Required. |
| Supported Xcode installed | Pending | TBD | Record exact Xcode version. |
| Repo pulled to latest main | Pending | TBD | Must match approved SHA. |
| Clean working tree | Pending | TBD | `git status --short --branch`. |
| Build dependencies installed | Pending | TBD | npm/iOS dependencies as required. |
| Local secrets kept outside repo | Pending | TBD | Do not screenshot or commit. |

Recommended commands:

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short --branch
xcodebuild -version
```

## 2. Apple Developer Team and Signing

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Correct Apple Developer Team selected | Pending | TBD | Redact private data. |
| Signing status valid | Pending | TBD | Must be green/no errors. |
| Provisioning profile resolves | Pending | TBD | Do not attach profile files. |
| Distribution certificate available | Pending | TBD | Do not expose certificate/private key. |
| Physical device build still works | Pending | TBD | Real iPhone evidence required before readiness claim. |

## 3. Bundle ID

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Xcode bundle ID confirmed | Pending | TBD | Must match backend Apple audience. |
| Apple Developer app identifier confirmed | Pending | TBD | Manual portal evidence. |
| App Store Connect app bundle ID confirmed | Pending | TBD | Manual ASC evidence. |
| Backend auth audience confirmed | Pending | TBD | Record non-secret config only. |

## 4. Capabilities

| Capability | Expected | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Sign in with Apple | Enabled / verified | Pending | TBD | Required for native auth. |
| Associated domains | Verify actual config | Pending | TBD | Only if used. |
| Push notifications | Not expected for current scope | Pending | TBD | Do not add unless approved. |
| In-app purchases/subscriptions | Not started | Pending | TBD | Do not enable in Phase 6E. |
| Telemetry/crash SDKs | Not added | Pending | TBD | Do not add in Phase 6E. |

## 5. App Icons and Artwork

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| App icon set exists in Xcode | Pending | TBD | Required before upload. |
| Icon renders on device | Pending | TBD | Real/simulator screenshot. |
| Placeholder artwork removed or approved | Pending | TBD | Product/design approval required. |
| App Store artwork approved | Pending | TBD | Required before App Store submission readiness, not necessarily internal TestFlight. |

## 6. Build and Version Number

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Marketing version recorded | Pending | TBD | Example: 1.0.0. |
| Build number recorded | Pending | TBD | Must increment for upload. |
| Git SHA recorded | Pending | TBD | Use exact main commit. |
| Release notes drafted | Pending | TBD | Internal notes only unless approved. |
| Version/build matches App Store Connect | Pending | TBD | Manual ASC verification. |

## 7. Pre-Archive Local Checks

Run before archive:

```bash
npm run lint
npm run build
env -u OPENAI_API_KEY npm test
npm test -- native-session native-auth-route auth-session apple-token-verification account-lifecycle-route
```

If available on Mac, also run an iOS build:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build | tee artifacts/phase6e/ios-simulator-build.log
```

Record pass/fail and evidence links. Do not proceed to upload with failing checks unless the release owner explicitly accepts the risk.

## 8. Archive Steps

Use Xcode Organizer unless a release owner approves CLI automation.

1. Select `Any iOS Device` / generic iOS destination.
2. Product > Archive.
3. Confirm archive completes successfully.
4. Open Organizer.
5. Validate archive if Xcode prompts or offers validation.
6. Record archive version/build number.
7. Record archive creation timestamp.

Evidence required:

- Archive success screenshot/log.
- Version/build number.
- Any warning list or confirmation of no warnings.

## 9. Upload Steps

1. In Organizer, select the archive.
2. Choose Distribute App.
3. Choose App Store Connect.
4. Choose Upload.
5. Keep default safe signing unless release owner instructs otherwise.
6. Confirm upload starts and completes.
7. Record upload timestamp and result.

Evidence required:

- Upload success screenshot/log.
- Xcode organizer status.
- Any errors copied into `docs/phase6e-testflight-issue-triage-tracker.md`.

## 10. App Store Connect Processing Checklist

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Build appears in App Store Connect | Pending | TBD | Manual ASC verification. |
| Build processing started | Pending | TBD | Record timestamp. |
| Build processing completed | Pending | TBD | Required before internal tester install. |
| Missing compliance prompts resolved | Pending | TBD | Release owner approval required. |
| Export compliance answered | Pending | TBD | Do not guess; verify actual crypto usage. |
| Build metadata/release notes entered | Pending | TBD | Internal TestFlight notes. |
| No subscription metadata added | Pending | TBD | Premium/subscriptions not started. |

## 11. Internal Tester Checklist

| Item | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Internal tester group exists | Pending | TBD | App Store Connect access required. |
| Build assigned to internal tester group | Pending | TBD | Required for install. |
| Tester receives build | Pending | TBD | TestFlight app evidence. |
| Build installs on real iPhone | Pending | TBD | Required before readiness claim. |
| First launch from TestFlight succeeds | Pending | TBD | Required. |
| Guest smoke test from TestFlight succeeds | Pending | TBD | Required. |
| Sign in with Apple smoke test from TestFlight succeeds | Pending | TBD | Required if auth in scope. |
| Account lifecycle smoke test from TestFlight succeeds | Pending | TBD | Required. |

## 12. Failure and Rollback Notes

If archive/upload/processing/install fails:

1. Stop and preserve logs/screenshots.
2. File an issue in `docs/phase6e-testflight-issue-triage-tracker.md`.
3. Classify severity:
   - `Blocker`: prevents archive/upload/processing/install or critical app launch.
   - `High`: prevents safe internal test.
   - `Medium`: should fix before external users.
   - `Low`: polish/documentation.
4. Do not create broad runtime fixes without reproduction evidence.
5. If a bad build reaches TestFlight, remove it from tester groups where appropriate and document the action.
6. Keep the previous known-good main hash/build number in the go/no-go tracker.

## Current Default Decision

Until archive/upload/processing/internal install evidence is recorded, the default decision is:

- TestFlight upload readiness: **No-go**
- Internal tester rollout readiness: **No-go**
- App Store submission readiness: **No-go**
