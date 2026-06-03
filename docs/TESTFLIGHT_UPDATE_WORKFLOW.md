# MacroMesh iOS TestFlight Update Workflow

_Last updated: 2026-05-28_

This doc covers how to quickly ship safe, stable TestFlight builds for **MacroMesh** (bundle ID: `com.tycodes.macromate`) using **Codemagic**.

**Scope:** This doc is for iOS TestFlight/internal builds. It does not cover production App Store releases or web deployments. No sensitive keys or signing info is included here.

---

## 1. Making Code Changes
- Work on a feature/fix branch as usual.
- All iOS/TestFlight automation is tracked (as of 2026-05) in `feature/codemagic-ios-ci`.
- Merge work into `feature/codemagic-ios-ci` to prepare a new TestFlight build. Skip unrelated feature branches.

## 2. How to Trigger Codemagic Build
- Push your changes to `feature/codemagic-ios-ci` on GitHub.
- Codemagic is set up to automatically build **and** upload every push to this branch.
- _No manual job start is required unless you want to rerun a failed build from the Codemagic UI._

## 3. Verifying a TestFlight Build
- **Codemagic** indicates build and upload status (success/failure & logs).
- After Codemagic moves to "TestFlight Upload succeeded", check App Store Connect > TestFlight.
- _Bundle version/build number increments automatically._ No manual change is needed unless something fails in CI.
- First time? It may take Apple 10–30 minutes to process a new build.

## 4. Installing/Updating on iPhone
- Open TestFlight app on your device (invite your Apple ID if not already added via App Store Connect).
- Tap the latest MacroMesh build and install/update.
- If not visible: wait a few minutes, then check App Store Connect for issues.

## 5. Pre-Share Checklist
- Install/update the build on a test device and launch MacroMesh.
- **Verify before sharing with testers:**
  - App launches to dashboard
  - Profile and logging basic flows work (guest or signed-in)
  - No crash/blank screen
  - Version/build matches what's expected in TestFlight

## 6. Common Failure Fixes
- **Provisioning profile mismatch:** Confirm provisioning and signing match the configured Apple account/bundle.
- **Missing environment group:** All required secrets must be present under the Codemagic env group (see Codemagic settings).
- **Private key PEM:** PEM must be valid, with proper `-----BEGIN PRIVATE KEY-----` and single trailing newline.
- **Missing app icons:** All required iOS icon sizes must be present in asset catalog.
- **Export compliance:** If asked, "Yes, this app uses encryption only for standard Apple frameworks."
- **Missing TestFlight test info:** Fill in required "What to Test" fields in App Store Connect before submitting to external testers.

---

## Quick Reference
- **Code branch:** `feature/codemagic-ios-ci`
- **Automation:** Codemagic auto-builds/publishes every push
- **Test/ship order:** Code → push branch → Codemagic CI → TestFlight uploads → verify → install/update → share
- **Need to rerun?** Push a new commit or use Codemagic UI rerun button

---

**For build/signing/secrets/account issues, escalate to team lead or Apple developer support. Avoid leaking secrets.**

---

_End of doc._
