# Meal Decomposition First Logger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make meal logging decompose user text into separate meal components before nutrition resolution so the app no longer drops foods, collapses mixed meals, ignores modifiers, or silently substitutes unrelated branded foods.

**Architecture:** OpenAI remains the parser/reasoner only: it returns strict meal decomposition intent. The existing resolver remains responsible for nutrition and runs per decomposed item, with deterministic fallback splitting for common connector/combo patterns when OpenAI is unavailable or rejected.

**Tech Stack:** Next.js 16, TypeScript, Zod, Vitest, SwiftUI native client models.

---

### Task 1: Red Tests For Decomposition Failures

**Files:**
- Add: `tests/openai-meal-decomposition.test.ts`
- Add: `tests/meal-decomposition-flow.test.ts`
- Add: `tests/meal-review-copy-format.test.ts`

- [x] Add table-driven OpenAI decomposition mapping tests for Panda Express bigger plate, steak/potato/sour cream/chives, eggs/butter/toast/jam, Five Guys no bun, Diet Coke, and Trader Joe's gummy worms.
- [x] Add integration tests through `runMealAssistant` that prove multi-food messages produce multiple pending review items and do not ask clarification when the user already provided quantity/modifier details.
- [x] Add copy/formatting tests proving pending-review replies do not say "logged" before save and quantities do not render scientific notation.
- [x] Run the new focused tests and confirm they fail for the current missing behavior.

### Task 2: Strict Meal Decomposition Contract

**Files:**
- Modify: `lib/ai/openaiFoodIntelligence.ts`

- [x] Extend the structured output schema with `mealContext`, item-level `canonicalName`, `servingDefault`, `mustIncludeTerms`, `mustNotMatchTerms`, item confidence, and clarification flags.
- [x] Update the OpenAI system prompt so every food logging message is decomposed into separate components before resolver lookup.
- [x] Map decomposition items into existing `MealAssistantModelOutput.items` without carrying calories, macros, trusted source labels, or save decisions.
- [x] Run OpenAI wrapper tests and confirm the new schema is validated and unsafe nutrition claims are still rejected.

### Task 3: Deterministic Fallback Decomposition

**Files:**
- Modify: `lib/ai/runMealAssistant.ts`

- [x] Add a small parser for connector/combo patterns: commas, `and`, `with`, `plus`, `topped with`, restaurant combo labels, and cooked-in/topping phrases.
- [x] Preserve restaurant/brand context and modifiers for every fallback item.
- [x] Ensure fallback items are resolved independently through the existing item loop.
- [x] Add natural serving defaults for obvious restaurant items: burger, sandwich, McGriddle, taco, burrito, bowl, footlong, 6-inch sub, drink.

### Task 4: Identity And Serving Guardrails

**Files:**
- Modify: `lib/ai/runMealAssistant.ts`
- Modify: `lib/nutrition/providers/localVerifiedCatalog.ts` only if an existing guarded catalog entry is missing for a required regression.

- [x] Reject or downgrade provider results that violate must-not-match terms or protected brand/restaurant kind.
- [x] Prevent Diet Coke from resolving to energy drinks and Trader Joe's gummies from resolving to cookies.
- [x] Keep explicit user units and natural restaurant units in the review payload instead of defaulting to 100g.
- [x] Keep `no bun`, `no rice`, `no cheese`, `double chicken`, `extra onions`, and similar modifiers in query text/notes.

### Task 5: Validation And Release

**Files:**
- Modify test snapshots or docs only if behavior intentionally changed.

- [x] Run Prisma generate.
- [x] Run ESLint.
- [x] Run Next build.
- [x] Run full Vitest.
- [x] Run focused meal assistant, resolver, food gauntlet/fuzz, idempotency, and API failure tests.
- [x] Run iOS tests if local tooling is available; otherwise verify CI after push.
- [x] Commit, push, update the PR, and report exact before/after behavior and remaining TestFlight risks.
