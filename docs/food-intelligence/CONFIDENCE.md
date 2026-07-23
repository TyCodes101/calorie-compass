# Confidence and Abstention

MacroMesh keeps source, confidence, and review requirement separate.

- `Verified` is reserved for an exact authoritative catalog or official restaurant record.
- `Matched` represents a strong structured database match.
- `Estimated` identifies AI or derived fallback nutrition.
- `Needs Review` identifies ambiguity, source disagreement, unsupported modifiers, or serving uncertainty.

Identity conflicts and implausible nutrition reject a candidate. Material disagreement between duplicate identities marks the selected atomic record for review; values are never averaged. A low-confidence result cannot become verified because an LLM prefers it.

Clarification is used when no safe dominant candidate exists or a serving/modifier cannot be represented honestly. Ordinary broad searches may return alternatives instead of blocking.
