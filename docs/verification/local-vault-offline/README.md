# Local vault: offline simulator verification

Run on 2026-10-18 on an iOS 26.5 simulator (iPhone 17) in Expo Go 55.0.34, against the vault
implementation at commit `928785c` (before the review fixes and the split into separate pull
requests; the simulator run was not repeated after them, and the automated tests cover the fixed
behavior). Every server URL (`EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, web URL) was
overridden to an unreachable `.invalid` host, so no request could reach a real backend, and no
session token was stored. The "previously signed in" state was seeded by writing only the active-
account record (a fake subject, no credential) into the app's AsyncStorage. Photos are simulator
sample images and a stock image from `web/public/images/mock`; no personal data appears.

| Step                                                                                               | Result                                                      | Screenshot                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| Cold launch, server unreachable, no token                                                          | Studio opens signed in (no sign-in redirect)                | `s1-offline-cold-launch.jpg`        |
| Create a build with a cover photo                                                                  | Saved locally, hero photo rendered from the vault           | `s2-build-created-offline.jpg`      |
| Add a reference photo                                                                              | Saved locally, shown in the gallery                         | `s3-reference-photo-offline.jpg`    |
| Create an element and link it to the build                                                         | Element and its generated task created; build counts update | (accessibility tree)                |
| Create a convention with a cover photo, assign the build to day 1, generate packing, check an item | All saved locally; packing derived from the build           | `s5-convention-created-offline.jpg` |
| Force-quit Expo Go and relaunch, server still unreachable                                          | Home shows the build, the task and the convention countdown | `s7-relaunch-home.jpg`              |
| Reopen the convention                                                                              | Day plan and the checked packing item persisted             | `s8-relaunch-convention.jpg`        |
| Reopen the build                                                                                   | Photos and derived progress (1 / 2 tasks, 58%) persisted    | `s9-relaunch-build.jpg`             |

Not covered here: the OS-level offline strip (the simulator shares the host network, so NetInfo
still reported reachable), the expired-session notice (the server was unreachable rather than
rejecting a session; unit-tested in `mobile/src/lib/auth/appSession.test.ts`), sign-out on the
simulator, and Android.
