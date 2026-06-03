# MFP-Style Food Logging Foundations

This branch adds non-premium food logging workflows without adopting proprietary MyFitnessPal data, branding, APIs, or UI. All paths preserve MacroMesh's review-before-save rule: food search, barcode lookup, custom foods, recent/frequent/favorite meals, and manual quick add create a review draft instead of saving directly.

## Included

- Verified/local food search, plus user custom foods, favorites, and recent meals.
- Manual barcode lookup by typed UPC/EAN digits.
- Custom food creation with optional barcode storage.
- Serving quantity adjustment on the review card, with calorie and macro scaling.
- Manual Quick Add for calories and macros.
- Meal photo and nutrition label OCR entry points as no-upload, no-camera, no-OCR foundations.

## Explicitly Deferred

- Camera barcode scanning.
- OCR/Vision extraction from nutrition labels.
- Meal photo uploads, storage, and analysis.
- StoreKit, subscriptions, paid entitlements, and premium gating.
- External nutrition APIs that are not already configured.

The deferred entry points intentionally avoid camera, photo library, OCR, payment, and new third-party dependencies. When those features are implemented later, they should still create editable review drafts and must not auto-save meals.
