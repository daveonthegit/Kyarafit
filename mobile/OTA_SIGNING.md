# Mobile credential and update release checks

The mobile bearer store uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on iOS. Reads, writes,
rewrites of existing entries, and deletion use the same key and options. Android
SecureStore backup exclusions are enabled through its Expo config plugin; no biometric
prompt is added. Existing credentials are rewritten on hydration, but backups made by
older binaries cannot be retroactively changed. Failed storage operations never authorize
requests from the in-memory cache. A deletion failure must be resolved before treating
logout as durable across process restarts.

Sign-out captures the bearer header for server revocation and immediately clears memory.
A failed persistence deletion does not prevent that authenticated request: cleanup is retried
after the response, with persistent failure surfaced as non-durable logout. Failed hydration
can retry after device unlock, without rehydrating an explicitly cleared session. Successful
password reset clears the initiating session's bearer persistence; failed or delayed reset
responses do not clear a newer sign-in. Server-side session revocation remains the backend's
responsibility.

## Operator inputs (no private material in the app)

`mobile/app.config.js` is the authoritative OTA configuration. Static `app.json` disables
updates. Without signing inputs, local/development config keeps OTA disabled and uses the
embedded bundle. Preview, production, and other non-development build profiles or update
channels fail configuration instead of building unsigned release binaries.

The operator must supply:

- `KYARAFIT_UPDATES_CERTIFICATE`: a path **relative to `mobile/`** to one PEM public
  X.509 certificate, available during config evaluation, native build, and update export.
  It must contain a currently valid RSA key of at least 2048 bits with code-signing usage.
- `KYARAFIT_UPDATES_KEY_ID`: the operator's matching signing key identifier.

Both must be supplied together. The config emits Expo's `rsa-v1_5-sha256` signing metadata
and does not allow unsigned manifests or disabled anti-bricking protection. Only the
public certificate is embedded in the binary. An operator-reviewed public certificate may
be versioned; a private key or mixed PEM bundle must never be committed, uploaded with app
sources, put in `EXPO_PUBLIC_*`, or placed inside this repository. Provision the private
signer through the release operator's protected environment. Do not generate credentials
as part of routine testing. No certificate or signer is supplied by this change.

Expo references: [update code signing](https://docs.expo.dev/eas-update/code-signing/),
[SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), and
[updates configuration](https://docs.expo.dev/versions/latest/config/app/#updates).

## Required development-device acceptance (operator/release lane)

Unit tests cover storage races, headers, reset cleanup, missing/invalid config, and signing
policy over a parsed certificate model. They **do not** prove native signature verification.
Do not mark OTA rollout accepted until the following checks are recorded for both iOS and
Android, using an operator-authorized disposable update channel and no production data.

1. Supply the approved public certificate and matching key id. Resolve config from
   `mobile/` with `npx expo config --type prebuild`; verify signing metadata and SecureStore
   backup exclusions in the resulting native configuration. Build/install internal test
   binaries with embedded signing configuration (`preview` distribution, not Expo Go).
   Use a disposable channel selected by the release operator; production is not a target.
2. With an authorized test account, verify login, app restart hydration, logout, failed and
   successful reset, and offline startup. Check that logout revokes the server session and
   does not restore local authorization after restart. Exercise iOS locked/unlocked access
   and Android backup/restore exclusion using test-device procedures, not user backups.
3. Publish a harmless test update using the protected signer, for example the operator's
   `eas update --channel <test-channel> --private-key-path <protected-path>` from `mobile/`.
   Keep certificate/key-id configuration present during export. Confirm on each installed
   binary that the signed update is downloaded and launched, recording runtime version,
   platform, update id, and result (no tokens or private key paths in evidence).
4. On a disposable update endpoint/channel under operator control, test an unsigned
   manifest, wrong-key signature, and a manifest changed **after** signing. EAS signs the
   final manifest, so editing sources and signing again is not a tampering test. Confirm
   the native verifier rejects each case and retains the last valid/embedded bundle after
   restart, without an update loop. Record native failure classification without user data.
5. Verify offline/fetch failure still launches the embedded or last valid bundle. Record
   pass/fail and stop rollout on any mismatch; do not weaken verification to recover.

Signing inputs and native/device infrastructure are pending operator provisioning. No
signed-update acceptance or tampered-update rejection on a device is claimed yet.

## Rotation and recovery

- A certificate is baked into native binaries, not safely replaced by an OTA update.
  Before expiry/rotation, the operator provisions a new signer, supplies its public
  certificate/key id, changes the app version/runtime boundary, and distributes new native
  binaries. Repeat the acceptance matrix before enabling their update channel.
- Preserve the previous runtime/channel and protected signer while supported older binaries
  still need updates. Do not publish new-key updates to old binaries' runtime. This app uses
  `runtimeVersion.policy: appVersion`; a build-number-only increment is not a new runtime.
- For a bad signed update, publish/repoint to a known-good **signed** update on the same
  compatible runtime using the authorized release tools, and verify recovery on test devices
  before any production operation. Do not bypass signing or anti-bricking protections.
- For a lost/compromised private signer or expired certificate, stop publishing with it and
  ship a new native binary/runtime. Credential rotation, rollout, and app distribution belong
  to the operator, not an implementation worker.
