# Mobile rewrite — Phases 2–4 (implementation summary)

This document captures what was implemented after **Phase 1 (foundation)** to advance Phases **2 (core flows)**, **3 (parity)**, and **4 (polish)**.

## Phase 2 — Core flows

### Outfits (builds) list (`app/(tabs)/builds.tsx`)

- Uses Convex `builds.list` with **server-side** `search`, `sortBy`, `order`, and `status` when signed in.
- **Search** field (client + server).
- **Sort** presets: Name A–Z, Z–A, Deadline, Progress (mapped to Convex sort fields).
- **Filter tabs** unchanged (All / Current / Planning / Done / Archived).
- **Local-only** users: same filters applied in memory on SQLite-backed list.

### Build detail (`app/build-detail.tsx` + `src/components/build/BuildDetailCloudSections.tsx`)

- **Hero image**: `StorageImage` when Convex provides `imageStorageId` / `imageUrl`.
- **Share & visibility**: private / unlisted / public (updates via `builds.update`).
- **Share link**: `Share.share` using `getBuildShareUrl` (`src/lib/webOrigin.ts`). Set `EXPO_PUBLIC_WEB_ORIGIN` for production URLs.
- **Notes**: view + edit (saves with `builds.update`).
- **Reference images** & **progress photos**: horizontal lists, Convex `files.generateUploadUrl` + `buildReferenceImages` / `buildProcessPictures` add/remove (long-press to remove).
- **Collaborators**: read-only list from `buildCollaborators.listByBuild`.

### Closet (`app/(tabs)/closet.tsx`, `app/closet-detail.tsx`)

- Closet list uses Convex `closetItems.list` with **search** + **category** when signed in; local path unchanged.
- **Tapping an item** opens **`/closet-detail`** (detail, edit, delete, “used in outfits” when cloud).

### Planner (`app/(tabs)/planner.tsx`)

- **Calendar** tab: month grid with prev/next, dots on days that have **due tasks** (from `listForPlanner` `dueDate`).

## Phase 3 — Parity surfaces

### Groups (`app/groups.tsx`, `app/group-detail.tsx`)

- **Groups**: `groups.listForUser` → list UI; tap → group detail.
- **Group detail**: `groups.getWithMembers` → description + members.

### Discover & feed (`app/discover.tsx`, `app/feed.tsx`)

- **Discover**: `builds.listDiscover` (public builds grid).
- **Feed**: `builds.listFeedFromFollowing` when signed in; sign-in prompt when logged out.

### Tier & settings (`src/hooks/useTier.ts`, `app/settings.tsx`)

- **`useTier` / `useFeatureAccess`** aligned with web (`users.getMe`).
- **Settings** shows plan tier, storage usage, and short feature hints.

## Phase 4 — Polish / supporting work

- **`src/lib/webOrigin.ts`**, **`src/lib/convexUpload.ts`**: share URLs and Convex file POST helper.
- **`src/components/shared/StorageImage.tsx`**: resolves `_storage` via `files.getUrl`.
- **`env.example`**: documents `EXPO_PUBLIC_WEB_ORIGIN`.
- Typed routes: some `router.push` calls use `as unknown as Parameters<typeof router.push>[0]` until Expo regenerates routes after new files.

## Additional parity (post Phases 2–4)

- **Social on builds**: `BuildSocialSection` — likes + comments when visibility is not `private` (same Convex rules as web public build pages).
- **Collaborators**: owners can **invite by email** (`buildCollaborators.addByEmail`) and **remove** collaborators from `BuildDetailCloudSections`.
- **Public profiles**: `app/user/[username].tsx` — `users.getByUsername`, `builds.listPublicByUser`, **Follow/Unfollow** (`follows.*`). Linked from Discover, Feed, and comments.
- **Profile tab screen**: `profile.tsx` — session + Convex user, links to **public profile**, **account**, and **settings**.
- **Settings hub**: `app/settings/` stack — **index**, **account** (Better Auth name + Convex `updateProfile`, profile image upload, bio, public/private, password reset link), **notifications** (placeholder, matches web), **subscription** (tier + storage).
- **Groups**: `group-new.tsx` — `groups.create`; Groups list **New** action in header.
- **Events**: `convention-edit.tsx` — `conventions.update`; **Edit** on convention detail for owner.

## Full-parity additions (ongoing)

- **Visual board**: `BuildVisualBoardMobile` on build detail — tabbed grid (All / References / Progress / Closet), fullscreen modal; **DnD / drop-to-task** remains web-only (`@dnd-kit`).
- **Build edit**: cloud **hero image** via library picker with **crop** (`allowsEditing` + aspect), upload to Convex storage.
- **Link closet items**: `build-link-items` supports **signed-in Convex** (add/remove links) as well as local SQLite.
- **Closet item detail**: parity with web — tags, status, cost, item link, notes, **photo replace**, **tasks** (`listByClosetItem` + create/delete), **add/remove outfits** (`addItemsToBuild` / `removeItemFromBuild`).
- **i18n**: `i18next` + `react-i18next` + `expo-localization`; locales **`src/i18n/locales/en.json`** & **`es.json`** (aligned with web `messages/`). **Language** toggle in **Settings** (persisted in AsyncStorage). Tab labels + menu use translations.

## Follow-ups

- **Stripe**: embedded checkout / customer portal — still primarily **web**; mobile shows tier and can open web.
- **Remaining strings**: many screens still hard-coded English; extend `locales/*.json` and replace incrementally.
- **Remove Ionicons** where desired in favor of `KyarIcon`.
- Regenerate Expo typed routes so `router.push(... as unknown as …)` casts can be removed.

## Files touched (high level)

| Area            | Files                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Builds          | `app/(tabs)/builds.tsx`                                                      |
| Build detail    | `app/build-detail.tsx`, `src/components/build/BuildDetailCloudSections.tsx`  |
| Closet          | `app/(tabs)/closet.tsx`, `app/closet-detail.tsx`                             |
| Planner         | `app/(tabs)/planner.tsx`                                                     |
| Social / groups | `app/groups.tsx`, `app/group-detail.tsx`, `app/discover.tsx`, `app/feed.tsx` |
| Tier            | `src/hooks/useTier.ts`, `app/settings.tsx`                                   |
| Shared          | `StorageImage.tsx`, `webOrigin.ts`, `convexUpload.ts`                        |
| Config          | `env.example`                                                                |
