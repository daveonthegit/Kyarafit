# G2 visual evidence

Before/after captures of the account and subscription screens at 430 × 932, using
local Expo web, the real React Native Web / NativeWind renderer and bundled app fonts.
Account, Convex, image-picker and billing adapters use synthetic fixtures; no live account
or backend requests were made. The before screens are from the integration base `9130e0e`.
These are browser previews, not iOS/Android device acceptance or store-purchase evidence.

Headless Chrome captured each PNG with `--headless --disable-gpu --window-size=430,932
--virtual-time-budget=10000 --screenshot=<absolute-worktree-path> <local-url>`.
Each file was checked with `stat` and visually inspected.

| Screen       | Before                            | After                           |
| ------------ | --------------------------------- | ------------------------------- |
| Account      | [Before](account-before.png)      | [After](account-after.png)      |
| Subscription | [Before](subscription-before.png) | [After](subscription-after.png) |

All scrolling panels use the frozen opaque glass fallback (`blur={false}`) to avoid
per-row blur. Owner-device review remains an integration acceptance step.
