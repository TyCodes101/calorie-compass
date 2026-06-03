# Camera, OCR, and Meal Photo Foundations

This branch adds native, non-premium foundations for barcode camera scanning, nutrition label OCR, and meal photo attachment references.

## Included

- Barcode scanner foundation using AVFoundation.
- Manual barcode fallback with create-custom, Quick Add, and AI-description options.
- Vision OCR text extraction for nutrition label photos.
- Manual nutrition-label confirmation fields that create a normal review-before-save draft.
- PhotosUI meal photo picker with a local-only draft preview.
- Camera and photo usage copy for generated iOS Info.plist values.

## Preserved Boundaries

- No StoreKit, subscription, paywall, paid entitlement, or premium gating code.
- No MyFitnessPal data, API, code, branding, UI, or database.
- No backend OCR parsing and no hallucinated nutrition values.
- No automatic meal saving. Scanner, OCR, photo, and manual flows still require review before save.
- No heavy upload/storage dependency. Meal photo storage remains deferred until a backend storage path is explicitly designed.

## Deferred

- Persisting meal photos to the backend.
- Attaching photos to already saved meals.
- Automatic nutrition value parsing from OCR text.
- Camera-based meal photo capture.
