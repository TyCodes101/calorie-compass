# Phase 6C Screenshot Capture Workflow

This workflow prepares privacy-safe screenshots for QA/App Store review. It does not upload screenshots or claim App Store readiness.

## Required Screens

Capture only after simulator/device QA is stable:

1. Guest Dashboard with privacy-safe sample nutrition data.
2. Meal Logger starter/composer state.
3. Meal review/save state using safe sample food.
4. History with safe sample meals.
5. Profile guest mode showing optional sign-in messaging.
6. Sign in with Apple entry point without showing private Apple ID data.
7. Profile signed-in account tools with privacy-safe account state.
8. Delete account confirmation for internal QA evidence only, unless App Store reviewer guidance explicitly needs it.

## Device Sizes and Orientations

- Primary: current iPhone simulator/device required by App Store screenshot set.
- Secondary: smaller iPhone size if layout risk exists.
- Orientation: portrait unless product explicitly supports/needs landscape.
- Use real-device screenshots for final release evidence when possible.

## Suggested Screenshot Captions

Draft captions only; product owner must approve before App Store use.

- “Log meals naturally with quick review before saving.”
- “Track calories and macros from a clean daily dashboard.”
- “Review meal history without losing guest access.”
- “Sign in with Apple stays optional and account tools stay clear.”
- “Manage account data with explicit, scoped actions.”

Avoid medical, guaranteed weight-loss, or overpromising language.

## Privacy-Safe Sample Data Guidance

- Use fictional meals and profile details.
- Do not show real Apple ID email/name.
- Do not show backend bearer tokens, Apple identity tokens, token hashes, exports, or debug logs.
- Do not show real health/medical conditions.
- Do not show sensitive meal history from a real user.
- Prefer simple foods: eggs, yogurt, chicken bowl, salad, burrito, smoothie.

## Naming Convention

Store screenshots outside git unless explicitly approved for docs.

Suggested local folder:

```text
artifacts/testflight-qa/YYYY-MM-DD/<device>/<flow>/
```

Suggested filename format:

```text
YYYY-MM-DD_commit_device_ios_flow_step_result.png
```

Example:

```text
2026-05-27_8e5e801_iphone16_ios26_guest-dashboard_pass.png
```

## Storage Location Suggestion

- Raw screenshots: secure local/internal artifact storage, not committed by default.
- Annotated QA evidence: internal docs or issue/PR comments if privacy-safe.
- App Store screenshots: final approved asset directory only after product/design approval.

## “Do Not Upload If…” Checklist

Do not upload or share screenshots if any item is true:

- [ ] Real Apple ID email/name is visible.
- [ ] Backend token, identity token, token hash, key, secret, or private URL is visible.
- [ ] Real personal nutrition/profile data is visible.
- [ ] Account export JSON/content is visible.
- [ ] Debug logs or stack traces are visible.
- [ ] UI shows an error/failure state not intended for the screenshot.
- [ ] Copy claims TestFlight readiness, App Store readiness, medical outcomes, or premium/subscription behavior that is not implemented.
- [ ] Placeholder icon/artwork is visible in a final App Store screenshot.

## Capture Procedure

1. Confirm build commit and device/iOS version.
2. Seed privacy-safe sample data.
3. Put device in consistent appearance mode if required.
4. Capture each required screen.
5. Review with the “Do Not Upload If…” checklist.
6. Rename files using the convention above.
7. Record paths in the QA evidence tracker.
8. Ask product/design owner for approval before App Store use.
