# Search Normalization

Normalization converts user text into identity and serving intent. It never supplies calories or macros.

`NormalizedFoodQuery` contains:

- raw and cleaned text
- provider search text
- user-facing matched query
- requested quantity and unit
- natural serving hint
- detected brand or restaurant hint
- deterministic requested modifiers

## Matching rules

- Compare raw, canonical, and user-facing identity variants.
- Support spaced and compact forms such as `Kit kat` and `KitKat`.
- Support leading partial terms such as `Kit`, `Chip`, `Mc`, and `Sub`.
- Use bounded typo normalization for high-confidence forms such as `cheeots`, `chipolte`, and `mcdonlads`.
- Keep complete generic words distinct from incomplete prefixes. `chips` can be a category; `chip` remains a prefix.
- Preserve preparation terms that affect identity, such as grilled or cooked.
- Remove modifiers from provider identity queries while retaining them as review metadata.

Examples of retained modifiers include `no cheese`, `without mayo` normalized to `no mayo`, `extra grilled onions`, `light dressing`, `grilled not fried`, and `lettuce wrapped`.

Normalization is shared by local catalog matching and external providers. Adding a search-specific replacement in the iOS view or API route is prohibited because it would recreate divergent lookup behavior.
