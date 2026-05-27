# Final Pre-TestFlight Execution Plan — Calorie Compass

_This document summarizes the minimum set of tasks, checklists, and manual execution steps required to bring Calorie Compass to the point of a true internal TestFlight upload. All redundant, outdated, or scattered checklist items from Phases 4E–4G are consolidated here. No runtime app behavior or features are changed by this document._

---

## Remaining Blockers Before TestFlight Upload
- **Production app icon/artwork**: All placeholder assets replaced in Xcode asset catalog (every required size)
- **Final bundle identifier**: Set in Xcode project (do not use placeholder)
- **Apple Developer Team**: Set correct team/profile for archive/signing in Xcode
- **App Store screenshots**: Capture full shot list in correct devices/modes using only approved test/sample data
- **App Store privacy label**: Complete in App Store Connect
- **Support and privacy URLs**: Live and registered in App Store Connect (public HTTPS endpoints)
- **Manual simulator and real-device QA**: Fully completed and recorded using current QA templates
- **Native account/export/delete flows**: Must remain clearly marked as incomplete (web fallback noted)

---

## Apple/Xcode-Side Manual Tasks
- Open the Xcode project (`ios/CalorieCompass`) on a Mac
- Set the correct **production bundle identifier** (e.g. `com.caloriecompass.<yourcompany>`)
- Set final Apple Developer Team for signing in Xcode > Target > Signing & Capabilities
- Replace all **App Icon slots** in asset catalog with production artwork (all required scales/sizes)
- Set the final **version** and **build number** before each archive (Xcode > Project Targets > General)
- Ensure all Info.plist branding, accent colors, and fields are correct
- Archive using the shared `CalorieCompass` scheme (Archive, not just Run)
- Confirm signing/profile works for Debug/Release/Archive with no errors

---

## App Store Connect Tasks
- Create/select the App Store Connect app record for Calorie Compass
- Register final bundle ID and confirm it matches Xcode's configuration
- Register/verify public support and privacy URLs
- Upload production app icons/artwork per App Store guidelines
- Complete all required App Store dialog fields/metadata
- Complete the **Privacy Nutrition Label** in App Store Connect (see privacy checklist below)
- Upload **screenshots** for all required device sizes and scenes per shot plan
- Complete the internal QA/reviewer/tester fields as appropriate

---

## Simulator & Real-Device Manual QA Steps
- Build and launch on at least two simulators: large iPhone and small iPhone SE
- Confirm app icon, launch branding, and all navigation UI present and correct
- Switch through every tab: Today, Log, History, Profile
- Test meal logging: entry, review, save, edit, delete (guest mode)
- Test profile flows and all applicable form fields
- Exercise offline/slow-network/airplane mode paths
- Check keyboard handling, safe areas, light/dark mode, Dynamic Type
- Run through accessibility/VoiceOver basics

- **Repeat** build/archive and install on at least one physical iPhone using correct signing profile and production backend
- Repeat full smoke and regression suite, capturing device info, iOS version, and screenshots

- **Complete and retain the manual QA pass/fail template (from runbook) for each executed device/OS/build**

---

## Screenshot Capture Workflow
- Use only sample/tester-approved data (no real meal logs/profile/private info)
- Follow the detailed shot list (Dashboard, Logger, Meal Review, History, Meal Detail, Profile, Offline/Session)
- Capture all required App Store device sizes (large iPhone, iPhone SE)
- Export, name, and retain screenshots outside the repo
- Confirm final app icons are shown in every image
- Do not use debug, placeholder, or unapproved assets
- Cross-link screenshots and QA pass/fail templates for traceability

---

## Final Asset Requirements
- All app icon sizes required by Xcode/Apple
- Final launch branding, accent color, and Info.plist fields set
- Screenshots for every required App Store device/scene
- Support/privacy URLs are public, HTTPS, and registered in App Store Connect

---

## Bundle ID & Signing Tasks
- Finalize bundle identifier (from placeholder to production value)
- Set correct Apple Developer Team/profile in Xcode
- Confirm valid/active provisioning profiles for Debug/Release/Archive

---

## Privacy Label Completion Tasks (App Store Connect)
- Categorize all data types as required by Apple prior to upload:
  - Account/session IDs
  - Meal logs and food descriptions
  - Nutrition estimates and meal history
  - Profile fields (age, height, weight, goals, preferences)
  - Crash/diagnostics (only if SDK is present later)
  - Analytics (only if enabled—otherwise mark as not collected)
- Certify that secrets, keys, or sensitive user data are NOT included anywhere

---

## Upload/Archive Checklist
- Run `npm run lint`, `npm run build`, `npm test` (assistant-real-user-gauntlet may still fail, is non-blocking)
- Confirm Xcode build/archive/signing passes locally with new icon/art/profile/bundle ID
- Confirm all screenshots/assets in required formats/dimensions/branding
- Finalize all App Store Connect dialogs and metadata fields
- Crosscheck with the manual QA results for all device/build pairs

---

## Internal TestFlight Upload & Review Checklist
- Upload build from Xcode archive to App Store Connect/TestFlight
- Assign testers only after receiving Apple confirmation for build processing
- Review/upload all checklist/metadata (screenshots, privacy labels, support/privacy URLs)
- Monitor for crashes/errors: review TestFlight, internal email, and logs (if available)
- Record all feedback, issues, and failed steps—revert or fix and re-archive for next upload if needed
- DO NOT ADD external testers until every privacy, sign-in, export, deletion, native QA, and support flow is correctly wired and documented

---

## Rollback / Failure Remediation Checklist
- If build/archive/sign fails, re-verify Xcode app icon/assets, bundle ID, Developer Team, and provisioning
- If privacy/URL/App Store submission fails, double-check App Store Connect record and metadata/config
- If manual QA fails, record specific failure reasons and DO NOT claim readiness—address before re-archiving/uploading
- If Apple TestFlight/App Review flags privacy/account/sign-in issues, respond with evidence of fallback documentation and web workflow availability

---

## DO NOT CLAIM READINESS UNTIL…
- All manual QA, screenshots, privacy/metadata, assets, URLs, and App Store Connect fields are 100% complete, captured, and attached to the current archive/build
- Every known blocker above is confirmed and checked off by both Apple-side and internal reviewers
- No runtime app behavior, native auth, premium, or telemetry features are merged or claimed in the readiness record

---

**History:** Consolidates/corrects: Phase 4E–4G docs, checklist drift, asset/scatter, and overlaps from:
- ios-manual-qa-runbook.md
- ios-screenshot-plan.md
- app-store-readiness.md
- app-store-connect-metadata.md
- ios-testflight-qa.md
- phase-4e-testflight-readiness.md

**This plan is a single point-of-truth for handoff/execution.**