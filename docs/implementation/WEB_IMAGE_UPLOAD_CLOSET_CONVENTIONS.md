# Web: Image Upload in Closet and Conventions

**Purpose:** Use the shared ImageUpload component (Convex file storage) in closet and convention forms so images use the same pipeline as builds. Mobile should use same Convex upload for closet and convention.

**Scope:** In: Closet new/edit, convention new/edit; Convex files (generateUploadUrl, getUrl). Out: POST /api/v1/upload/image, Supabase Storage.

**Current state:**

- **Convex:** [convex/files.ts](convex/files.ts) — generateUploadUrl, getUrl. Schema: closetItems and conventions have imageUrl, imageStorageId.
- **Web ImageUpload:** [web/src/components/ui/ImageUpload.tsx](web/src/components/ui/ImageUpload.tsx) — uses `useMutation(api.files.generateUploadUrl)`, uploads to URL, calls getUrl; returns storageId/url to parent.
- **Web usage:** [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx) and [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) — ImageUpload used. [web/src/app/closet/new/page.tsx](web/src/app/closet/new/page.tsx) — ImageUpload used. [web/src/app/conventions/new/page.tsx](web/src/app/conventions/new/page.tsx) — **no image field** (gap).
- **Convex mutations:** closetItems.create/update and conventions.create/update accept imageUrl and imageStorageId.

**Next steps:**

1. **Convention new (and edit if exists):** Add state for imageUrl/imageStorageId; add ImageUpload component with category appropriate for conventions (or reuse same Convex upload); on create/update pass imageUrl and/or imageStorageId to api.conventions.create/update.
2. **Closet new/edit:** Already has ImageUpload; ensure create/update pass imageUrl/imageStorageId to Convex (verify closetItems.create in [web/src/app/closet/new/page.tsx](web/src/app/closet/new/page.tsx) sends imageStorageId or imageUrl from ImageUpload result).
3. **Mobile:** In build create, closet create, convention create: use Convex generateUploadUrl → upload file with auth header → getUrl; pass result into create payload. Shared upload helper recommended.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Image upload), [convex/files.ts](convex/files.ts), [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
