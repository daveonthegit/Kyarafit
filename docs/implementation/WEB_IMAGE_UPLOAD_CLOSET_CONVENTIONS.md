# Web: Image Upload in Closet and Conventions

Use the shared **ImageUpload** component (with backend upload) in closet and convention forms so images use the same pipeline as builds. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: [ImageUpload](web/src/components/ui/ImageUpload.tsx) is only used in [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx). Closet new page uses a custom file input and sends a **data URL** (max 2MB); convention new has no image field. Backend and sync support `image_url` for both.
- **Target**: Closet new/edit and convention new/edit use ImageUpload; on submit, send the returned URL (from `POST /api/v1/upload/image`) to the create/update API so images are stored in Supabase and syncable.

---

## Prerequisites

- [web/src/components/ui/ImageUpload.tsx](web/src/components/ui/ImageUpload.tsx): Accepts `category`, `onImageSelected(url)`, `currentImage`, `allowUrl`; uploads via API and returns URL.
- Backend: `POST /api/v1/upload/image` with `category=builds|conventions|closet`; returns URL.
- [web/src/app/closet/new/page.tsx](web/src/app/closet/new/page.tsx): Custom file input, data URL, 2MB limit.
- [web/src/app/conventions/new/page.tsx](web/src/app/conventions/new/page.tsx): No image field; backend convention has `imageUrl`.

---

## Step 1: Closet new page — replace file input with ImageUpload

**What to do**

- In [web/src/app/closet/new/page.tsx](web/src/app/closet/new/page.tsx): Remove the hidden file input and the custom `handleFileChange` / data URL state. Add the ImageUpload component with `category="closet"`, `onImageSelected={(url) => setImageUrl(url)}`, `currentImage={imageUrl}`, and `allowUrl={true}` if you want URL paste. Store the selected URL in state (e.g. `imageUrl`) and pass it to `createClosetItem` as `imageUrl` (string URL, not data URL). Ensure the create API accepts imageUrl and that the backend stores it.

**Files to touch**

- `web/src/app/closet/new/page.tsx`

**Cursor prompt**

```
In web/src/app/closet/new/page.tsx, replace the custom file input and data-URL handling with the shared ImageUpload component from web/src/components/ui/ImageUpload.tsx: (1) Import ImageUpload. (2) Remove the file input ref, imagePreview, imageDataUrl, handleFileChange, and MAX_IMAGE_SIZE data-URL logic. (3) Add state for imageUrl (string, the uploaded URL). (4) Render ImageUpload with category="closet", onImageSelected={(url) => setImageUrl(url)}, currentImage={imageUrl}, allowUrl={true}. (5) In the submit handler, pass imageUrl (the URL string from ImageUpload) to createClosetItem. Ensure the API and backend accept imageUrl for closet items. Run npm run build and test creating a closet item with a photo.
```

---

## Step 2: Convention new page — add image field with ImageUpload

**What to do**

- In [web/src/app/conventions/new/page.tsx](web/src/app/conventions/new/page.tsx): Add state for `imageUrl` (string). Add the ImageUpload component with `category="conventions"`, `onImageSelected`, `currentImage`, and optional `allowUrl`. In the create mutation, pass `imageUrl` to the createConvention API if the API supports it (check [web/src/lib/api/conventions.ts](web/src/lib/api/conventions.ts) and backend convention create). If the create payload does not include imageUrl, extend the API client and ensure the backend convention create accepts it.

**Files to touch**

- `web/src/app/conventions/new/page.tsx`
- Optionally `web/src/lib/api/conventions.ts` and backend convention handler if imageUrl is not yet accepted.

**Cursor prompt**

```
In web/src/app/conventions/new/page.tsx, add an optional image for new conventions: (1) Add state imageUrl (string). (2) Add ImageUpload with category="conventions", onImageSelected={(url) => setImageUrl(url)}, currentImage={imageUrl}, allowUrl={true}. (3) Pass imageUrl to createConvention in the mutation. If createConvention or the backend does not accept imageUrl, extend the API and backend so convention create/update accepts imageUrl. Check web/src/lib/api/conventions.ts and the backend convention create handler. Run npm run build and test creating a convention with an image.
```

---

## Step 3: Convention edit (if exists) — add ImageUpload

**What to do**

- If there is a convention edit page (e.g. conventions/[id]/edit or a modal), add ImageUpload there too: show current image, allow upload or URL, and pass updated imageUrl to the update convention API.

**Files to touch**

- Convention edit page or update form (e.g. under `web/src/app/conventions/`).

**Cursor prompt**

```
If the Kyarafit web app has a convention edit/update page, add ImageUpload to it: show current convention imageUrl, allow upload (category conventions) or URL, and include imageUrl in the update payload. If there is no edit page yet, skip or add a minimal edit route that includes image. Ensure backend PATCH/update convention accepts imageUrl.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Closet new: replace custom file input with ImageUpload (category closet); submit URL. |
| 2 | Convention new: add ImageUpload (category conventions); pass imageUrl to create. |
| 3 | Convention edit: add ImageUpload and pass imageUrl on update (if edit exists). |

After these steps, closet and convention images use the same upload pipeline as builds and are stored and synced correctly.
