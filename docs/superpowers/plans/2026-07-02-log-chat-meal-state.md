# Log Chat Meal State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Log chat state truthful: every food entry creates a pending review meal, corrections mutate that pending meal, macro requests read pending/saved state, and save/delete/undo cannot lie or duplicate.

**Architecture:** Add an explicit optional `pendingMeal` lifecycle to the backend/native assistant state while preserving `currentMealItems` as the compatibility mirror for existing UI. Centralize lifecycle creation, update, save, discard, stale checks, meal-type corrections, and macro replies in a reducer helper, then wire the helper through deterministic backend paths and iOS request/save state.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js API route, Swift Codable models, Swift/XCTest where locally available.

---

### Task 1: Backend Contract And Reducer

**Files:**
- Modify: `lib/ai/mealAssistantSchema.ts`
- Create: `lib/ai/mealPendingState.ts`
- Test: `tests/meal-chat-state-machine.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests that call `runMealAssistant` with fake nutrition for chicken/asparagus. Assert snack/breakfast selected state creates `next_state.pendingMeal.status === "readyForReview"`, matching `mealType`, non-empty `meal.items`, macro totals, and copy starting with `Ready to review`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `vitest run tests/meal-chat-state-machine.test.ts --pool=threads`
Expected: FAIL because `pendingMeal` is absent and copy does not guarantee review state.

- [ ] **Step 3: Add schema + reducer**

Add `pendingMeal` with `id`, `version`, `status`, `mealType`, `displayTitle`, `rawText`, `items`, `totals`, `confidenceScore`, `createdAt`, `updatedAt`, optional `expiresAt`, `savedMealId`, and optional `idempotencyKey`.

Reducer helpers:
- `createReadyPendingMeal`
- `syncPendingMealFromState`
- `withPendingMeal`
- `hasActivePendingMeal`
- `isPendingMealExpired`
- `updatePendingMealType`
- `discardPendingMeal`
- `markPendingMealSaved`
- `buildPendingMealMacroReply`
- `buildNoMealMacroReply`

- [ ] **Step 4: Run focused test and verify GREEN**

Run the same focused test. Expected: pending lifecycle assertions pass.

### Task 2: Deterministic Conversation Flows

**Files:**
- Modify: `lib/ai/runMealAssistant.ts`
- Test: `tests/meal-chat-state-machine.test.ts`

- [ ] **Step 1: Write failing reducer-flow tests**

Cover:
- `It was for dinner actually` updates active pending meal and `mealType`.
- `Where's my macros` and typo `Probide macros` answer from pending.
- Macro request with no pending/saved says no foods logged.
- Meal-period correction with no active pending asks what food to log.
- `delete that nvm` discards pending.
- `add rice to that` updates pending totals.
- `no sauce` on irrelevant pending asks clarification or preserves state.

- [ ] **Step 2: Verify RED**

Run the focused file. Expected: FAIL on meal-type/macro/delete pending behavior.

- [ ] **Step 3: Wire deterministic reducer paths**

Before classifier fallback:
- restore/migrate active pending from legacy `currentMealItems`;
- reject expired pending as stale;
- handle macro requests from pending first, saved/today context second, empty state last;
- handle meal-type corrections against pending/current saved state;
- handle discard/delete/undo against pending;
- ensure direct food estimates call `createReadyPendingMeal`;
- ensure all mutation/save paths mirror `pendingMeal.items` to `currentMealItems`.

- [ ] **Step 4: Verify GREEN**

Run focused tests until all state-machine cases pass.

### Task 3: Save Idempotency And Native Contract

**Files:**
- Modify: `ios/MealAssistantModels.swift`
- Modify: `ios/CalorieCompass/BackendService.swift`
- Modify: `ios/CalorieCompass/LogChatView.swift`
- Modify: `ios/CalorieCompassTests/MealManagementTests.swift`
- Test: `tests/meal-logger-client.test.tsx`

- [ ] **Step 1: Write failing tests**

Add/extend tests for double-save prevention and pending state preservation through relaunch-like request-state rebuilds.

- [ ] **Step 2: Add native pending models**

Add `PendingMealStatus`, `PendingMeal`, and optional `pendingMeal` to both Swift state definitions. Decode defaults permissively for backwards compatibility.

- [ ] **Step 3: Wire selected chip and save payload**

When a response carries pending meal, update `selectedMealType`, `reviewItems`, `assistantState.pendingMeal`, and save from pending id/version-derived idempotency key. After save, mark pending saved and clear review card.

- [ ] **Step 4: Run web/native focused tests**

Run Vitest focused client tests and available XCTest/xcodebuild commands.

### Task 4: Restaurant Regression Port

**Files:**
- Modify: resolver/catalog files only if current branch lacks PR #37 behavior
- Test: `tests/restaurant-log-regression.test.ts`
- Test: existing conversation/QA restaurant tests

- [ ] **Step 1: Run restaurant regression tests**

Run focused restaurant suite and confirm Wendy Baconator, typo Baconnator, McDouble no cheese, Subway meatball footlong, Arby's roast beef, Chipotle bowl, and buttered corn remain correct.

- [ ] **Step 2: Port only missing fixes**

If failures show main lacks PR #37's fixes, cherry-pick/port the minimal resolver/catalog/ProductFamily changes without bringing deployment-only commits.

- [ ] **Step 3: Verify GREEN**

Run restaurant and conversation suites.

### Task 5: QA Doc, Full Validation, PR

**Files:**
- Create or modify: `docs/qa/log-chat-meal-state-testflight.md`

- [ ] **Step 1: Add manual QA checklist**

Include the exact TestFlight flow from the spec plus restaurant follow-ups.

- [ ] **Step 2: Run required validation**

Commands:
- `npm run lint`
- `npm run build`
- `npm test`
- focused resolver/food identity tests
- focused conversation tests
- focused integration tests
- iOS tests if available locally
- GitHub Actions verification if available

- [ ] **Step 3: Commit, push, open PR**

Commit all changes, push `feature/log-chat-meal-state`, open a PR to `main`, and include root cause, architecture, lifecycle, test coverage, commands/results, unavailable local validation, and remaining risks.
