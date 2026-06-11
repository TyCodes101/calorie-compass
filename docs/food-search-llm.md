# LLM-Assisted Food Search

Food Search keeps nutrition facts provider-backed. OpenAI is used only on the backend to resolve search intent and optionally rank existing candidates.

Required production environment:

- `OPENAI_API_KEY`
- `OPENAI_FOOD_SEARCH_MODEL=gpt-4.1-mini`

Search flow:

1. Exact custom, recent, favorite, and local catalog matches are checked first.
2. The OpenAI resolver runs only when deterministic search is weak, typo-heavy, or likely brand/restaurant/serving-sensitive.
3. The backend searches the original query, normalized query, and resolver aliases against local and provider candidates.
4. OpenAI ranking may reorder candidates, but it cannot change nutrition, source labels, or provider facts.
5. If no provider-backed result is available and the query is reasonable, the fallback is labeled `Estimated` and `Needs Review`.

Caching:

- Resolver output is cached by lowercased trimmed query.
- Ranking output is cached by normalized query plus candidate signature.
- A selected-result shortcut is used only for safe, non-user-specific, high-confidence single results.
- These caches are process-local L1 caches only. They are not durable and should not be treated as shared storage on Vercel.
