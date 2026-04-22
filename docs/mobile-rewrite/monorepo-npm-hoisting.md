# npm workspaces: Expo Router + typed routes

`@expo/cli` resolves `expo-router` from the **repository root** `node_modules` when generating typed routes (`experiments.typedRoutes`). In a workspace layout, `expo-router` lived only under `mobile/`, which broke `require("expo-router/_ctx-shared")`.

**Mitigation**

1. **Root dependencies** — The root `package.json` lists **`expo-router`** (same range as `mobile`), plus **`react`** and **`react-dom`** at **19.2.5**, so the CLI and Metro resolve one hoisted copy next to `expo` / `@expo/cli`.
2. **Overrides** — Root `overrides` pin `react` and `react-dom` to **19.2.5** (alongside the existing `react-native` → `hermes-compiler` override) so optional peers around `react-server-dom-webpack` stay consistent.
3. **`.npmrc`** — `legacy-peer-deps=true` is set at the repo root. Without it, npm v9+ often hits `ERESOLVE` when `expo-router` pulls optional RSC peers against a hoisted React. The install graph is still pinned by the lockfile; run `npm install` after dependency edits.
4. **Web tests** — `@testing-library/react` expects **`@testing-library/dom`** as a peer. With `legacy-peer-deps`, that peer is not auto-installed, so **`web` declares `@testing-library/dom` in `devDependencies`** explicitly.

**Expo may warn** that it “expects” React **19.2.0** (SDK 55’s bundled pin) while the repo uses **19.2.5**. That is intentional for peer resolution; if anything regresses on-device, compare against Expo’s release notes before downgrading.

**Verify:** after `npm install`, `node_modules/expo-router/_ctx-shared.js` exists at the repo root, `node -e "require('expo-router/_ctx-shared')"` prints nothing (ok), and `npm run dev:mobile` starts without the `_ctx-shared` module error.
