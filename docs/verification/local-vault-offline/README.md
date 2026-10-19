# Local vault: offline simulator verification

Run on 2026-10-18 on an iOS 26.5 simulator (iPhone 17) in Expo Go 55.0.34, against the vault
implementation at commit `928785c` (before the review fixes and the split into separate pull
requests; the simulator run was not repeated after them, and the automated tests cover the fixed
behavior). Every server URL (`EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, web URL) was
overridden to an unreachable `.invalid` host, so no request could reach a real backend, and no
session token was stored. The "previously signed in" state was seeded by writing only the active-
account record (a fake subject, no credential) into the app's AsyncStorage. Photos are simulator
sample images and a stock image from `web/public/images/mock`; no personal data appears.

| Step                                                                                               | Result                                                          | Screenshot                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Cold launch, server unreachable, no token                                                          | Studio opens signed in (no sign-in redirect)                    | `s1-offline-cold-launch.jpg`        |
| Create a build with a cover photo                                                                  | Saved locally, hero photo rendered from the vault               | `s2-build-created-offline.jpg`      |
| Add a reference photo                                                                              | Saved locally, shown in the gallery                             | `s3-reference-photo-offline.jpg`    |
| Create an element and link it to the build                                                         | Element and its generated task created; build counts update     | (accessibility tree)                |
| Create a convention with a cover photo, assign the build to day 1, generate packing, check an item | All saved locally; packing derived from the build               | `s5-convention-created-offline.jpg` |
| Force-quit Expo Go and relaunch, server still unreachable                                          | Home shows the build, the task and the convention countdown     | `s7-relaunch-home.jpg`              |
| Reopen the convention                                                                              | Day plan and the checked packing item persisted                 | `s8-relaunch-convention.jpg`        |
| Reopen the build                                                                                   | Photos and derived progress (1 / 2 tasks, 58%) persisted        | `s9-relaunch-build.jpg`             |
| Settings → Backup & restore → Save backup                                                          | 9 MB `.kyarafit` file written and handed to the iOS share sheet | `s11-backup-share-sheet.jpg`        |

The exported archive was checked outside the app: valid header and manifest, 20 rows across
builds, elements, workflow items and attachments, conventions, day plans, packing and reference
images, and 3 photos whose byte lengths matched the data section exactly; the build's photo was
stored as a portable `kyarafit-image:` token.

## Backup and restore into a fresh vault (2026-10-19, commit f8d822f)

Operator-provided live verification on an iOS 26.5 iPhone 17 simulator in Expo Go 55.0.34,
with every server URL overridden to an unreachable `.invalid` host and no session token.
The source planner contained 1 build with hero and reference photos, 1 linked element,
2 tasks, and 1 convention with 8 day plans and 1 checked packing item (20 items · 3 photos).

| Step                                                                              | Result                                                                                                       | Screenshot                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Settings → Backup & restore → Save backup → share sheet → Save to Files           | 8,960,351-byte `.kyarafit` archive: valid header, 20 rows, 3 images, 0 missing                               | `s11-backup-share-sheet.jpg`       |
| Activate a different account's fresh, empty vault → Choose backup → pick the file | 0 items · 0 photos becomes 20 items · 3 photos; “Backup restored: 20 added, 0 updated, 0 already up to date” | `s12-restore-into-fresh-vault.jpg` |
| Open the restored build                                                           | Hero and reference photos displayed; 1 / 2 tasks · 58%; 0 / 1 linked elements complete                       | `s13-restored-build.jpg`           |
| Open restored convention packing                                                  | Studio Con: 1 / 1 PACKED, BUILDS · 1                                                                         | `s14-restored-packing.jpg`         |

The three photo files in the destination account's vault directory were byte-identical to
those in the source vault. Screenshots contain only simulator sample photos and a fake account.

Covered by automated tests, not live-verified: repeated restore preserving newer edits,
identities and destination preferences; damaged archives or conflicting hierarchies;
unavailable photos and storage failures (`mobile/src/vault/portability.test.ts` and
`mobile/src/vault/cloudBackupDevice.test.ts`); reconnect after restore without duplicates
or account crossing (`mobile/src/offline/syncIdentity.test.ts`). These three focused test
files passed all 33 tests in this verification round.

Not covered here: the OS-level offline strip (the simulator shares the host network, so NetInfo
still reported reachable), the expired-session notice (the server was unreachable rather than
rejecting a session; unit-tested in `mobile/src/lib/auth/appSession.test.ts`), sign-out on the
simulator, a second device, and Android.
