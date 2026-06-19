# AI Food Resolution Contract

MacroMesh can use AI to make food logging easier, but AI is not a source of truth for restaurant or branded nutrition.

The product contract is:

**Correct, clarify, or clearly estimated. Never confidently wrong.**

## AI Roles

AI may act as a:

- Parser for messy user text, quantities, modifiers, restaurant names, and brands.
- Normalizer for typos and search queries.
- Reranker for candidate IDs that the backend already retrieved.
- Clarification writer when identity is unsafe or ambiguous.
- Estimator only for generic/manual-estimate flows that are clearly labeled.

AI must not act as:

- A final authority for restaurant or branded foods.
- A creator of verified restaurant/branded candidates.
- A way around backend identity validation.
- A saver of meals without user confirmation.

## Model Output

Food resolution assists use this shape:

```ts
type AiFoodResolutionAssist = {
  intent: {
    rawText: string;
    searchText: string;
    restaurant?: string | null;
    brand?: string | null;
    modifiers: string[];
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  };
  normalizedQuery: string;
  restaurant?: string | null;
  brand?: string | null;
  productName?: string | null;
  productFamilyGuess?: string | null;
  modifiers: string[];
  quantity?: number | null;
  serving?: string | null;
  candidateRankings: Array<{
    candidateId: string;
    reason: string;
    confidence: number;
  }>;
  clarificationQuestion?: string | null;
  estimateRequest?: {
    reason: string;
    label: 'Estimated' | 'AI Estimated';
  } | null;
};
```

## Hard Rules

- AI may only select candidate IDs supplied by the backend candidate list.
- Unknown `candidateId` means the AI output is rejected.
- Backend identity firewall always runs after AI ranking.
- Firewall conflicts beat AI confidence.
- Protected restaurant items cannot cross incompatible product families.
- AI estimates are never `Restaurant Verified`, `Brand Verified`, or otherwise source-backed.
- Restaurant/branded requests clarify before offering an estimate when no exact source-backed item exists.
- Generic/homemade estimates must be labeled `Estimated` or `AI Estimated`.
- The app must not show a review card for an unsafe candidate.
- The app must not save a meal until the user confirms a pending review meal.

User trust beats speed.
