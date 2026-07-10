# MacroMesh design system refresh

## Source of truth

The iOS app icon at `ios/CalorieCompass/Assets.xcassets/AppIcon.appiconset/AppIcon-ios-marketing-1024x1024@1x.png` is the visual reference for this pass: near-black ink, a green mesh mark, and a teal/cyan edge. The same 1024px source is exposed to SwiftUI as `MacroMeshMark.imageset` for the in-app brand mark.

## Native tokens

Shared tokens live in `ios/CalorieCompass/MacroMeshDesign.swift`. They resolve light and dark values through dynamic `UIColor` providers, so the app does not force a global color scheme. Reusable pieces include:

- `MacroMeshGradientHeader`
- `MacroMeshBrandMark`
- `MacroMeshStatCard`
- `MacroMeshProgressRing`
- `MacroMeshBadge`
- `MacroMeshEmptyState`
- `MacroMeshLoadingState`

Existing meal logging, pending review, source labels, and save controls continue to use the same backend contracts and review-before-save flow.

## Web tokens

The web shell uses the same ink/green/teal direction in `app/globals.css`. The dashboard remains the first usable screen, and the logger remains reachable without a marketing detour.

## Later changes

Update the shared tokens first, then use the existing components in new screens. Do not add literal white surfaces to native views; use `MacroMeshTheme.card` so dark mode remains legible. The app icon and reusable mark are packaged in the binary, so icon changes still require a new Codemagic/TestFlight build.
