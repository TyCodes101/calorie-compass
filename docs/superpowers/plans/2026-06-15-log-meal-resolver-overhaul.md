# Log Meal Resolver Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make conversational meal logging preserve restaurant/product identity, produce reviewable pending meals with macros before save, and apply explicit add/replace/save actions without stale-item leakage.

**Architecture:** Introduce a deterministic log intent/action parser and an identity-aware candidate scoring layer ahead of existing provider hydration. Keep the existing assistant as the conversational shell, but make pending meal transitions explicit and make `next_state.currentMealItems` the single backend/iOS source of truth. Preserve the small verified catalog as the highest-ranked source while clarifying unsupported restaurant products instead of selecting an unrelated item.

**Tech Stack:** TypeScript, Vitest, Next.js route contracts, Swift/SwiftUI, XCTest, local nutrition catalog, USDA/provider adapters.

---

### Task 1: Add resolver and state regression tests

**Files:**
- Modify: `tests/restaurant-log-regression.test.ts`
- Create: `tests/log-meal-resolver-overhaul.test.ts`

- [ ] **Step 1: Write failing restaurant identity tests**

Add table-driven tests for Wendy's Baconator variants, McDouble no-cheese variants, Subway meatball footlong, and Arby's roast beef. Assert either the correct restaurant product or a clarification with no unrelated card; explicitly forbid chicken results for Baconator and McDouble.

- [ ] **Step 2: Write failing pending-state conversation tests**

Exercise:

```ts
['2 grilled chicken breasts and asparagus', "where's my macros", 'yes']
['Chipotle bowl', 'add McDouble no cheese']
['Chipotle bowl', 'replace with McDouble no cheese']
['Chipotle bowl', 'McDouble no cheese']
```

Assert structured items/macros exist before save, `yes` saves only an existing pending meal, and stale items are retained only for explicit add.

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
node node_modules/vitest/vitest.mjs run tests/restaurant-log-regression.test.ts tests/log-meal-resolver-overhaul.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: failures for missing Baconator support, modifier-sensitive identity, compound generic item hydration, or state transitions.

### Task 2: Extract deterministic meal intent and action parsing

**Files:**
- Create: `lib/ai/logMealIntent.ts`
- Modify: `lib/ai/runMealAssistant.ts`
- Test: `tests/log-meal-resolver-overhaul.test.ts`

- [ ] **Step 1: Define parsed intent types**

Create `LogMealAction`, `LogMealIntent`, and `parseLogMealIntent(message, state)` with explicit fields for action, food text, restaurant, product tokens, quantity, unit, modifiers, and meal type.

- [ ] **Step 2: Implement action precedence**

Use deterministic precedence:

```ts
cancel/save/macros
-> explicit replace
-> explicit add
-> contextual modify
-> standalone food = new meal
```

Treat `yes` as save only when an unsaved pending meal exists and the prior state supports confirmation.

- [ ] **Step 3: Integrate parser before model classification**

Use the parsed action to constrain or override model intent. Remove reliance on the broad `shouldTreatAsStandaloneNewMeal` guard once equivalent tests pass.

- [ ] **Step 4: Run targeted tests to verify GREEN**

Run the resolver-overhaul test file and confirm action classification passes before changing candidate retrieval.

### Task 3: Add identity-aware candidate scoring and confidence decisions

**Files:**
- Create: `lib/nutrition/identity.ts`
- Modify: `lib/nutrition/catalog.ts`
- Modify: `lib/nutrition/accuracyEngine.ts`
- Modify: `lib/nutrition/nutritionLookup.ts`
- Modify: `lib/nutrition/normalizeFoodQuery.ts`
- Test: `tests/nutrition-ranking.test.ts`
- Test: `tests/nutrition-lookup.test.ts`
- Test: `tests/restaurant-log-regression.test.ts`

- [ ] **Step 1: Write scoring tests**

Add tests proving:

```ts
Baconator > Wendy's chicken sandwich
McDouble > McChicken
McDouble no cheese keeps McDouble identity
restaurant mismatch is invalid
unsupported exact restaurant product clarifies
top candidates inside the ambiguity margin clarify
```

- [ ] **Step 2: Implement normalized identity tokens**

Separate brand tokens, product/core tokens, modifiers, preparation tokens, and ignored conversational tokens. Add typo tolerance only for core tokens of length four or greater.

- [ ] **Step 3: Implement hard constraints and ranked score**

Reject conflicting restaurants. Reject candidates missing all core product tokens. Apply negative conflict penalties for chicken versus burger/beef/double/baconator identity. Add source trust, exact phrase, brand, product, modifier, and fuzzy scores.

- [ ] **Step 4: Add confidence decision**

Return high/medium/low confidence based on score and top-two margin. Low confidence returns a clarification and no unrelated items.

- [ ] **Step 5: Run ranking and restaurant tests**

Verify all new identity tests and existing nutrition ranking tests pass.

### Task 4: Preserve a small verified override layer and generic decomposition

**Files:**
- Modify: `data/nutrition-catalog.json`
- Modify: `lib/nutrition/normalizeFoodQuery.ts`
- Modify: `lib/ai/runMealAssistant.ts`
- Test: `tests/log-meal-resolver-overhaul.test.ts`
- Test: `tests/nutrition-lookup.test.ts`

- [ ] **Step 1: Add verified Baconator catalog entry**

Add one curated Wendy's Baconator record with source metadata and aliases including the common `baconnator` typo. Do not add phrase-specific branches.

- [ ] **Step 2: Preserve “no cheese” as a modifier**

Keep product lookup text as McDouble and apply a transparent nutrition adjustment only after the selected identity is fixed. Mark the adjustment in notes and retain restaurant source metadata.

- [ ] **Step 3: Resolve compound generic foods item by item**

Ensure “2 grilled chicken breasts and asparagus” creates two parsed food requests, hydrates both, and uses clean display names.

- [ ] **Step 4: Run targeted lookup and conversation tests**

Confirm restaurant and generic compound cases produce reviewable items and macros.

### Task 5: Make pending meal transitions explicit

**Files:**
- Create: `lib/ai/pendingMeal.ts`
- Modify: `lib/ai/mealAssistantSchema.ts`
- Modify: `lib/ai/runMealAssistant.ts`
- Modify: `app/api/meal-assistant/route.ts`
- Test: `tests/log-meal-resolver-overhaul.test.ts`
- Test: `tests/meal-assistant-conversation.test.ts`

- [ ] **Step 1: Define pending transition functions**

Implement pure functions for create, add, replace, preserve, save, and cancel. Each successful resolution must return items, totals, confidence/source metadata, meal type, and timestamps.

- [ ] **Step 2: Use transitions for every response path**

Ensure macro questions preserve current items, clarification does not import failed candidates, explicit replace clears old items, and standalone food replaces by default.

- [ ] **Step 3: Keep save confirmation gated**

Only invoke persistence for `save_confirm` with an existing pending meal. Clear pending state only after successful save, cancel, replace, or reset.

- [ ] **Step 4: Run conversation tests**

Verify all add/replace/macros/save/stale-state cases pass.

### Task 6: Align iOS with backend pending state

**Files:**
- Modify: `ios/CalorieCompass/BackendService.swift`
- Modify: `ios/CalorieCompass/LogChatView.swift`
- Modify: `ios/CalorieCompass/MealReviewCard.swift`
- Modify: `ios/CalorieCompassTests/MealManagementTests.swift`

- [ ] **Step 1: Write failing XCTest cases**

Test that response application uses `next_state.currentMealItems`, macro-only responses retain the card, low-confidence empty responses do not restore stale unrelated items, and standalone/new versus explicit add/replace behavior matches backend actions.

- [ ] **Step 2: Add a pure response reducer**

Move response-to-view-state decisions into `MealAssistantClientLogic` so `LogChatView` does not choose between `meal.items`, `next_state.currentMealItems`, and prior `reviewItems` ad hoc.

- [ ] **Step 3: Render structured pending totals**

Keep concise assistant copy, `Review Meal · <MealType>`, loading, accessible macro boxes, keyboard-safe scroll behavior, and save controls above the composer.

- [ ] **Step 4: Run available Swift checks**

Run `xcodebuild` if available. Otherwise document Codemagic/TestFlight as the compile/runtime authority.

### Task 7: Full validation and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-06-15-log-meal-resolver-overhaul.md`

- [ ] **Step 1: Run required backend gates**

```powershell
npm run lint
npm test
npm run build
```

Use the threads pool for targeted local Vitest commands if the bundled Node runtime cannot start fork workers.

- [ ] **Step 2: Run targeted resolver gates**

```powershell
npm run qa:assistant
npm run reliability:nutrition
```

Also run the new resolver-overhaul file directly.

- [ ] **Step 3: Review diff and branch state**

Confirm `main` is untouched, no secrets or generated junk are staged, and the branch contains only relevant changes.

- [ ] **Step 4: Commit, push, and open a PR**

Commit with a focused message, push `feature/log-meal-resolver-overhaul`, and open a PR targeting `main` without merging.

- [ ] **Step 5: Report evidence**

Include branch, commit, PR, architecture/root-cause audit, files, tests, exact command results, limitations, Codemagic/TestFlight notes, and the requested manual checklist.
