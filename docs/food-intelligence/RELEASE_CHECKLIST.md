# Food Intelligence Release Checklist

- [ ] Prisma client generation passes.
- [ ] Secret scan passes.
- [ ] ESLint passes.
- [ ] Full Vitest suite passes.
- [ ] Food Intelligence and search suites pass.
- [ ] Assistant, decomposition, state, and idempotency suites pass.
- [ ] Nutrition benchmark and golden dataset pass.
- [ ] Production Next.js build passes.
- [ ] iOS unit and UI tests pass on a simulator.
- [ ] Preview smoke checks pass.
- [ ] `VERCEL_AUTOMATION_BYPASS_SECRET` is configured in GitHub Actions when preview deployment protection is enabled.
- [ ] Codemagic repeats all gates before archive.
- [ ] TestFlight manually verifies camera barcode scan, VoiceOver, keyboard, haptics, and one real save.

Do not upload when a critical gate fails. Do not label a release ready until TestFlight smoke evidence exists.
