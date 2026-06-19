# Food Identity Contract

MacroMesh uses source-backed food identity. The product goal is not to guess every food correctly; it is to be correct, clarify, or offer manual/estimated entry, and never confidently substitute a different product.

## Contract

1. Food identity is source-backed. A review card is allowed only when the backend has a verified, curated, USDA-style, or clearly estimated candidate whose identity matches the user's intent.
2. The LLM is a parser and reranker only. It may classify intent, normalize typos, generate search queries, rank known candidate IDs, and draft clarification wording.
3. No selected food reaches a review card unless backend identity validation approves it after retrieval and after any LLM/reranker output.
4. Clarification is preferred over a wrong result.
5. Estimates must be clearly labeled as estimates, with provenance explaining that no verified match was found.
6. Restaurant and branded foods require identity agreement across restaurant/brand, protected product family, and required product tokens.
7. Generic foods may use USDA-style or curated generic estimates when provenance is honest and no brand/restaurant identity is implied.
8. Saved meals must come from a structured pending review meal.
9. Nothing saves without explicit confirmation.
10. Wrong confident substitutions are product-breaking bugs.

## Resolution Statuses

Every food resolution must end as one of these statuses:

- `resolved`: safe for a pending review card.
- `needs_clarification`: no review card; ask the user to choose or provide detail.
- `needs_manual_entry`: offer manual entry or a clearly labeled estimate flow.
- `unsupported`: unable to resolve safely.

Downstream code must read the resolution status instead of inferring safety from ad hoc fields or assistant text.

## Forbidden Examples

- Baconator to any chicken sandwich.
- Baconnator typo to any chicken sandwich.
- McDouble to McChicken.
- McDouble no cheese to McChicken without cheese.
- Wendy's query to a McDonald's item.
- McDonald's query to a Wendy's item.
- Named restaurant item to an unrelated generic item.
- LLM-selected candidate ID that was not present in the retrieved candidate set.
- Text-only "added/logged/found" food responses without a structured pending meal or clarification.
