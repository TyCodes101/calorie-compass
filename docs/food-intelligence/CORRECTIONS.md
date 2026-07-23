# Corrections and Learning

Conversation corrections modify the active pending meal through deterministic state transitions. Requested modifiers remain first-class review metadata, and a new explicit meal clears stale clarification state.

Search ranking learns only from confirmed local evidence currently available to the request:

- custom foods
- favorites
- recent confirmed meals
- previously selected source for the same identity
- stored serving and modifier context

This evidence changes ordering only. It never rewrites provider nutrition or global catalog records.

A persistent correction-event model with rejected candidate IDs, edited fields, resolver version, abuse resistance, and aggregate promotion policy is future work. Do not describe current recency ranking as global machine learning.
