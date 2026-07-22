# Release Gates

GitHub `Food Intelligence CI` requires dependency install, Prisma generation, secret scanning, ESLint, full Vitest, named food gates, benchmark/golden validation, and a production build.

GitHub `iOS CI` builds the native target, runs Swift unit tests, starts a deterministic Food Intelligence backend, and runs the XCUITest review/save/history flow.

The preview workflow checks representative deployed searches. Codemagic repeats secret, lint, build, full web, named food, benchmark, iOS unit, and XCUITest gates before signing. Any failure stops TestFlight upload.

Baseline changes require review. A production deployment and TestFlight smoke are still required because deterministic tests cannot prove external provider freshness, signing, camera behavior, VoiceOver, keyboard interaction, haptics, or a real save.
