# Hermes V1 rollback runbook

Use when iOS crash-free rate drops below 99%, Android native builds fail repeatedly, or an upstream React Native / Expo regression blocks releases with Hermes V1 enabled.

## What “Hermes V1” means here

- `expo-build-properties` in `mobile/app.json` sets `ios.useHermesV1` and `android.useHermesV1` to `true`, with `buildReactNativeFromSource: true` on both platforms.
- Root `package.json` uses `overrides` so `react-native` resolves `hermes-compiler@250829098.0.4` (required by the Expo plugin validator).

## Rollback steps (Hermes V0 / default compiler)

1. **Edit `mobile/app.json`** — in the `expo-build-properties` plugin, set:
   - `ios.useHermesV1`: `false`
   - `android.useHermesV1`: `false`
   - Remove `buildReactNativeFromSource` from both platforms **unless** another feature still requires it (after rollback it is usually unnecessary).

2. **Optional: remove `hermes-compiler` override** — if you no longer need the V1 compiler pin, remove the `overrides.react-native.hermes-compiler` entry from the root `package.json` and run `npm install` at the repo root. Regenerate the lockfile if dependency resolution conflicts appear.

3. **Rebuild** — run EAS builds for `development` (or `preview`) on iOS and Android and confirm the app boots and passes smoke tests.

4. **OTA** — if you use EAS Update, publish a new update from the rollback commit so clients on the affected channel receive a compatible bundle.

## Restore Hermes V1

Revert the `app.json` diff, restore the `hermes-compiler` override if it was removed, run `npm install`, confirm `npx expo config --type public` runs without errors from `expo-build-properties`, then ship new native builds (Hermes V1 is a native compile-time setting).

## Triggering criteria (when to execute this runbook)

- iOS crash-free sessions fall **below 99%** in the monitoring window and Hermes is a suspected cause.
- **Android** EAS build fails on the Hermes / RN compile path and the failure is not fixable within one release cycle.
- **Upstream** Expo or React Native documents a Hermes V1 regression affecting your SDK line.

## Commands reference

```bash
cd mobile
npx expo config --type public
```

```bash
# After config changes, from repo root
npm install
npm run typecheck -w mobile
```
