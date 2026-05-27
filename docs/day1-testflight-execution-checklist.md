# Day 1 TestFlight Execution Checklist

Operator-focused checklist for the first Calorie Compass TestFlight execution day: Xcode archive, App Store Connect upload, internal TestFlight install, and first real iPhone QA session.

This checklist does **not** claim TestFlight readiness. Mark items complete only with real Mac/Xcode/App Store Connect/iPhone evidence.

## Guardrails

- Do not fake QA/TestFlight evidence.
- Do not claim TestFlight readiness until archive, upload, processing, install, and real iPhone smoke evidence exist.
- Do not claim App Store submission readiness.
- Do not add premium/subscriptions.
- Do not add telemetry/crash SDKs.
- Do not add secrets/API keys to git, docs, screenshots, logs, or PR comments.
- Do not start Phase 7.
- Keep guest mode available.

## Required People and Access

| Need | Owner | Status | Evidence |
| --- | --- | --- | --- |
| Release operator with Mac/Xcode | TBD | Pending | Name/initials + Xcode version |
| Apple Developer Team access | TBD | Pending | Redacted signing/team screenshot |
| App Store Connect access | TBD | Pending | Redacted app/build page screenshot |
| Internal TestFlight tester Apple ID | TBD | Pending | Tester group/build assignment evidence, no private Apple ID data |
| Backend environment owner | TBD | Pending | Non-secret backend base URL confirmation |
| Product/release approver | TBD | Pending | Final go/no-go approval |

## Required Devices and Tools

- Mac with supported Xcode.
- Physical iPhone for first real QA session.
- iPhone simulator for pre-upload sanity build.
- TestFlight app installed on the physical iPhone.
- Stable network plus ability to simulate offline/poor network.
- Privacy-safe sample meal/profile data.
- Secure evidence storage location outside git unless screenshots are explicitly approved for docs.

## Evidence Storage

Suggested local path:

```text
artifacts/testflight-day1/YYYY-MM-DD/<commit>/<area>/
```

Record these for every pass/fail:

- Date/time and timezone.
- Operator/tester initials.
- Git commit SHA.
- App version/build number.
- Xcode version.
- Device model and iOS version.
- Backend environment/base URL, without secrets.
- Screenshot/log/screen recording path.
- Bug/issue link for failures.

Never capture or share secrets, provisioning profiles, certificates, private keys, bearer tokens, Apple identity tokens, token hashes, full account exports, private Apple ID data, or real user nutrition/profile data.

## Stop Shipment If...

Stop immediately and do not roll out to internal testers if any of these happen:

- Latest `main` cannot be pulled cleanly.
- Local lint/build/tests fail and are not explicitly accepted by the release owner.
- Xcode project does not open or archive.
- Signing/team/bundle ID cannot be verified.
- Sign in with Apple capability is missing or mismatched.
- App points to the wrong backend environment.
- Guest mode is blocked by login.
- Archive/upload fails.
- App Store Connect processing fails or shows unresolved compliance blockers.
- TestFlight install fails.
- First launch crashes or hangs.
- Core guest meal logging fails.
- Sign in with Apple breaks guest mode or exposes private token data.
- Account delete/export behavior is unsafe or unverified.
- Any secret/API key/token appears in logs/screenshots/docs.
- Premium/subscription metadata appears unexpectedly.
- A privacy, data loss, or account deletion issue is discovered.

## Exact Order of Operations

### 1. Freeze the Candidate

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short --branch
```

Required evidence:

- Commit SHA.
- Clean working tree.
- Confirmation this SHA is the intended candidate.

### 2. Verify Environment Variables and Runtime Config

Confirm without exposing values:

- Backend base URL points to intended production-like environment.
- Apple auth audience/bundle ID mapping is correct.
- Database/persistence environment is production-like and stable.
- No local `.env` secrets are committed.
- No API keys/secrets appear in app logs or screenshots.

Required evidence:

- Redacted config checklist.
- Backend base URL hostname only if safe to disclose.

### 3. Open Xcode and Verify Project

1. Open `ios/CalorieCompass/CalorieCompass.xcodeproj`.
2. Select the `CalorieCompass` scheme.
3. Record Xcode version.
4. Confirm project indexes without errors.
5. Confirm no unexpected package/dependency changes.

Required evidence:

- Xcode version.
- Project/scheme confirmation screenshot or log.

### 4. Verify Signing, Bundle ID, and Capabilities

1. Confirm bundle identifier in Xcode.
2. Confirm Apple Developer Team.
3. Confirm signing status is valid.
4. Confirm provisioning resolves without manual secret export.
5. Confirm Sign in with Apple capability is enabled and matches backend config.
6. Confirm no in-app purchase/subscription capability was added.
7. Confirm no telemetry/crash SDK was added.

Required evidence:

- Redacted signing/team screenshot.
- Bundle ID recorded.
- Capabilities checklist.

### 5. Run Pre-Archive Checks

```bash
npm run lint
npm run build
env -u OPENAI_API_KEY npm test
npm test -- native-session native-auth-route auth-session apple-token-verification account-lifecycle-route
```

Optional iOS simulator build from Mac:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build | tee artifacts/testflight-day1/ios-simulator-build.log
```

Required evidence:

- Command outputs or log paths.
- Pass/fail status.

### 6. Run Simulator Sanity Build

1. Build and launch on simulator.
2. Confirm first launch.
3. Confirm guest navigation works.
4. Do not treat simulator-only results as TestFlight readiness.

Required evidence:

- Simulator model/iOS version.
- First-launch screenshot with privacy-safe data.

### 7. Run Real iPhone Pre-Archive Smoke

1. Connect physical iPhone.
2. Build/run from Xcode.
3. Confirm launch.
4. Background/foreground the app.
5. Confirm guest mode remains accessible.

Required evidence:

- Device model/iOS version.
- Xcode run log or screenshot.
- Privacy-safe first-launch screenshot.

### 8. Set Build and Version Number

1. Confirm marketing version.
2. Confirm build number increments from any previous uploaded build.
3. Record git commit SHA.
4. Record release notes draft.

Required evidence:

- Version/build screenshot.
- Release notes draft path.

### 9. Archive in Xcode

1. Select generic iOS device / Any iOS Device.
2. Product > Archive.
3. Wait for archive completion.
4. Open Organizer.
5. Validate archive if prompted/available.

Required evidence:

- Archive success screenshot/log.
- Any warnings/errors.
- Version/build number.

### 10. Upload to App Store Connect

1. In Organizer, select archive.
2. Distribute App.
3. App Store Connect.
4. Upload.
5. Use safe/default signing unless release owner says otherwise.
6. Confirm upload completes.

Required evidence:

- Upload success screenshot/log.
- Upload timestamp.
- Any warnings/errors.

### 11. Verify App Store Connect Processing

1. Open App Store Connect.
2. Confirm uploaded build appears.
3. Record processing start timestamp.
4. Wait for processing completion.
5. Resolve export/compliance prompts only with release-owner approval.
6. Confirm no subscription metadata was added.

Required evidence:

- Redacted build processing screenshots.
- Processing status and timestamps.
- Compliance prompt answers or owner decision link.

### 12. Assign Internal Tester Build

1. Confirm internal tester group exists.
2. Assign processed build to internal testers.
3. Add internal release notes if needed.
4. Confirm tester can see build in TestFlight.

Required evidence:

- Redacted tester group/build assignment screenshot.
- Internal release notes.

### 13. Internal TestFlight Install Flow

On physical iPhone:

1. Open TestFlight.
2. Install the build.
3. Record install result.
4. Launch from TestFlight.
5. Record first-launch result.

Required evidence:

- Device/iOS version.
- TestFlight install screenshot.
- First-launch screenshot or screen recording.

### 14. First-Launch Smoke Tests

Run from TestFlight-installed build:

1. Launch app.
2. Confirm no crash/hang.
3. Confirm Dashboard loads.
4. Confirm Log Meal tab opens.
5. Confirm History opens.
6. Confirm Profile opens.
7. Confirm guest mode is available without login.

Required evidence:

- Pass/fail notes.
- Privacy-safe screenshots.

### 15. Guest and Meal Logging Smoke

1. Start as guest.
2. Log a privacy-safe sample meal.
3. Save/review meal.
4. Confirm Dashboard totals update.
5. Confirm History shows the meal.

Required evidence:

- Safe sample meal screenshots.
- Pass/fail notes.

### 16. Auth and Account Lifecycle Smoke

1. Tap Sign in with Apple.
2. Cancel once; confirm guest mode still works.
3. Complete Sign in with Apple using a test Apple ID.
4. Confirm backend session succeeds before signed-in state.
5. Force-close/relaunch; confirm session persistence.
6. Test logout.
7. Create guest data, sign in, and test migration if applicable.
8. Test export with a disposable account.
9. Test delete cancel path.
10. Test delete confirmed path only on disposable account; confirm guest mode returns.

Required evidence:

- Pass/fail notes.
- No private Apple ID screenshots.
- No token/export private data in evidence.

### 17. Offline and Reinstall Smoke

1. Toggle offline/poor network.
2. Try profile load, meal logging, auth handoff, export/delete/logout.
3. Confirm safe errors and no silent destructive actions.
4. Restore network and retry.
5. Delete/reinstall TestFlight build if safe.
6. Confirm clean launch and session behavior.

Required evidence:

- Pass/fail notes.
- Privacy-safe screenshots of failure/retry states.

### 18. Accessibility Smoke

1. Enable VoiceOver.
2. Navigate Dashboard, Log Meal, History, Profile.
3. Confirm account lifecycle buttons are understandable.
4. Increase Dynamic Type to large accessibility sizes.
5. Confirm core flows remain usable.

Required evidence:

- Pass/fail notes.
- Screenshots/video only if privacy-safe.

### 19. Screenshot Capture Order

Capture after the TestFlight build is stable:

1. App icon/home screen.
2. Guest Dashboard.
3. Meal Logger start state.
4. Meal review/save state.
5. History with safe sample data.
6. Profile guest mode.
7. Profile signed-in account tools, redacted/no private Apple ID data.
8. Account deletion confirmation for internal QA only unless approved for review materials.

Required evidence:

- Screenshot folder path.
- Device/iOS version.
- Confirmation each screenshot passes the “do not upload if…” privacy review.

### 20. Final Day 1 Go / No-Go

Before saying “go” for internal rollout, confirm:

- Archive succeeded.
- Upload succeeded.
- Processing completed.
- Internal tester install succeeded.
- First launch succeeded on real iPhone.
- Guest smoke passed.
- Auth/account lifecycle smoke passed or known risks are approved.
- Offline/reinstall smoke passed or known risks are approved.
- No blocker/high issue remains untriaged.
- Evidence is stored and linked.
- Release owner approved.

Default decision until all above are true: **No-go**.

## Rollback / Failure Handling

If anything fails:

1. Stop the rollout.
2. Preserve logs/screenshots.
3. File an issue using `docs/phase6e-testflight-issue-triage-tracker.md`.
4. Classify severity.
5. Remove failed build from tester groups if it risks tester confusion or bad data.
6. Do not patch runtime behavior without reproduction evidence.
7. Retest after any fix PR merges.
8. Record retest evidence before resuming.

## Day 1 Completion Summary

Fill this only after real execution:

- Date/time:
- Operator:
- Commit SHA:
- Version/build:
- Archive result: Pending
- Upload result: Pending
- Processing result: Pending
- Internal install result: Pending
- First real iPhone QA result: Pending
- Blockers:
- Decision: No-go
- Evidence folder/link:
