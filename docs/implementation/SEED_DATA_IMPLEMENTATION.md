# Seed Data Implementation: Step-by-Step Guide

This guide implements **seed data for new users/devices**: a dummy first build, convention, and **one closet item** linked to the build, so Closet and Build detail screens are not empty. Do the steps in order; each step includes a **Cursor prompt** you can paste into Cursor to implement it.

---

## Goal and behavior

- **When**: Seed runs on first API access when `x-kyar-device-id` is present (see `wrapWithSeed` in `backend/main.go`) or when `POST /api/seed` is called.
- **Condition**: Skip if the device already has any builds (`ListByDevice` count > 0).
- **Create**: One build ("My First Build") with 4 tasks, one convention ("My First Convention"), **one closet item** (e.g. "Arlecchino Wig"), and **link that closet item to the build** so the build's "Linked items" section shows it.
- **Assets**: Use existing `BuildPlaceholderImage` and `ConventionPlaceholderImage` from `backend/internal/seed/images.go`; closet item can reuse the build image or a new constant.

---

## Prerequisites (current state)

- `backend/internal/seed/seed.go`: `CreateStarterData(ctx, deviceID, userID, buildRepo, conventionRepo)` creates build + 4 tasks and convention. No closet item; no link.
- `backend/main.go`: `closetRepo` exists (used for `/closet` routes). `wrapWithSeed` and `seedDataHandler` call `seed.CreateStarterData` with only `buildRepo` and `conventionRepo`.
- `backend/internal/closet/repository.go`: `Create(ctx, deviceID, userID, in CreateInput)` returns the created item (with `ID`).
- `backend/internal/builds/repository.go`: `LinkItems(ctx, buildID, deviceID, closetItemIDs []string)` links closet items to a build.

---

## Step 1: Add `closetRepo` to seed signature and wire it in `main.go`

**Do this first** so the seed package can create closet items.

**What to do**

1. In `backend/internal/seed/seed.go`:
   - Add import: `"kyarafit-backend/internal/closet"`.
   - Change `CreateStarterData` signature to accept `closetRepo *closet.Repository` as the last parameter:  
     `CreateStarterData(ctx, deviceID, userID, buildRepo, conventionRepo, closetRepo)`.
   - Do **not** yet create any closet item or call `LinkItems`; just add the parameter so callers compile.

2. In `backend/main.go`:
   - In `wrapWithSeed`: add parameter `closetRepo *closet.Repository`, and pass `closetRepo` into the call `seed.CreateStarterData(ctx, deviceID, userID, buildRepo, conventionRepo, closetRepo)`.
   - Update the single call site of `wrapWithSeed` to pass `closetRepo`:  
     `wrapWithSeed(deviceBuildsHandler.List, deviceBuildsRepo, conventionRepo, closetRepo)`.
   - In `seedDataHandler`: add parameter `closetRepo *closet.Repository`, and pass it into `seed.CreateStarterData(c.Context(), deviceID, userID, buildRepo, conventionRepo, closetRepo)`.
   - Update the route registration:  
     `app.Post("/api/seed", optionalUser, seedDataHandler(deviceBuildsRepo, conventionRepo, closetRepo))`.

**Files to touch**

- `backend/internal/seed/seed.go` (signature + import only)
- `backend/main.go` (wrapWithSeed, seedDataHandler, and their call sites)

**Cursor prompt**

```
In the Kyarafit backend, add the closet repo to the seed flow:

1. In backend/internal/seed/seed.go:
   - Add import for kyarafit-backend/internal/closet.
   - Add a new parameter to CreateStarterData: closetRepo *closet.Repository (last parameter).
   - Do not add any new logic yet; only update the function signature so callers must pass closetRepo.

2. In backend/main.go:
   - In wrapWithSeed: add a fourth parameter closetRepo *closet.Repository, and pass it into seed.CreateStarterData as the sixth argument.
   - Update the only call to wrapWithSeed (for builds list) to pass closetRepo as the fourth argument.
   - In seedDataHandler: add a third parameter closetRepo *closet.Repository, and pass it into seed.CreateStarterData. Update the route app.Post("/api/seed", ...) to pass closetRepo into seedDataHandler.

Keep idempotency and existing seed logic unchanged. Run `go build ./...` to verify.
```

---

## Step 2: Create one closet item in seed after the convention

**What to do**

1. In `backend/internal/seed/seed.go`, after the convention is created successfully (and before `return true, nil`):
   - Call `closetRepo.Create(ctx, deviceID, userID, closet.CreateInput{...})` with:
     - **Name**: `"Arlecchino Wig"` (or `"My First Piece"`).
     - **Category**: `"wig"` (valid per `backend/internal/closet/types.go`).
     - **ImageURL**: reuse `BuildPlaceholderImage` (same prototype wig image). Set as pointer: `ImageURL: &imageURL` where `imageURL := BuildPlaceholderImage`, or use a new variable.
     - **Tags**: `[]string{"arlecchino", "character", "grey"}` or empty `[]string{}`.
     - **Notes**: optional, e.g. `strPtr("Part of your first build. Link to builds from the build detail page.")`.
     - **CostCents**: nil or omit.
   - Ignore the returned item's other fields; you only need the returned `Item.ID` for the next step.
   - On error: return `false, err` so seed is not marked as created and can be retried.

2. **Order**: Keep the existing order: create build → create 4 tasks → create convention → **then** create closet item. Do not yet call `LinkItems` (Step 3).

**Files to touch**

- `backend/internal/seed/seed.go`

**Cursor prompt**

```
In backend/internal/seed/seed.go, after the convention is created and before `return true, nil`, create one seed closet item:

- Call closetRepo.Create(ctx, deviceID, userID, closet.CreateInput{...}).
- Use: Name "Arlecchino Wig", Category "wig", ImageURL pointing to BuildPlaceholderImage (reuse the same constant), Tags []string{"arlecchino", "character", "grey"}, Notes optional (e.g. "Part of your first build. Link to builds from the build detail page."), CostCents nil.
- If Create returns an error, return false, err from CreateStarterData.
- Store the created item's ID (returned from Create) in a variable for the next step; do not call LinkItems yet.

Keep the existing order: build → 4 tasks → convention → closet item. Run `go build ./...` and run the app to test POST /api/seed with a new x-kyar-device-id.
```

---

## Step 3: Link the seed closet item to the seed build

**What to do**

1. In `backend/internal/seed/seed.go`, immediately after creating the closet item (and after checking for error):
   - Call `buildRepo.LinkItems(ctx, buildID, deviceID, []string{closetItemID})` where `closetItemID` is the ID of the closet item just created (from `closetRepo.Create` return value) and `buildID` is the build created at the start of `CreateStarterData`.
   - On error: return `false, err` so seed is not marked as created.

2. **Order**: build → 4 tasks → convention → closet item → **LinkItems(buildID, deviceID, [closetItemID])** → return true, nil.

**Files to touch**

- `backend/internal/seed/seed.go`

**Cursor prompt**

```
In backend/internal/seed/seed.go, after creating the seed closet item (Step 2), link that closet item to the seed build:

- Call buildRepo.LinkItems(ctx, buildID, deviceID, []string{closetItemID}) where buildID is the ID of the build created at the start of CreateStarterData and closetItemID is the ID of the closet item just created.
- If LinkItems returns an error, return false, err from CreateStarterData.
- Then return true, nil.

Ensure the seed order is: create build → create 4 tasks → create convention → create closet item → LinkItems → return. Run `go build ./...` and test: trigger seed with a new device ID, then GET /builds/:id/items for the seed build and confirm the closet item ID is in the response.
```

---

## Step 4 (optional): Add `ClosetPlaceholderImage` in `images.go`

**What to do**

- If you want a **different** image for the closet item than the build (e.g. from `example screens/closet_inventory_grid`), add a new constant in `backend/internal/seed/images.go`, e.g. `ClosetPlaceholderImage = "https://..."`, and use it in `seed.go` for the closet item's `ImageURL` instead of `BuildPlaceholderImage`.
- If you are fine reusing the same wig image for both build and closet item, skip this step.

**Files to touch**

- `backend/internal/seed/images.go`
- `backend/internal/seed/seed.go` (use `ClosetPlaceholderImage` for the closet item if you add it)

**Cursor prompt**

```
Optional: In backend/internal/seed/images.go add a constant ClosetPlaceholderImage with a URL (e.g. from the project's example screens or a placeholder). In backend/internal/seed/seed.go use ClosetPlaceholderImage for the seed closet item's ImageURL instead of BuildPlaceholderImage. If we keep reusing BuildPlaceholderImage for the closet item, no change is required.
```

---

## Step 5: Testing and verification

**What to do**

1. **New device seed**  
   - Start the backend.  
   - Call `POST /api/seed` with header `x-kyar-device-id: test-seed-<random>` (or use a new UUID).  
   - Expect `201` and `"created": true`.  
   - Call `GET /builds` (with same device ID); expect one build.  
   - Call `GET /builds/:id/items` for that build's ID; expect one closet item ID.  
   - Call `GET /closet/items` (with same device ID); expect one closet item (e.g. "Arlecchino Wig").

2. **Idempotency**  
   - Call `POST /api/seed` again with the **same** device ID.  
   - Expect `200` and `"created": false`.  
   - Confirm there is still only one build and one closet item (no duplicates).

3. **Regression**  
   - First request to `GET /builds` with a **new** device ID (and no prior seed) should trigger seed in the background; after a moment, listing builds should show the seed build and listing closet items should show the seed closet item.

**Cursor prompt**

```
Verify the seed data implementation in the Kyarafit backend:

1. Start the backend (e.g. go run . in backend/). Then run these checks (replace BUILD_ID and CLOSET_ID with IDs from the responses):

   - POST /api/seed with header x-kyar-device-id: verify-seed-<random>. Expect 201 and "created": true.
   - GET /builds with same device ID: expect exactly one build. Note its id (BUILD_ID).
   - GET /builds/BUILD_ID/items with same device ID: expect one closet item ID. Note it (CLOSET_ID).
   - GET /closet/items with same device ID: expect one item, e.g. "Arlecchino Wig", with id matching CLOSET_ID.

2. Idempotency: POST /api/seed again with the same x-kyar-device-id. Expect 200 and "created": false. GET /builds and GET /closet/items again: still exactly one build and one closet item.

3. Optionally add a small script (e.g. backend/test_seed.sh or test_seed.ps1) that runs the above requests and checks, or add these as comments in docs/implementation/SEED_DATA_IMPLEMENTATION.md under Step 5.
```

---

## Summary: order of steps

| Step | Action |
|------|--------|
| 1 | Add `closetRepo` to `CreateStarterData` and wire it in `main.go` (wrapWithSeed + seedDataHandler). |
| 2 | In seed, after convention, create one closet item (name, category wig, image, tags, notes). |
| 3 | After creating closet item, call `buildRepo.LinkItems(ctx, buildID, deviceID, []string{closetItemID})`. |
| 4 | (Optional) Add `ClosetPlaceholderImage` and use it for the closet item. |
| 5 | Manually test new-device seed, idempotency, and first-access trigger. |

After Step 3, new users/devices will see one build, one convention, and one closet item, and the build’s “Linked items” will show that closet item.
