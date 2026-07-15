# MacroMesh Product Trust and Polish Audit

Date: 2026-07-15

## Scope and constraints

This audit covers the compiled native iOS target and the backend contracts that drive Today, Log, History, Progress, Profile, onboarding, settings, meal review, food search, barcode lookup, and saved-meal reuse. The work deliberately preserves review-before-save, provider-backed nutrition, pending-meal idempotency, existing navigation, and legacy decoding.

## Current strengths

- The five-tab SwiftUI shell is consistent and uses shared colors, spacing, cards, loading states, retry copy, and tab-bar clearance.
- Log already supports natural language, structured pending review, serving edits, barcode lookup, food search, favorites, recents, custom foods, and duplicate-save guards.
- Nutrition provenance survives the backend-to-iOS contract through source, trust, provider, match, modifier, and review metadata.
- Food search merges local verified foods, custom foods, favorites, recents, and external providers, then deduplicates and ranks candidates.
- Analytics, streaks, weight sanitization, reusable meals, and assistant memory already provide a useful base for personalization.
- Most controls use semantic fonts and accessibility labels, and primary loading/error/empty states are present.

## Findings

### Trust and language

- Meal review presents confidence and source as separate badges, but does not explain why the match is trustworthy or why review is required.
- Source wording differs across review, search, and history. Internal provider names can become user-facing fallback copy.
- Search can explain an AI ranking reason, but it does not consistently distinguish a corrected query, a learned preference, and a source-backed identity match.
- Success copy generally preserves review-before-save, but trust language needs one shared vocabulary.

### Intelligence and learning

- Saved meals, favorites, preferred servings, corrections, restaurants, and brands are recorded, but food-search ranking does not use the learned signals deterministically.
- Restaurant and brand memory extraction relies on fixed name lists, so unfamiliar brands cannot become learned preferences.
- Recent/favorite meals appear as quick actions, but repeated item co-occurrence is not used for subtle suggestions.
- The OpenAI resolver handles typo-heavy input and ambiguity, but high-confidence normalization is not surfaced as quiet correction copy in the native search sheet.

### History

- History is grouped and sorted well and already supports favorite and relog actions.
- It is not searchable by meal, food, source, meal type, date, calorie value, or protein value.
- There is no quick filter for recent meals or higher-protein meals.
- The actions menu is accessible, but a swipe shortcut would make frequent relogging faster.

### Progress

- Seven-day calorie/protein averages, weight trend, milestones, and consistency copy are present.
- The progress API does not expose goal-hit count, logged-day count, weekend-versus-weekday behavior, most logged foods/restaurants, or typical meal timing.
- The UI reserves a tile for average deficit even though the value is unavailable, which reduces confidence.

### Performance and state

- Lazy stacks/grids and stale-request IDs are used appropriately.
- Food search waits for an explicit submit, avoiding quota-heavy autocomplete, and ignores stale callbacks.
- Derived history filtering and suggestion ranking should be pure, bounded, and computed from small local collections.
- Repeated load calls are guarded, though user-facing loading announcements are inconsistent.

### Accessibility

- Semantic text styles and many explicit labels are already present.
- Source badges need a combined VoiceOver explanation rather than two terse status chips.
- Loading and result transitions should announce meaningful state changes.
- New animations and success feedback must honor Reduce Motion.
- History filters and swipe actions need clear labels and non-gesture alternatives.

### Visual consistency and delight

- The current green-led design system is coherent; a redesign would add risk without fixing trust.
- A compact explanation row, a subtle learned suggestion, and restrained save feedback are enough polish.
- New content must stay inside existing cards and use the current spacing/type hierarchy.

## Implementation decisions

1. Add a shared native trust presentation that maps existing source and review metadata to a short badge plus a natural explanation. It never shows provider IDs or numeric confidence.
2. Add deterministic preference ranking from existing favorites and recent confirmed meals. Learned preference can reorder identity-compatible candidates but cannot change nutrition or override identity safeguards.
3. Infer restaurant and brand memory from structured source metadata instead of a fixed brand list.
4. Generate at most one dismissible meal suggestion from foods the user has actually logged together. Adding it creates another review item; it never saves automatically.
5. Add bounded local History search and filters while retaining visible one-tap relog/favorite controls and adding long-press alternatives.
6. Extend deterministic analytics with logged days, goal-hit days, common foods/restaurants, meal timing, and weekend/weekday averages. All new native fields decode optionally.
7. Add VoiceOver-friendly trust copy, loading/result announcements, and Reduce Motion-aware transitions.
8. Align Calorie API requests with the documented `X-API-Key` contract after a sanitized live check proved the extra usage header caused a 403 response.

## Provider validation notes

- Calorie API authenticated successfully with the documented server-side API-key header. Its credential was never printed, returned, or committed.
- FatSecret credentials authenticated when no scope was requested, while the configured `premier` scope returned `invalid_scope`. Text search remains fail-soft until that account is granted `premier`; changing code cannot grant an account entitlement.
- OpenAI, USDA, Open Food Facts, and the enabled UPC Database check were reachable during the live pipeline validation.

## Explicit non-goals

- No new nutrition provider, hardcoded food database, or LLM-generated nutrition.
- No database migration or secret handling change.
- No automatic meal save, background correction, or silent serving mutation.
- No replacement of existing screens, navigation, or pending-meal state.
- No claim of perfect or medical-grade nutrition accuracy.

## Manual QA focus

- Dynamic Type at accessibility sizes on review, search, history filters, and progress tiles.
- VoiceOver reading order and action names for review items, trust explanations, filters, and relog actions.
- Reduce Motion behavior for review/save transitions.
- Dark mode contrast for trust and suggestion surfaces.
- Search correction and preference ordering with a real account containing favorites and recents.
- History search across restaurant, brand, item, date, calories, protein, and meal type.
- Progress copy with zero, partial, and seven fully logged days.

## Rollback

The changes are additive and isolated. Revert the polish commit(s) to restore prior UI and ranking behavior. No migration or saved-data transformation is required. Optional response fields preserve compatibility with older builds during rollback.
