# MacroMesh App Icon Update

The installed iOS app icon is controlled by the native Xcode asset catalog:

`ios/CalorieCompass/Assets.xcassets/AppIcon.appiconset`

The Xcode project points Debug and Release builds at this catalog with
`ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`.

## Current Source

The July 2026 MacroMesh icon was generated from:

`C:\Users\tyler\Downloads\ChatGPT Image Jul 8, 2026, 11_51_46 PM.png`

The source image was normalized into opaque PNGs for every iPhone, iPad, and
App Store size declared in `Contents.json`.

## Replacing Later

To replace the icon again:

1. Start with a 1024x1024 PNG or larger.
2. Keep the image opaque. iOS app icons must not contain transparency.
3. Preserve safe padding around the logo so small icon sizes remain readable.
4. Regenerate every PNG in `AppIcon.appiconset` from the same source.
5. Confirm each generated file matches its `Contents.json` size and has no alpha channel.

## Build Note

App Store Connect metadata cannot change the installed app icon. A new
Codemagic/TestFlight build from a commit containing these asset changes is
required for the new MacroMesh logo to appear on installed devices.
