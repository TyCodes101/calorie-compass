# Phase 6F No-Mac TestFlight Pipeline Plan

Phase 6F defines a safe, manual, no-Mac path for archiving and uploading Calorie Compass to TestFlight from GitHub Actions macOS runners using Fastlane.

This does **not** claim TestFlight readiness and does **not** attempt a real upload. Upload is blocked until Apple-side setup and GitHub Secrets are configured by an authorized operator.

## Current Repo Audit

| Area | Finding | Impact |
| --- | --- | --- |
| iOS project | `ios/CalorieCompass/CalorieCompass.xcodeproj` with `CalorieCompass` scheme | Can be archived by `xcodebuild`/Fastlane on macOS. |
| Bundle ID | `com.caloriecompass.ios` in Xcode project | Must match Apple Developer App ID, App Store Connect record, backend Apple audience, and provisioning profile. |
| Backend URL | `https://calorie-compass-chi.vercel.app` in generated Info.plist setting | Must be verified before upload; do not expose secrets. |
| Current iOS CI | `.github/workflows/ios-ci.yml` builds/tests on `macos-latest` | Existing CI remains unchanged. |
| Fastlane | Not previously configured | Added minimal Fastlane config for manual archive/upload. |
| Signing assets | Not in repo | Must remain in GitHub Secrets / Apple systems only. |

## Exact No-Mac TestFlight Path

1. Join/confirm Apple Developer Program access.
2. Create or verify Apple Developer App ID for `com.caloriecompass.ios`.
3. Create or verify App Store Connect app record for the same bundle ID.
4. Create an App Store Connect API key with enough permission to upload/manage TestFlight builds.
5. Create/export iOS Distribution signing certificate as a `.p12` with password.
6. Create/download App Store provisioning profile for `com.caloriecompass.ios`.
7. Base64-encode the `.p12`, provisioning profile, and `.p8` API key locally.
8. Add all required values as GitHub Actions secrets.
9. Trigger `Manual TestFlight Upload` from GitHub Actions with `confirm_upload=UPLOAD`.
10. Workflow fails closed if required secrets are missing.
11. Workflow installs signing material into a temporary runner keychain.
12. Fastlane archives the iOS project and uploads the IPA to TestFlight.
13. Operator verifies App Store Connect processing, internal tester assignment, install, and real iPhone QA manually.

## Required Apple Developer Setup

| Item | Required value / action | Notes |
| --- | --- | --- |
| Apple Developer Program | Active membership | Required for signing and App Store Connect. |
| App ID / Bundle ID | `com.caloriecompass.ios` unless product owner changes it | Must match Xcode and backend Apple auth audience. |
| Capability: Sign in with Apple | Enabled and verified | Required for current native auth scope. |
| Distribution certificate | Apple Distribution certificate exported as `.p12` | Do not commit. Store as GitHub secret only. |
| Provisioning profile | App Store profile for the bundle ID | Do not commit. Store as GitHub secret only. |
| App Store Connect app record | Created for bundle ID | Required before upload. |
| App Store Connect API key | Issuer ID, Key ID, `.p8` private key | Do not commit. Store as GitHub secrets only. |
| Export compliance | Reviewed by release owner | Do not guess; answer in App Store Connect when prompted. |

## Required GitHub Secrets

| Secret | Purpose | Example / format |
| --- | --- | --- |
| `APP_IDENTIFIER` | Bundle ID used by Fastlane and export options | `com.caloriecompass.ios` |
| `APPLE_TEAM_ID` | Apple Developer Team ID for signing | Team ID string |
| `APP_STORE_CONNECT_TEAM_ID` | Optional App Store Connect provider/team ID | Only if account needs provider selection |
| `ASC_KEY_ID` | App Store Connect API key ID | Key ID string |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID | UUID string |
| `ASC_KEY_P8_BASE64` | Base64-encoded `.p8` API key | Base64 text, secret only |
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded distribution `.p12` | Base64 text, secret only |
| `APPLE_CERTIFICATE_PASSWORD` | Password for `.p12` | Secret only |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64-encoded App Store `.mobileprovision` | Base64 text, secret only |
| `MATCH_PROVISIONING_PROFILE_NAME` | Provisioning profile display/name used in export options | Exact profile name |

No Apple keys, certificates, profiles, passwords, or API secrets should be committed to git.

## Added Workflow

File: `.github/workflows/testflight-upload.yml`

Safety properties:

- `workflow_dispatch` only.
- No upload on push or pull request.
- Requires manual `confirm_upload=UPLOAD` input.
- Fails closed if required secrets are missing.
- Uses a temporary keychain on the GitHub-hosted macOS runner.
- Uploads artifacts/logs for debugging.
- Does not modify existing iOS CI workflow.

## Added Fastlane Config

Files:

- `Gemfile`
- `fastlane/Appfile`
- `fastlane/Fastfile`

Lane:

```bash
bundle exec fastlane ios testflight_upload
```

What it does:

1. Validates required env vars.
2. Creates App Store Connect API auth from the CI-provided `.p8` key file.
3. Sets build number from `BUILD_NUMBER`, `GITHUB_RUN_NUMBER`, or timestamp fallback.
4. Archives `ios/CalorieCompass/CalorieCompass.xcodeproj` / `CalorieCompass` scheme.
5. Exports app-store IPA with manual signing profile mapping.
6. Uploads IPA to TestFlight for internal testing only.

## What Remains Manual

- Apple Developer Program membership and permissions.
- App Store Connect app record creation.
- Bundle ID/capability verification.
- Certificate/profile creation and secure export.
- GitHub Secrets setup.
- Manual workflow trigger.
- App Store Connect build processing verification.
- Internal tester assignment.
- Internal TestFlight install.
- Real iPhone QA.
- Screenshot capture.
- Production privacy/support URL verification.
- Release owner go/no-go decision.

## Stop Conditions

Stop and do not upload/roll out if:

- Any required secret is missing.
- Bundle ID does not match Apple/App Store/backend config.
- Signing certificate/profile do not match the bundle/team.
- Existing iOS CI breaks.
- Fastlane archive fails.
- Upload fails.
- App Store Connect processing fails.
- Internal TestFlight install fails.
- First launch or guest mode fails.
- Any secret/token/profile/certificate appears in logs or screenshots.
- Premium/subscription metadata appears unexpectedly.

## Current Status

- Workflow added: yes, manual-only.
- Fastlane config added: yes.
- Real upload attempted: no.
- TestFlight readiness claimed: no.
- Secrets committed: no.
- Existing iOS CI changed: no.
