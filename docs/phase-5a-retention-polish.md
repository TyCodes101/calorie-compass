# Phase 5A Retention And Polish

Scope for `feature/app-store-premium-polish`.

## Implemented

- Local notification reminders: meal reminder and weekly report reminder are scheduled on-device with `UNUserNotificationCenter`.
- Weekly report: backend helper and API surface summarize the last seven days of logged meals, target days, averages, and highlights.
- Custom foods: native profile entry and log quick-add use the existing reusable meal storage model without a schema migration.
- App Store polish: native profile copy documents what is implemented and keeps nutrition review-before-save expectations visible.

## Explicitly Deferred

- Barcode scanner native UI.
- OCR.
- Meal photo uploads.
- StoreKit payments.
- Real subscriptions.

This phase does not add camera permissions, StoreKit dependencies, payment capabilities, subscription products, signing changes, Codemagic changes, or TestFlight/App Store Connect configuration changes.

## QA Focus

- Meal logging and review-before-save still use the existing assistant flow.
- Today, History, Profile, and guest mode should continue to load without requiring custom foods or reminders.
- Custom foods are saved as trusted one-item reusable meal templates with a `Custom food:` raw text prefix and are filtered out of favorite meal suggestions.
- Weekly report should degrade to an empty state when no backend database or profile is available.
