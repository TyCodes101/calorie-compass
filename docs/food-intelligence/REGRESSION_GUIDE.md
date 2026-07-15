# Regression Guide

Every production food failure becomes a table-driven fixture or invariant test.

Choose the narrowest durable layer:

- Decomposition failure: meal decomposition tests
- Identity or typo failure: normalization and release corpus
- Provider payload failure: provider schema/normalization fixture
- Serving failure: deterministic scaling tests
- Duplicate or conflict failure: Food Intelligence engine tests
- Conversation failure: pending meal state tests
- UI failure: Swift unit test or XCUITest

Regression assertions should cover identity, item count, quantity, unit, modifiers, source, review requirement, plausible nutrition, no duplicates, and save once. Never call a live provider in automated tests.
