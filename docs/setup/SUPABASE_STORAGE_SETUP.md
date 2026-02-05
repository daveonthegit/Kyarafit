# Supabase Storage Setup

## What is Supabase Storage?

Supabase Storage is an S3-compatible object storage service for images, videos, and files. It includes:
- CDN for fast image delivery
- Image transformations (resize, crop, format conversion)
- RLS policies for access control
- Public or private buckets

## Setup Steps

### 1. Create Storage Bucket (Supabase Dashboard)

1. Go to: **Storage** (left sidebar)
2. Click **"New bucket"**
3. Settings:
   - **Name**: `kyarafit-images`
   - **Public bucket**: ✅ Yes (so images load without auth)
   - **File size limit**: `20971520` (20 MB - for high-res costume photos)
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
4. Click **"Create bucket"**

**Why 20 MB?** Modern phone cameras produce 10-20MB images. This gives users flexibility for high-quality costume documentation.

### 2. Set Storage Policies (Optional - for security)

If you want to control who can upload:

Go to: **Storage → closet-images → Policies**

**Option A: Simple (anyone can upload)**
- Click **"New Policy"**
- Template: **"Allow public uploads"**
- This allows any authenticated user to upload

**Option B: Secure (user folders)**
- Run the SQL in `backend/migrations/007_supabase_storage_setup.up.sql`
- This creates policies so users can only upload to their own folder (`{userId}/...`)

**For now:** Start with Option A (simple) to test, add Option B later.

### 3. Update Backend Environment

Add to `backend/.env`:
```bash
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Get it from:** Supabase Dashboard → Settings → API → `service_role` key (secret!)

### 4. Image Upload Flow

You have two options:

#### **Option A: Direct Upload** (Simple, recommended)

Web/Mobile uploads directly to Supabase Storage:

```typescript
// In web/mobile
import { uploadImage } from '@/lib/supabase/storage';

const url = await uploadImage(file, userId);
// Save url to backend as imageUrl
```

**Pros:** Simple, fast, offloads upload from your backend  
**Cons:** No background removal (yet)

#### **Option B: Backend Upload** (For image processing)

Client → Backend → Image Service → Supabase Storage:

```
1. Client sends image to backend
2. Backend sends to image-service for background removal
3. Backend uploads both versions to Supabase Storage
4. Backend returns URLs
```

**Pros:** Can process images (remove background)  
**Cons:** Backend handles uploads (more load)

### 5. Storage Folder Structure

**One bucket for all images**, organized by user and type:

```
kyarafit-images/
  ├── {userId}/
  │   ├── closet/
  │   │   ├── abc123.jpg          (closet item original)
  │   │   ├── abc123-nobg.png     (background removed)
  │   │   └── def456.webp
  │   ├── builds/
  │   │   ├── character-ref.jpg   (build reference images)
  │   │   └── progress-01.png     (build progress photos)
  │   └── avatars/
  │       └── profile.jpg         (user profile picture)
  └── {anotherUserId}/
      └── ...
```

**Why one bucket?**
- Simpler to manage
- One set of policies
- Easier to track storage usage per user
- All images are costume/cosplay related anyway

### 6. Image URLs in Database

Images are referenced by public URLs:

```sql
-- closet_items table already has:
image_url TEXT  -- https://.../storage/v1/object/public/closet-images/userId/abc123.jpg

-- You could add for background-removed version:
-- ALTER TABLE closet_items ADD COLUMN image_bg_removed_url TEXT;
```

### 7. Storage Limits & Tier Enforcement

Supabase Storage has built-in quotas, but you control them via tiers:

- **FREE**: 50 MB total (tracked in `app_users.current_usage_mb`)
- **PREMIUM_BASIC**: 500 MB
- **PREMIUM_PRO**: Unlimited

When uploading, check storage limit first (already implemented in your handlers!).

### 8. Image Transformations (Bonus!)

Supabase Storage has built-in transformations:

```typescript
// Original
https://xxx.supabase.co/storage/v1/object/public/closet-images/userId/image.jpg

// Resized to 400x400
https://xxx.supabase.co/storage/v1/object/public/closet-images/userId/image.jpg?width=400&height=400

// Thumbnail (200x200, webp)
https://xxx.supabase.co/storage/v1/object/public/closet-images/userId/image.jpg?width=200&height=200&format=webp
```

## Quick Start

### Right now (simplest):

1. **Create bucket** in Supabase Dashboard:
   - Name: `kyarafit-images`
   - Public: Yes
   - File size limit: 20 MB
   
2. **Test upload** from web:
   ```typescript
   // In your form component
   import { uploadImage } from '@/lib/supabase/storage';
   
   const handleUpload = async (file: File) => {
     // Upload to closet folder
     const url = await uploadImage(file, userId, 'closet');
     
     // Or for builds:
     // const url = await uploadImage(file, userId, 'builds');
     
     // Save url to closet item or build
   };
   ```

3. **Done!** Images are stored in Supabase, served via CDN.

### Later (with background removal):

1. Create upload endpoint in Go backend
2. Backend calls image-service
3. Backend uploads both versions to Supabase Storage
4. Returns URLs to client

## Summary

**What to do now:**
1. ✅ Go to Supabase Dashboard → Storage
2. ✅ Create bucket `closet-images` (public)
3. ✅ Add `SUPABASE_SERVICE_KEY` to `backend/.env` (if using backend upload)
4. ✅ Test upload from web app

Storage is now ready! 📸
