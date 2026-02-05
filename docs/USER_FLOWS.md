# Kyarafit User Flows

This document describes the actual implemented user flows in Kyarafit based on the current codebase.

## Overview

Kyarafit is a mobile-first cosplay planning app with:

- **Offline-first mobile app** (React Native + Expo + SQLite)
- **Device-scoped backend API** (Go + Fiber + PostgreSQL)
- **Progressive workflow**: Closet → Builds → Conventions → Packing

## Architecture

### Device-Scoped Design

All entities are scoped by `device_id` (sent via `x-kyar-device-id` header):

- **No auth required** for basic mobile usage
- **Optional auth** enables sync and tier limits
- **Offline-first** mobile with sync outbox pattern

### Technology Stack

**Mobile**: React Native, Expo, SQLite, TanStack Query  
**Backend**: Go, Fiber,PostgreSQL  
**Web**: Next.js, React (coming soon)

---

## User Flow 1: Closet Management

### Purpose

Organize costume pieces inventory

### Screens

- Mobile: `mobile/app/closet.tsx` (list), `mobile/app/add-item.tsx` (add)

### Backend

- API: `GET /closet/items`, `POST /closet/items`, `PATCH /closet/items/:id`, `DELETE /closet/items/:id`
- Handler: `backend/internal/closet/handler.go`
- Table: `closet_items`

### Data Flow

1. **Add Item**

   ```
   User → Camera/Gallery → Image Picker → Form → SQLite → Outbox → Sync → Backend
   ```

2. **Item Structure**

   ```typescript
   {
     id: uuid,
     deviceId: string,
     name: string,
     category: 'wig' | 'prop' | 'armor' | 'garment' | 'shoe' | 'material' | 'other',
     tags: string[],
     notes?: string,
     imageUrl?: string,  // Image uploaded separately
     costCents?: number,
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

3. **Offline Support**
   - Mobile stores items in SQLite (`mobile/src/storage/closetRepo.ts`)
   - Changes queued in outbox when offline
   - Synced when connection restored

### User Actions

- Browse closet in grid view with category filters
- Add new items with name, category, tags, cost, notes
- Upload photos (image service removes background)
- Edit/delete items

---

## User Flow 2: Build Creation & Management

### Purpose

Organize closet items into complete cosplay builds

### Screens

- Mobile: `mobile/app/(tabs)/builds.tsx` (list), `mobile/app/build-detail.tsx` (detail), `mobile/app/build-link-items.tsx` (link items)

### Backend

- API: `GET /builds`, `POST /builds`, `PATCH /builds/:id`
- Link Items: `POST /builds/:id/items`, `GET /builds/:id/items`
- Handler: `backend/internal/builds/handler.go`
- Tables: `device_builds`, `build_item_links`

### Data Flow

1. **Create Build**

   ```typescript
   {
     id: uuid,
     deviceId: string,
     name: string,  // e.g. "Sailor Moon"
     character?: string,  // e.g. "Usagi Tsukino"
     status: 'idea' | 'wip' | 'ready',
     notes?: string,
     imageUrl?: string,  // Reference image
     budgetCents?: number,
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Link Closet Items**
   - API: `POST /builds/:id/items` with `{ "closetItemIds": ["id1", "id2", ...] }`
   - **Atomic replacement**: Deletes old links, inserts new ones
   - Many-to-many: Same closet item can be in multiple builds

3. **View Build**
   - Shows linked items with thumbnails
   - Calculates total cost from linked items
   - Displays budget vs actual cost

### User Actions

- Create build with name, character, status
- Add reference image
- Link closet items (multi-select)
- View linked items grid
- Track budget vs cost
- Update status as build progresses

---

## User Flow 3: Build Task Planning

### Purpose

Track build progress with checklists

### Screens

- Mobile: `mobile/app/build-detail.tsx` (shows tasks inline)

### Backend

- API: `GET /builds/:id/tasks`, `POST /builds/:id/tasks`, `PATCH /builds/:id/tasks/:taskId`, `DELETE /builds/:id/tasks/:taskId`
- Handler: `backend/internal/builds/handler.go`
- Table: `build_tasks`

### Data Flow

1. **Task Structure**

   ```typescript
   {
     id: uuid,
     buildId: uuid,
     label: string,  // e.g. "Buy wig", "Style wig"
     closetItemId?: uuid,  // Optional link to closet item
     sortOrder: number,  // For custom ordering
     checked: boolean,
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Mobile UI**
   - Quick-add input at top of build detail screen
   - Checkbox list with drag-to-reorder
   - Tap checkbox to toggle checked state
   - Shows "(linked)" badge if closetItemId set

### User Actions

- Add tasks with simple text labels
- Optionally link tasks to specific closet items
- Check off tasks as completed
- Reorder tasks via drag-and-drop
- Delete tasks

---

## User Flow 4: Convention Planning

### Purpose

Plan which builds to wear on which convention days

### Screens

- Mobile: `mobile/app/convention-detail.tsx`

### Backend

- API: `GET /conventions`, `POST /conventions`, `GET /conventions/:id`, `PATCH /conventions/:id`
- Day Plan: `GET /conventions/:id/plan`, `PUT /conventions/:id/plan`
- Handler: `backend/internal/convention/handler.go`
- Tables: `conventions`, `convention_day_plans`

### Data Flow

1. **Convention Structure**

   ```typescript
   {
     id: uuid,
     deviceId: string,
     name: string,  // e.g. "Anime Expo 2026"
     location?: string,
     startDate: string,  // YYYY-MM-DD
     endDate: string,    // YYYY-MM-DD
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Day Plan Entry**

   ```typescript
   {
     id: uuid,
     conventionId: uuid,
     date: string,      // YYYY-MM-DD
     buildId: uuid | null,  // null = rest day
     notes?: string
   }
   ```

3. **Replace Plan** (Atomic Operation)
   - API: `PUT /conventions/:id/plan` with `{ "plan": [entries...] }`
   - Backend deletes ALL existing entries, inserts new ones (transaction)
   - Mobile generates entries for each date in convention range

### User Actions

- Create convention with name, location, dates
- View day-by-day list
- Tap day → Modal picker shows all builds
- Assign build to day OR mark as rest day
- Add notes per day (e.g. "Photoshoot at 2pm")

### Mobile Implementation

```typescript
// From convention-detail.tsx
const dates = dateRange(convention.startDate, convention.endDate);

// Generate plan on day assignment
const newPlan = dates.map((date) => ({
  date,
  buildId: assignedBuildId || null, // null for rest day
  notes: existingNotes,
}));

await setPlan(conventionId, newPlan); // Atomic replacement
```

---

## User Flow 5: Packing List Generation

### Purpose

Auto-generate packing checklist from convention schedule

### Screens

- Mobile: `mobile/app/(tabs)/packing.tsx`, triggered from `mobile/app/convention-detail.tsx`

### Backend

- API: `GET /conventions/:id/packing`, `POST /conventions/:id/packing/regenerate`
- Manual Items: `POST /conventions/:id/packing/manual`
- Update: `PATCH /packing/:id`
- Handler: `backend/internal/convention/handler.go`
- Table: `packing_list_items`

### Data Flow

1. **Packing Item Structure**

   ```typescript
   {
     id: uuid,
     conventionId: uuid,
     date?: string,           // YYYY-MM-DD (from day plan)
     buildId?: uuid,          // From day plan
     closetItemId?: uuid,     // Set = auto-generated; null = manual
     label: string,           // Item name
     checked: boolean,
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Generation Algorithm** (`backend/internal/convention/repository.go:RegeneratePackingList`)

   ```go
   // Step 1: Delete auto-generated items (closet_item_id IS NOT NULL)
   DELETE FROM packing_list_items
   WHERE convention_id = ? AND closet_item_id IS NOT NULL

   // Step 2: Get day plans
   SELECT * FROM convention_day_plans WHERE convention_id = ?

   // Step 3: For each day with buildId, get linked closet items
   seenCloset := map[string]bool{}
   for each day {
       if day.buildId != nil {
           itemIds := SELECT closet_item_id FROM build_item_links
                      WHERE build_id = day.buildId

           for each itemId {
               if seenCloset[itemId] { continue }  // Deduplication
               seenCloset[itemId] = true

               label := SELECT name FROM closet_items WHERE id = itemId

               INSERT INTO packing_list_items
               (id, convention_id, date, build_id, closet_item_id, label, checked)
               VALUES (uuid, conventionId, date, buildId, itemId, label, false)
           }
       }
   }

   // Step 4: Add default general essentials if none exist
   IF no items with (date IS NULL AND build_id IS NULL) {
       INSERT default essentials: "Wig cap", "Pins", "Glue", "Makeup wipes", "Repair tape"
   }
   ```

3. **Key Behaviors**
   - **Auto-generated items**: Have `closet_item_id` set, deleted on regenerate
   - **Manual items**: Have `closet_item_id = NULL`, preserved on regenerate
   - **Deduplication**: Same closet item appears once even if in multiple builds
   - **Checked state**: NOT preserved - all regenerated items start unchecked
   - **Default essentials**: Added only if no manual general items exist

### User Actions

1. **Generate List** (first time)
   - From convention detail: Tap "GENERATE PACKING LIST"
   - Mobile calls `regenerateLocal()` → Syncs → Backend processes
   - Navigates to packing tab

2. **View Packing List**
   - Convention selector dropdown (multi-convention support)
   - Items grouped by date or as "GENERAL ESSENTIALS"
   - Checkbox per item

3. **Check Off Items**
   - Tap checkbox → Toggle checked state
   - Persists locally immediately
   - Syncs to backend when online

4. **Add Manual Items**
   - Tap "+" to add custom items
   - Examples: "Phone charger", "Convention badge", "Snacks"
   - NOT deleted on regenerate

5. **Regenerate**
   - User modifies convention day plan (changes build assignments)
   - Tap "GENERATE PACKING LIST" again
   - Auto-generated items recreated from new plan
   - Manual items preserved
   - **Checked states lost** (all items reset to unchecked)

### Mobile Implementation

```typescript
// From mobile/src/storage/packingRepo.ts:regenerateLocal()

// Delete auto-generated items
DELETE FROM packing_list_items
WHERE convention_id = ? AND closet_item_id IS NOT NULL

// Get day plans and closet items
const plan = await getPlan(conventionId);
const closetItems = await listItems();

// Generate packing items
const seenCloset = new Set();
for (const dayPlan of plan) {
    if (!dayPlan.buildId) continue;  // Skip rest days

    const linkedIds = await getLinkedClosetItemIds(dayPlan.buildId);
    for (const closetItemId of linkedIds) {
        if (seenCloset.has(closetItemId)) continue;  // Dedupe
        seenCloset.add(closetItemId);

        const label = closetItems.find(c => c.id === closetItemId)?.name;
        INSERT INTO packing_list_items
        (id, convention_id, date, build_id, closet_item_id, label, checked)
        VALUES (uuid, conventionId, date, buildId, closetItemId, label, 0)
    }
}

// Add default essentials if none exist
const count = SELECT COUNT(*) FROM packing_list_items
              WHERE convention_id = ? AND date IS NULL AND build_id IS NULL
if (count === 0) {
    for (const label of DEFAULT_ESSENTIALS) {
        INSERT INTO packing_list_items (id, convention_id, label, checked)
        VALUES (uuid, conventionId, label, 0)
    }
}

// Queue for sync
await enqueue('packing.regenerate', { conventionId });
```

---

## Offline-First Mobile Architecture

### Local Storage (SQLite)

All mobile data stored locally in SQLite:

- `closet_items_local`
- `device_builds_local`
- `build_item_links_local`
- `build_tasks_local`
- `conventions_local`
- `convention_day_plans_local`
- `packing_list_items_local`

### Sync Outbox Pattern

When user performs actions offline:

1. **Action executed locally** (instant UI feedback)

   ```typescript
   await database.runAsync("INSERT INTO closet_items ...");
   ```

2. **Queued in outbox**

   ```typescript
   await enqueue("closet.create", { item: newItem });
   ```

3. **Sync when online**

   ```typescript
   // Sync service processes outbox
   const pending = await listOutbox();
   for (const op of pending) {
     await fetch(`${API_URL}${op.endpoint}`, {
       method: op.method,
       headers: {
         "x-kyar-device-id": deviceId,
         "Content-Type": "application/json",
       },
       body: JSON.stringify(op.payload),
     });
     await markSynced(op.id);
   }
   ```

4. **Conflict resolution**: Last-write-wins (backend timestamps)

### Sync Operations

From `mobile/src/services/sync.ts`:

- `closet.create`, `closet.update`, `closet.delete`
- `build.create`, `build.update`, `build.linkItems`
- `task.create`, `task.update`, `task.delete`
- `convention.create`, `convention.update`, `convention.setPlan`
- `packing.toggle`, `packing.addManual`, `packing.regenerate`

---

## API Reference

### Device-Scoped Endpoints

All require `x-kyar-device-id` header. Optional auth via `Authorization: Bearer <jwt>` enables tier limits.

#### Closet Items

```
GET    /closet/items           # List items
POST   /closet/items           # Create item
PATCH  /closet/items/:id       # Update item
DELETE /closet/items/:id       # Delete item
```

#### Builds

```
GET    /builds                 # List builds
POST   /builds                 # Create build
GET    /builds/:id             # Get build
PATCH  /builds/:id             # Update build
GET    /builds/:id/items       # Get linked closet item IDs
POST   /builds/:id/items       # Link items (atomic replace)
```

#### Build Tasks

```
GET    /builds/:id/tasks       # List tasks for build
POST   /builds/:id/tasks       # Create task
PATCH  /builds/:id/tasks/:taskId   # Update task (check/uncheck, rename)
DELETE /builds/:id/tasks/:taskId   # Delete task
```

#### Conventions

```
GET    /conventions            # List conventions
POST   /conventions            # Create convention
GET    /conventions/:id        # Get convention
PATCH  /conventions/:id        # Update convention
GET    /conventions/:id/plan   # Get day plan
PUT    /conventions/:id/plan   # Replace day plan (atomic)
```

#### Packing

```
GET    /conventions/:id/packing              # Get packing list
POST   /conventions/:id/packing/regenerate   # Regenerate list
POST   /conventions/:id/packing/manual       # Add manual item
PATCH  /packing/:id                          # Update item (check/uncheck, rename)
```

### Request/Response Examples

**Create Build**

```http
POST /builds
x-kyar-device-id: abc-123

{
  "name": "Sailor Moon",
  "character": "Usagi Tsukino",
  "status": "idea",
  "budgetCents": 30000
}

Response 201:
{
  "id": "uuid",
  "deviceId": "abc-123",
  "name": "Sailor Moon",
  "character": "Usagi Tsukino",
  "status": "idea",
  "budgetCents": 30000,
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

**Link Items to Build**

```http
POST /builds/:id/items
x-kyar-device-id: abc-123

{
  "closetItemIds": ["item-1", "item-2", "item-3"]
}

Response 204: (no content)
```

**Replace Day Plan**

```http
PUT /conventions/:id/plan
x-kyar-device-id: abc-123

{
  "plan": [
    { "date": "2026-07-04", "buildId": "build-1", "notes": "Photoshoot at 2pm" },
    { "date": "2026-07-05", "buildId": "build-2", "notes": "" },
    { "date": "2026-07-06", "buildId": null, "notes": "Rest day" }
  ]
}

Response 200:
{
  "plan": [...]  // Full plan returned
}
```

**Regenerate Packing List**

```http
POST /conventions/:id/packing/regenerate
x-kyar-device-id: abc-123

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "conventionId": "conv-id",
      "date": "2026-07-04",
      "buildId": "build-1",
      "closetItemId": "item-1",  // Auto-generated
      "label": "Blonde wig",
      "checked": false,
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "id": "uuid",
      "conventionId": "conv-id",
      "date": null,
      "buildId": null,
      "closetItemId": null,  // Manual item
      "label": "Phone charger",
      "checked": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

## Key Implementation Details

### Packing List Deduplication

Same closet item can be in multiple builds assigned to multiple days, but appears only once in packing list:

```
Convention: Anime Expo (July 4-6)
Day Plans:
  - Friday: Sailor Moon build (contains "blonde wig")
  - Saturday: Also uses "blonde wig" in different context

Packing List Generation:
  seenCloset = {}
  for day in [Friday, Saturday]:
      for item in day.build.linkedItems:
          if item.id NOT in seenCloset:
              create packing_list_item
              seenCloset.add(item.id)

Result: "Blonde wig" appears once
```

### Manual vs Auto-Generated Items

**Auto-generated** (`closet_item_id IS NOT NULL`):

- Created by regenerate endpoint
- Deleted on next regenerate
- Linked to actual closet items
- Label comes from closet item name

**Manual** (`closet_item_id IS NULL`):

- Created by user via "Add Manual Item"
- Preserved across regenerations
- Not linked to closet items
- Label is free-form text

### Checked State Behavior

**Current Implementation**: Checked state is NOT preserved during regeneration.

When regenerate is called:

1. All auto-generated items deleted (including checked ones)
2. New items created with `checked=false`
3. User must re-check items after regeneration

**Why**: Simplifies implementation, avoids complex state management.

**User Workflow**: Check items incrementally while packing, don't regenerate after checking unless absolutely necessary.

---

## Database Schema

### Tables

**closet_items** (device-scoped inventory)

- `id UUID PRIMARY KEY`
- `device_id TEXT NOT NULL`
- `name TEXT NOT NULL`
- `category TEXT NOT NULL CHECK (wig|prop|armor|garment|shoe|material|other)`
- `tags JSONB DEFAULT '[]'`
- `notes TEXT`
- `image_url TEXT`
- `cost_cents INTEGER`
- `user_id TEXT` (for tier limits)
- `created_at, updated_at TIMESTAMPTZ`

**device_builds** (device-scoped builds)

- `id UUID PRIMARY KEY`
- `device_id TEXT NOT NULL`
- `name TEXT NOT NULL`
- `character TEXT`
- `status TEXT DEFAULT 'idea' CHECK (idea|wip|ready)`
- `notes TEXT`
- `image_url TEXT`
- `budget_cents INTEGER`
- `user_id TEXT` (for tier limits)
- `created_at, updated_at TIMESTAMPTZ`

**build_item_links** (many-to-many join)

- `build_id UUID REFERENCES device_builds ON DELETE CASCADE`
- `closet_item_id UUID REFERENCES closet_items ON DELETE CASCADE`
- `PRIMARY KEY (build_id, closet_item_id)`

**build_tasks** (progress checklists)

- `id UUID PRIMARY KEY`
- `build_id UUID REFERENCES device_builds ON DELETE CASCADE`
- `label TEXT NOT NULL`
- `closet_item_id UUID REFERENCES closet_items ON DELETE SET NULL`
- `sort_order INTEGER DEFAULT 0`
- `checked BOOLEAN DEFAULT FALSE`
- `created_at, updated_at TIMESTAMPTZ`

**conventions** (device-scoped events)

- `id UUID PRIMARY KEY`
- `device_id TEXT NOT NULL`
- `name TEXT NOT NULL`
- `location TEXT`
- `start_date DATE NOT NULL`
- `end_date DATE NOT NULL`
- `user_id TEXT` (for tier limits)
- `created_at, updated_at TIMESTAMPTZ`

**convention_day_plans** (build assignments per day)

- `id UUID PRIMARY KEY`
- `convention_id UUID REFERENCES conventions ON DELETE CASCADE`
- `date DATE NOT NULL`
- `build_id UUID REFERENCES device_builds ON DELETE SET NULL`
- `notes TEXT`
- `UNIQUE (convention_id, date)`

**packing_list_items** (auto + manual items)

- `id UUID PRIMARY KEY`
- `convention_id UUID REFERENCES conventions ON DELETE CASCADE`
- `date DATE` (nullable, from day plan)
- `build_id UUID REFERENCES device_builds ON DELETE SET NULL`
- `closet_item_id UUID REFERENCES closet_items ON DELETE SET NULL` (null = manual)
- `label TEXT NOT NULL`
- `checked BOOLEAN DEFAULT FALSE`
- `created_at, updated_at TIMESTAMPTZ`

---

## Summary

Kyarafit implements a progressive workflow:

1. **Closet**: Build inventory foundation
2. **Builds**: Organize items into complete cosplays
3. **Tasks**: Track build progress (optional)
4. **Conventions**: Plan events and schedules
5. **Day Plans**: Assign builds to specific dates
6. **Packing**: Auto-generate checklists from plans

Key characteristics:

- **Offline-first mobile** with SQLite + sync outbox
- **Device-scoped** backend API with optional auth
- **Atomic operations** (plan replacement, item linking)
- **Smart deduplication** in packing lists
- **Simple regeneration** (no checked state preservation)
- **Flexible planning** (tasks optional, rest days supported)
