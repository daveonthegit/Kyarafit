# Competitor Analysis & Implementation Plan

Analysis of competitor vs **Kyarafit** codebase and docs. Source of truth: screenshots in `docs/competitor/`. Output: structured analysis, feature comparison, and actionable implementation plan.

---

## 1. Screenshot Analysis

### IMG_1061 — Character List / My Characters

| Field                 | Content                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Character List / My Characters                                                                                                                                                                            |
| **Purpose**           | View, search, and manage a list of characters (cosplay projects).                                                                                                                                         |
| **Primary User Task** | Browse and find characters.                                                                                                                                                                               |
| **Secondary**         | Add character, filter/sort list, view character details.                                                                                                                                                  |
| **Key UI Components** | Top bar: menu (⋯), Add (+), app icon; search bar "Character"; list rows: avatar, name, series (e.g. "Jinshi" / "Apothecary Diary"), progress "0%" and progress bar; bottom: in-app ad (Timestamp Camera). |
| **Features Implied**  | Character/cosplay list; search; filter/sort (icons); add; progress per item; series/category; in-app ads.                                                                                                 |
| **Backend**           | Characters/cosplays table (name, series, avatar, progress); search API; filter/sort params; creation API; ad/promo service.                                                                               |

---

### IMG_1062 — About Cosplanner

| Field                 | Content                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | About Cosplanner                                                                                                                                                                                                     |
| **Purpose**           | Show app version, developer, copyright, language credits.                                                                                                                                                            |
| **Primary User Task** | Review app information.                                                                                                                                                                                              |
| **Secondary**         | Close; possibly request/contribute language (inferred from CTA).                                                                                                                                                     |
| **Key UI Components** | Purple header "About Cosplanner", Close; logo; Version 2.3.4; dev/copyright; "Language credits:" with language + contributor list (EN, DE, ID, IT, PT, ES, TR, VN); CTA "Would you like to see Cosplanner in your…". |
| **Features Implied**  | About/legal; versioning; multi-language support (i18n); contributor credits.                                                                                                                                         |
| **Backend**           | App metadata; localization config; optional language-preference/contribution.                                                                                                                                        |

---

### IMG_1063 — Import / Export Cosplays

| Field                 | Content                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Import / Export Cosplays                                                                                                                 |
| **Purpose**           | Sync cosplay data between device and Cosplanner online account.                                                                          |
| **Primary User Task** | Import or export cosplays to/from cloud.                                                                                                 |
| **Secondary**         | Log in (required for flow).                                                                                                              |
| **Key UI Components** | Header "Import / Export Cosplays", Close; "Log In" link; Import section (cloud→device, Premium required); Export section (device→cloud). |
| **Features Implied**  | Cloud sync/backup; account required; premium gating for import; data copy in both directions.                                            |
| **Backend**           | Auth; cloud storage; import/export API; subscription check for import.                                                                   |

---

### IMG_1064 — Settings

| Field                 | Content                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Settings                                                                                                                  |
| **Purpose**           | Customize app appearance and regional preferences.                                                                        |
| **Primary User Task** | View and change settings.                                                                                                 |
| **Secondary**         | Change color style, currency, thumbnail size.                                                                             |
| **Key UI Components** | Header "Settings", Close; list: Color style (Purple), Currency (USD), Thumbnails size (Medium); chevrons for sub-screens. |
| **Features Implied**  | Theme/color; currency preference; thumbnail size; persisted preferences.                                                  |
| **Backend**           | User preferences (color_style, currency, thumbnail_size); settings API.                                                   |

---

### IMG_1065 — Store (In-App Purchases)

| Field                 | Content                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Store / In-App Purchases                                                                                                                                                                                                                                      |
| **Purpose**           | Sell one-time IAPs (Remove Ads, Extend Limits) and restore purchases.                                                                                                                                                                                         |
| **Primary User Task** | Purchase upgrade or restore purchases.                                                                                                                                                                                                                        |
| **Secondary**         | Understand iOS vs web purchase distinction.                                                                                                                                                                                                                   |
| **Key UI Components** | Header "Store", Close; disclaimer (iOS vs web app store); "Remove Ads" $1.99; "Extend Limits" $0.99 with limit list (Elements 25→100, Tasks 10→50, Reference Images, Process Pictures, Events, Photo Shoots, Achievements, Best Photos); "Restore Purchases". |
| **Features Implied**  | Ad removal IAP; extend limits IAP; restore purchases; freemium limits (elements, tasks, images, events, etc.).                                                                                                                                                |
| **Backend**           | Product catalog; receipt validation; entitlement storage; limit enforcement; restore logic.                                                                                                                                                                   |

---

### IMG_1066 — Menu

| Field                 | Content                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Menu                                                                                                                                                                 |
| **Purpose**           | Hub for app info, data management, settings, store, engagement.                                                                                                      |
| **Primary User Task** | Navigate to a section or action.                                                                                                                                     |
| **Secondary**         | About, Import/Export, Settings, Store, Rate, Share, Feedback.                                                                                                        |
| **Key UI Components** | Header "Menu", Close; list: About Cosplanner, Import/Export Cosplays, Settings, Store, Rate in App Store, Tell a friend, Comments and suggestions; icons + chevrons. |
| **Features Implied**  | About; Import/Export; Settings; Store; app rating; share app; feedback channel.                                                                                      |
| **Backend**           | Same as respective features; analytics for rate/share optional.                                                                                                      |

---

### IMG_1067 — Cosplay Filter (Show)

| Field                 | Content                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Screen Name**       | Cosplay Filter Options                                                                                             |
| **Purpose**           | Filter cosplay list by status.                                                                                     |
| **Primary User Task** | Choose which cosplays to show.                                                                                     |
| **Secondary**         | Close without changing.                                                                                            |
| **Key UI Components** | "Show:", Close; options: All cosplays (selected), Only planned, Only in process, Only completed; icons per option. |
| **Features Implied**  | Status filter (all / planned / in process / completed); applied to main list.                                      |
| **Backend**           | Cosplays with status; list API accepts status filter.                                                              |

---

### IMG_1068 — Sort By

| Field                 | Content                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Screen Name**       | Sort Options                                                                                                                                                                                                                   |
| **Purpose**           | Choose sort attribute for cosplay/list view.                                                                                                                                                                                   |
| **Primary User Task** | Select sort criterion.                                                                                                                                                                                                         |
| **Secondary**         | Close.                                                                                                                                                                                                                         |
| **Key UI Components** | "Sort by:", Close; list: Character, Series, Overall percentage, Due date, Budget, Tasks, Initial/End date, Elapsed/Remaining time, Total spend, Total time, Events, Photo shoots, Achievements; "Overall percentage" selected. |
| **Features Implied**  | Rich sort (character, series, %, dates, budget, tasks, time, spend, events, photo shoots, achievements).                                                                                                                       |
| **Backend**           | List API with sort_by (and order); schema supports these fields/aggregates.                                                                                                                                                    |

---

### IMG_1069 — Order By

| Field                 | Content                                               |
| --------------------- | ----------------------------------------------------- |
| **Screen Name**       | Order By                                              |
| **Purpose**           | Choose sort direction.                                |
| **Primary User Task** | Most to Least or Least to Most.                       |
| **Key UI Components** | "Order by:", Close; "Most to Least", "Least to Most". |
| **Features Implied**  | Ascending/descending for current sort.                |
| **Backend**           | List API order param (asc/desc).                      |

---

### IMG_1070 — Cosplay Project: Cosplay Elements

| Field                 | Content                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Screen Name**       | Cosplay Project Detail — Cosplay Elements                                                                                                                                                                                                                          |
| **Purpose**           | Manage elements (buy/make) for one cosplay.                                                                                                                                                                                                                        |
| **Primary User Task** | Add and manage elements (buy vs make).                                                                                                                                                                                                                             |
| **Secondary**         | Reorder, edit project, complete, notes, summary.                                                                                                                                                                                                                   |
| **Key UI Components** | Back, logo; project avatar, "Jinshi", "Apothecary Diary", Initial/Due dates; tabs: Cosplay Elements (active), Tasks, Team, Resources, Collaborators; "Cosplay Elements" + sort icon + Add; empty state copy (buy vs make); bottom: Edit, Complete, Notes, Summary. |
| **Features Implied**  | Project with avatar, name, series, dates; tabbed detail (Elements, Tasks, Team, Resources, Collaborators); elements list with buy/make; add, reorder; Edit/Complete/Notes/Summary.                                                                                 |
| **Backend**           | Projects; elements (type buy/make); tabs data; notes; summary.                                                                                                                                                                                                     |

---

### IMG_1071 — Cosplay Project: Tasks

| Field                 | Content                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Cosplay Project Detail — Tasks                                                                                                                                |
| **Purpose**           | Manage tasks and reminders for the cosplay.                                                                                                                   |
| **Primary User Task** | Add/manage tasks; set reminders.                                                                                                                              |
| **Secondary**         | Navigate other tabs; edit project; notes; summary.                                                                                                            |
| **Key UI Components** | Same project header and tabs; Tasks tab active; "Tasks" + sort + Add; empty state (tasks + reminders, notifications); bottom: Edit, Complete, Notes, Summary. |
| **Features Implied**  | Task list per project; reminders; in-app notifications for reminders.                                                                                         |
| **Backend**           | Tasks (project_id, reminder); notification/scheduler.                                                                                                         |

---

### IMG_1072 — Cosplay Project: Reference Images

| Field                 | Content                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Cosplay Project Detail — Reference Images                                                                                                          |
| **Purpose**           | Store reference pictures for the character/cosplay.                                                                                                |
| **Primary User Task** | Add and view reference images.                                                                                                                     |
| **Key UI Components** | Same header/tabs; Reference Images (person icon) active; "+" add; placeholder "Save here the pictures of the character you'll use as a reference". |
| **Features Implied**  | Reference image gallery per project; upload.                                                                                                       |
| **Backend**           | Project reference images (storage + references).                                                                                                   |

---

### IMG_1073 — Cosplay Project: Process Pictures

| Field                 | Content                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Cosplay Project Detail — Process Pictures                                                                                              |
| **Purpose**           | Document making process with photos.                                                                                                   |
| **Primary User Task** | Add process photos.                                                                                                                    |
| **Key UI Components** | Same header/tabs; Process Pictures tab active; X, "Process Pictures", "+"; empty state "You can take pictures of the making process…". |
| **Features Implied**  | Process photo gallery per project.                                                                                                     |
| **Backend**           | Project process pictures (storage).                                                                                                    |

---

### IMG_1074 — Cosplay Project: Events

| Field                 | Content                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Cosplay Project Detail — Events                                                                                           |
| **Purpose**           | Manage events where this cosplay will be worn.                                                                            |
| **Primary User Task** | View/add events for this cosplay.                                                                                         |
| **Key UI Components** | Same header/tabs; Events tab (group icon) active; sort + "Events" + Add; empty "Events where you will wear this cosplay". |
| **Features Implied**  | Events linked to one cosplay; add/sort.                                                                                   |
| **Backend**           | Events table (cosplay_id, name, date, location, etc.).                                                                    |

---

### IMG_1075 / IMG_1076 — New Element

| Field                 | Content                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Screen Name**       | New Element                                                                                                       |
| **Purpose**           | Add one element to a cosplay (buy or make).                                                                       |
| **Primary User Task** | Name and categorize (To Buy / To Make).                                                                           |
| **Key UI Components** | Cancel, "New Element", Save (disabled until valid); Name input; "To Buy" / "To Make" segmented control; keyboard. |
| **Features Implied**  | Element creation; name required; type buy/make; validation.                                                       |
| **Backend**           | POST element (name, type: buy                                                                                     | make); validation. |

---

### IMG_1077 — New / Edit Task

| Field                 | Content                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | New/Edit Task                                                                                                         |
| **Purpose**           | Create or edit a task with description, alarm, notes.                                                                 |
| **Primary User Task** | Enter description; optionally set alarm and notes.                                                                    |
| **Key UI Components** | Cancel, "Task", Save (disabled); Task description; "Alarm?" toggle; Date/Time (conditional); Notes/Details; keyboard. |
| **Features Implied**  | Task CRUD; optional alarm/reminder; date/time; notes.                                                                 |
| **Backend**           | Tasks (description, alarm, alarmDateTime, notes); notification scheduling.                                            |

---

### IMG_1078 — Notes

| Field                 | Content                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| **Screen Name**       | Notes                                                                           |
| **Purpose**           | View/edit notes for this cosplay.                                               |
| **Primary User Task** | Enter or edit notes.                                                            |
| **Key UI Components** | Trash, "Notes", Close; placeholder "Notes about this cosplay"; large text area. |
| **Features Implied**  | Project-scoped notes; delete; modal.                                            |
| **Backend**           | Notes per project (or single rich text field).                                  |

---

### IMG_1079 — Summary

| Field                 | Content                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Screen Name**       | Summary (Jinshi Apothecary Diary)                                                                                                                                                                                                                                  |
| **Purpose**           | Dashboard of status, progress, timeline, elements, budget.                                                                                                                                                                                                         |
| **Primary User Task** | Review project metrics.                                                                                                                                                                                                                                            |
| **Secondary**         | Share summary.                                                                                                                                                                                                                                                     |
| **Key UI Components** | Share, "Summary", Close; title/subtitle; Status, Progress % + bar; Initial date, Elapsed, Due date (red), Remaining (red); Elements to buy (bought/pending/total), to make (made/ongoing/total), total elements; Developing time; Budget; Total spend; Difference. |
| **Features Implied**  | Summary dashboard; status/progress; elapsed/remaining time; element breakdown (buy/make + states); time tracking; budget vs spend; share.                                                                                                                          |
| **Backend**           | Aggregations (progress, counts, spend, time); share endpoint or client share.                                                                                                                                                                                      |

---

### IMG_1080 — Edit Cosplay

| Field                 | Content                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Edit Cosplay                                                                                                    |
| **Purpose**           | Edit cosplay metadata.                                                                                          |
| **Primary User Task** | Update and save details.                                                                                        |
| **Key UI Components** | Cancel, "Edit Cosplay", Save; Character name; Series; Start date; End date; Budget (optional); icons per field. |
| **Features Implied**  | Edit form: character, series, start/end dates, optional budget.                                                 |
| **Backend**           | Update project (name, series, initialDate, dueDate, budget).                                                    |

---

### IMG_1081 — Complete Cosplay (validation dialog)

| Field                 | Content                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen Name**       | Cosplay Detail + Complete validation                                                                                                                      |
| **Purpose**           | Mark cosplay complete; validation before allowing.                                                                                                        |
| **Primary User Task** | Complete cosplay (blocked until conditions met).                                                                                                          |
| **Key UI Components** | Project header; Process Pictures section; modal: "Complete Cosplay" — "To mark a cosplay as 'completed' all it's elements must be ready and at 100%"; OK. |
| **Features Implied**  | Completion gated on elements 100% ready; validation + user feedback.                                                                                      |
| **Backend**           | Complete mutation checks element readiness; returns error or success.                                                                                     |

---

## 2. Competitor Feature List (COMPETITOR_FEATURES)

### Core Product Features

**Note:** Competitor "elements" are analogous to **Kyarafit closet items** — things you need for a cosplay, either to buy or to make. We already have closet items and build–item links (`buildItemLinks`); the gap is adding **type** (to buy / to make) and **status** (e.g. bought/pending, made/ongoing) on the link, and optionally inline "elements" (name only) for items not yet in the closet.

| Feature Name                        | Description                                                                                                   | Screens                 | Confidence |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| Cosplay/Character list              | List of cosplay projects (characters) with avatar, name, series, progress %                                   | IMG_1061                | High       |
| Cosplay status lifecycle            | Planned / In process / Completed                                                                              | IMG_1067, IMG_1081      | High       |
| Cosplay filter                      | Filter list by status (all, planned, in process, completed)                                                   | IMG_1067                | High       |
| Cosplay sort                        | Sort by character, series, %, due date, budget, tasks, dates, time, spend, events, photo shoots, achievements | IMG_1068, IMG_1069      | High       |
| Cosplay project detail (tabbed)     | Single project view with tabs: Elements, Tasks, Reference Images, Process Pictures, Events                    | IMG_1070–1074           | High       |
| Cosplay elements (buy/make)         | Per-project list of elements (≈ closet items) with type To Buy / To Make; add, reorder                        | IMG_1070, IMG_1075/1076 | High       |
| Element status for completion       | Elements have states (bought/pending, made/ongoing); completion requires 100%                                 | IMG_1079, IMG_1081      | High       |
| Build/project completion validation | Cannot mark complete until all elements ready at 100%                                                         | IMG_1081                | High       |
| Edit cosplay form                   | Character name, series, start date, end date, optional budget                                                 | IMG_1080                | High       |

### User Account Features

| Feature Name     | Description                                      | Screens  | Confidence |
| ---------------- | ------------------------------------------------ | -------- | ---------- |
| Log in / account | Required for import; "Cosplanner online account" | IMG_1063 | High       |
| Import cosplays  | Copy from online account to device (Premium)     | IMG_1063 | High       |
| Export cosplays  | Copy from device to online account               | IMG_1063 | High       |

### Content Management

| Feature Name                 | Description                                | Screens            | Confidence |
| ---------------------------- | ------------------------------------------ | ------------------ | ---------- |
| Reference images per project | Gallery of character reference pictures    | IMG_1072           | High       |
| Process pictures per project | Gallery of making-process photos           | IMG_1073, IMG_1081 | High       |
| Events per cosplay           | Events where user will wear this cosplay   | IMG_1074           | High       |
| Project notes                | Dedicated notes screen per cosplay; delete | IMG_1078           | High       |

### Discovery / Search

| Feature Name             | Description        | Screens  | Confidence |
| ------------------------ | ------------------ | -------- | ---------- |
| Character/cosplay search | Search bar on list | IMG_1061 | High       |

### Tasks & Reminders

| Feature Name            | Description                                          | Screens            | Confidence |
| ----------------------- | ---------------------------------------------------- | ------------------ | ---------- |
| Tasks per project       | Checklist of tasks with add/sort                     | IMG_1071           | High       |
| Task reminders (alarms) | Alarm toggle + date/time per task; app notifications | IMG_1071, IMG_1077 | High       |
| Task notes/details      | Notes/detail field on task                           | IMG_1077           | High       |

### Customization / Preferences

| Feature Name        | Description | Screens  | Confidence |
| ------------------- | ----------- | -------- | ---------- |
| Color style / theme | e.g. Purple | IMG_1064 | High       |
| Currency            | e.g. USD    | IMG_1064 | High       |
| Thumbnail size      | e.g. Medium | IMG_1064 | High       |

### Summary & Reporting

| Feature Name              | Description                                                                                                                      | Screens  | Confidence |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| Project summary dashboard | Status, progress %, dates, elapsed/remaining, elements breakdown (buy/make + states), developing time, budget, spend, difference | IMG_1079 | High       |
| Share summary             | Share icon on summary                                                                                                            | IMG_1079 | High       |

### Settings / Menus

| Feature Name          | Description                                                                          | Screens  | Confidence |
| --------------------- | ------------------------------------------------------------------------------------ | -------- | ---------- |
| Menu (slide-out)      | About, Import/Export, Settings, Store, Rate, Tell a friend, Comments and suggestions | IMG_1066 | High       |
| About screen          | Version, dev, copyright, language credits                                            | IMG_1062 | High       |
| Settings screen       | Color style, currency, thumbnail size                                                | IMG_1064 | High       |
| Multi-language (i18n) | Language credits; "see Cosplanner in your [language]"                                | IMG_1062 | Inferred   |

### Monetization

| Feature Name       | Description                                                                                                                            | Screens            | Confidence |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| In-app ads         | Banner on cosplay list; Remove Ads IAP                                                                                                 | IMG_1061, IMG_1065 | High       |
| Remove Ads IAP     | One-time $1.99 (iOS)                                                                                                                   | IMG_1065           | High       |
| Extend Limits IAP  | One-time $0.99; higher limits for elements, tasks, reference images, process pictures, events, photo shoots, achievements, best photos | IMG_1065           | High       |
| Restore purchases  | Restore IAP on same/different iOS device                                                                                               | IMG_1065           | High       |
| Premium for import | Import from cloud requires Premium                                                                                                     | IMG_1063           | High       |

### Engagement / Growth

| Feature Name             | Description          | Screens  | Confidence |
| ------------------------ | -------------------- | -------- | ---------- |
| Rate in App Store        | Link/CTA to rate app | IMG_1066 | High       |
| Tell a friend            | Share app            | IMG_1066 | High       |
| Comments and suggestions | Feedback channel     | IMG_1066 | High       |

---

## 3. Feature Comparison Table (Competitor vs Kyarafit)

| Feature                                                                    | Competitor (Cosplanner)                                 | Kyarafit                                                                                                        | Status                |
| -------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| Auth (sign in/up, session)                                                 | Yes                                                     | Yes                                                                                                             | Implemented           |
| Cosplay/build list                                                         | Yes (characters + progress)                             | Yes (builds + task counts)                                                                                      | Implemented           |
| Search cosplays/builds                                                     | Yes (search bar)                                        | No                                                                                                              | Missing               |
| Filter by status                                                           | Yes (all/planned/in process/completed)                  | Partial (list by userId; status filter possible)                                                                | Partially Implemented |
| Sort list (multiple criteria)                                              | Yes (character, %, date, budget, etc.)                  | No (no sort UI)                                                                                                 | Missing               |
| Order (asc/desc)                                                           | Yes                                                     | No                                                                                                              | Missing               |
| Cosplay/build detail with tabs                                             | Yes (Elements, Tasks, Ref images, Process pics, Events) | Build detail (single view + link-items); no tabs                                                                | Partially Implemented |
| Elements (to buy / to make) per project                                    | Yes                                                     | **Elements ≈ closet items:** we have closet items + buildItemLinks, but links have no type (buy/make) or status | Partially Implemented |
| Element status (bought/pending, made/ongoing)                              | Yes                                                     | buildItemLinks has no status field; completion not derived from link state                                      | Missing               |
| Completion validation (elements 100%)                                      | Yes                                                     | No                                                                                                              | Missing               |
| Edit cosplay/build form                                                    | Yes (character, series, dates, budget)                  | Yes (name, character, status, notes, image, budget, targetDate)                                                 | Implemented           |
| Tasks per build                                                            | Yes                                                     | Yes (buildTasks)                                                                                                | Implemented           |
| Task reminders / alarms                                                    | Yes                                                     | No                                                                                                              | Missing               |
| Task notes/details                                                         | Yes                                                     | No (label only)                                                                                                 | Missing               |
| Reference images per build                                                 | Yes                                                     | No                                                                                                              | Missing               |
| Process pictures per build                                                 | Yes                                                     | No                                                                                                              | Missing               |
| Events per cosplay (where worn)                                            | Yes                                                     | Conventions + day plans (assign build to date); not “events” per build                                          | Partially Implemented |
| Project notes (dedicated screen)                                           | Yes                                                     | Build has `notes` string; no dedicated Notes screen                                                             | Partially Implemented |
| Summary dashboard (status, progress, dates, elements, budget, spend, time) | Yes                                                     | No dedicated summary view                                                                                       | Missing               |
| Share summary                                                              | Yes                                                     | No                                                                                                              | Missing               |
| Cloud import/export                                                        | Yes (with Premium for import)                           | No (web Convex-only; mobile has sync)                                                                           | Partially Implemented |
| Settings (theme, currency, thumbnail)                                      | Yes                                                     | Settings page partial; no theme/currency/thumbnail                                                              | Partially Implemented |
| About screen                                                               | Yes                                                     | No                                                                                                              | Missing               |
| Menu (About, Import/Export, Settings, Store, Rate, Share, Feedback)        | Yes                                                     | No unified menu; settings exists                                                                                | Partially Implemented |
| Store / IAP (Remove Ads, Extend Limits, Restore)                           | Yes                                                     | Tiers/subscription partial; no Stripe/Store UI                                                                  | Partially Implemented |
| Rate / Tell a friend / Feedback                                            | Yes                                                     | No                                                                                                              | Missing               |
| i18n / multi-language                                                      | Yes (credits + CTA)                                     | No                                                                                                              | Missing               |
| Conventions + day plans + packing                                          | N/A (events per cosplay)                                | Yes                                                                                                             | Implemented           |
| Itinerary view                                                             | N/A                                                     | Yes (partial)                                                                                                   | Implemented           |
| Planner (cross-build tasks)                                                | N/A                                                     | Yes (partial)                                                                                                   | Implemented           |
| Closet items linked to builds                                              | N/A                                                     | Yes                                                                                                             | Implemented           |
| Image upload (build, closet, convention)                                   | Inferred                                                | Yes (partial; convention new missing)                                                                           | Partially Implemented |

---

## 4. High-Value Feature Gaps (Prioritized)

### Tier 1 — Must-have to match competitor

| Gap                                   | Rationale                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Build-level “elements” (buy/make)** | Core to competitor’s project model; we have closet + links but no explicit “elements” list with buy/make and status. |
| **Status filter on build list**       | Planned / In process / Completed is central to Cosplanner; we have status but no filter UI.                          |
| **Summary dashboard per build**       | Status, progress %, elapsed/remaining, element breakdown, budget/spend — key for planning.                           |
| **Completion validation**             | “All elements 100%” before complete — clear rule and UX.                                                             |

### Tier 2 — Important enhancements

| Gap                                      | Rationale                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Reference images per build**           | Expected for cosplay workflow; we have build image, not a gallery.                                       |
| **Process pictures per build**           | Same as above; separate gallery for progress.                                                            |
| **Task reminders / alarms**              | Notifications for tasks are high value.                                                                  |
| **Project notes (dedicated)**            | We have `build.notes`; dedicated Notes screen improves UX.                                               |
| **Search build list**                    | Quick find in large lists.                                                                               |
| **Sort + order build list**              | Sort by progress, date, budget, etc.                                                                     |
| **Events “where you wear this cosplay”** | We have convention day plans; competitor has explicit “events” per cosplay — consider mapping or adding. |

### Tier 3 — Nice to have

| Gap                                       | Rationale                  |
| ----------------------------------------- | -------------------------- |
| **About screen**                          | Version, credits, legal.   |
| **Rate / Tell a friend / Feedback**       | Growth and support.        |
| **Theme / currency / thumbnail settings** | Personalization.           |
| **Share summary**                         | Export/share summary view. |
| **i18n**                                  | Broader reach.             |

---

## 5. Implementation Design (Selected Gaps)

### Feature: Build elements (to buy / to make)

- **User story:** As a user I can add elements to a build and mark each as “to buy” or “to make,” and track status so I can see progress and complete the build when all are 100%.
- **Frontend**
  - Build detail: tab or section “Elements” with list (name, type, status); add button → New Element modal (name, To Buy / To Make).
  - Element row: status control (e.g. bought/pending or made/ongoing); reorder (e.g. drag or up/down).
  - Reuse or extend build detail layout (tabs if we add more sections).
- **Backend**
  - New table `buildElements`: `buildId`, `userId`, `name`, `type` (buy|make), `status` (e.g. bought|pending, made|ongoing), `sortOrder`.
  - Convex: `buildElements.listByBuild`, `create`, `update`, `remove`, `reorder`.
- **Database**
  - `buildElements` with indexes `by_buildId`, `by_userId`.
- **External:** None.

---

### Feature: Build status filter on list

- **User story:** As a user I can filter the build list by status (e.g. idea/wip/ready or planned/in process/completed).
- **Frontend**
  - Builds list page: filter control (tabs or dropdown) — All, Planning/Idea, In progress/WIP, Completed/Ready; pass filter to query.
- **Backend**
  - `builds.list` already has `userId`; add optional `status` arg; filter in query or index `by_userId_status`.
- **Database**
  - Existing `builds` and `by_userId_status`; no change if index exists.
- **External:** None.

---

### Feature: Summary dashboard per build

- **User story:** As a user I can open a Summary view for a build and see status, progress %, dates, element counts (buy/make + states), time, budget, and spend.
- **Frontend**
  - Build detail: “Summary” tab or button → Summary page/section: status, progress bar, initial/due/elapsed/remaining, elements to buy (bought/pending/total), to make (made/ongoing/total), developing time, budget, total spend, difference.
  - Optional: Share button (native share or export).
- **Backend**
  - Query or action that aggregates: build fields; buildItemLinks (and buildElements if used) counts by type and status; buildTasks for progress; optional time/spend tables if we add them.
  - If we don’t have “developing time” or “total spend” yet: add fields or tables (e.g. build time logs, spend entries) or derive from existing data.
- **Database**
  - Depends on whether we add time tracking and spend per build; at minimum build + buildItemLinks (with type/status) + buildTasks.
- **External:** None.

---

### Feature: Completion validation

- **User story:** When I tap “Complete,” the app only marks the build complete if all elements are “ready” (e.g. bought/made at 100%); otherwise show an explanation.
- **Frontend**
  - Complete button: call mutation; on error (e.g. “elements not 100%”), show dialog with message (e.g. same as Cosplanner).
- **Backend**
  - `builds.complete` or `builds.update` with status=ready: check that all build-item links (and inline elements if using Option B) for that build have status indicating ready (e.g. "bought" for buy, "made" for make); if not, return error with message. “ready” state.
- **Database**
  - Uses extended buildItemLinks (and buildElements if Option B); no extra change.
- **External:** None.

---

### Feature: Reference images per build

- **User story:** As a user I can add and view reference images for a build.
- **Frontend**
  - Build detail: “Reference images” tab or section; gallery + add (reuse ImageUpload); optional caption/order.
- **Backend**
  - Table `buildReferenceImages`: `buildId`, `userId`, `imageStorageId`/`imageUrl`, `sortOrder`; Convex CRUD + file storage.
- **Database**
  - `buildReferenceImages` with `by_buildId`, `by_userId`.
- **External:** Convex file storage (existing).

---

### Feature: Process pictures per build

- **User story:** As a user I can add and view process photos for a build.
- **Frontend**
  - Build detail: “Process pictures” tab or section; same pattern as reference images.
- **Backend**
  - Table `buildProcessPictures`: same shape as reference images; Convex CRUD + file storage.
- **Database**
  - `buildProcessPictures` with `by_buildId`, `by_userId`.
- **External:** Convex file storage (existing).

---

### Feature: Task reminders (alarms)

- **User story:** As a user I can set an optional reminder (date/time) on a build task and get a notification.
- **Frontend**
  - Task form/modal: “Reminder” or “Alarm” toggle; date/time picker when on; save with task.
- **Backend**
  - buildTasks: add `reminderAt` (optional number or string ISO); when saving, optionally schedule notification (e.g. push or in-app).
  - Notification: Convex scheduled function or external (e.g. OneSignal/Expo) using `reminderAt`.
- **Database**
  - `buildTasks`: add `reminderAt` (optional).
- **External:** Push provider if we want push; otherwise in-app only.

---

### Feature: Search and sort build list

- **User story:** As a user I can search builds by name/character and sort by progress, date, budget, etc., and choose order (asc/desc).
- **Frontend**
  - Builds list: search input; sort dropdown (e.g. name, progress, target date, budget); order toggle (asc/desc).
- **Backend**
  - `builds.list`: optional `search` (string), `sortBy` (e.g. name, progress, targetDate, budgetCents), `order` (asc/desc). Filter by name/character; sort in query or in memory for small lists.
- **Database**
  - Indexes as needed (e.g. by_userId + sort field); or client-side sort if dataset small.
- **External:** None.

---

## 6. Phased Implementation Roadmap

### Phase 1 — Critical parity (elements, status filter, summary, completion)

- **Tasks**
  - Add `buildElements` schema and Convex API; build detail “Elements” section and New Element modal; element status and reorder.
  - Add completion validation in build update (all elements 100%); “Complete” dialog on failure.
  - Build list: status filter (tabs or dropdown) using existing status/index.
  - Summary dashboard: new Summary tab/section on build detail; aggregate progress, elements, dates; optional budget/spend if we add fields.
- **Dependencies**
  - buildItemLinks extension (and optional inline elements) before completion validation and summary.
- **Files**
  - `convex/schema.ts` (buildElements); `convex/buildElements.ts`; `web/src/app/build-detail/page.tsx` (tabs/sections, Elements, Summary); build list page (filter); new components: ElementList, NewElementModal, BuildSummary (or inline).

### Phase 2 — UX and content (reference/process images, notes, search/sort)

- **Tasks**
  - Reference images: schema + API + Build detail section + ImageUpload.
  - Process pictures: same pattern.
  - Dedicated Notes screen/modal for build (use or extend `build.notes`).
  - Build list: search input + sort + order; Convex list args.
- **Dependencies**
  - None blocking; can parallelize.
- **Files**
  - `convex/schema.ts` (buildReferenceImages, buildProcessPictures); `convex/buildReferenceImages.ts`, `convex/buildProcessPictures.ts`; build detail tabs/sections; `web/src/app/builds/page.tsx` (search, sort, order).

### Phase 3 — Tasks and notifications (reminders, task notes)

- **Tasks**
  - buildTasks: add `reminderAt`, `notes`/`details`; task form with reminder toggle and date/time, notes field.
  - Notification path: in-app only first; optional push later.
- **Dependencies**
  - buildTasks schema change; optional push provider.
- **Files**
  - `convex/schema.ts` (buildTasks); `convex/buildTasks.ts`; TaskChecklist and task create/edit UI.

### Phase 4 — Polish (About, menu, rate/share/feedback, theme/currency)

- **Tasks**
  - About page (version, credits, link to legal).
  - Unified menu (or extend nav): About, Settings, Subscription, Rate, Share, Feedback.
  - Rate in App Store / Tell a friend / Feedback (links or native share).
  - Settings: theme/color, currency, thumbnail size (if we have galleries); persist in user prefs (Convex users or new preferences table).
- **Dependencies**
  - Settings and tier already partially there.
- **Files**
  - `web/src/app/about/page.tsx`; layout/nav (menu); settings subpages; optional `userPreferences` or extend users.

---

## 7. Engineering Task List

| Task                                                                         | Description                                                                                                                                                                              | Files Affected                                                                    | Difficulty |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| Extend buildItemLinks with type, status, sortOrder; optional inline elements | Add type (buy\|make), status (e.g. pending\|bought\|ongoing\|made), sortOrder to buildItemLinks; optional closetItemId + optional name for inline elements; Convex list/update/link APIs | convex/schema.ts, convex/builds.ts or buildItemLinks; Convex link/element APIs    | M          |
| Build detail: Elements tab/section (≈ link items + type/status)              | UI for elements list (from links + inline), add from closet or add inline (name + To Buy/To Make), reorder, status controls                                                              | web/src/app/build-detail/page.tsx, link-items or new ElementList, NewElementModal | M          |
| Completion validation                                                        | build update/complete checks all elements (links + inline) 100% ready; return error + message; dialog on frontend                                                                        | convex/builds.ts, web build-detail                                                | S          |
| Build list status filter                                                     | Filter by status (idea/wip/ready or mapped labels); use index by_userId_status                                                                                                           | web/src/app/builds/page.tsx, convex/builds.ts (optional status arg)               | S          |
| Summary dashboard                                                            | Aggregate build + buildItemLinks (type/status counts) + tasks; Summary tab/section with status, progress, dates, element counts, budget/spend if present                                 | convex (query or inline in get), web build-detail Summary section                 | M          |
| buildReferenceImages schema + API + UI                                       | Table, CRUD, file storage; Build detail Reference images section + ImageUpload                                                                                                           | convex/schema.ts, convex/buildReferenceImages.ts, web build-detail                | M          |
| buildProcessPictures schema + API + UI                                       | Same as reference images for process pictures                                                                                                                                            | convex/schema.ts, convex/buildProcessPictures.ts, web build-detail                | M          |
| Dedicated Notes screen/modal for build                                       | Full-screen or modal notes editor; persist to build.notes                                                                                                                                | web build-detail (Notes button → page or modal)                                   | S          |
| Build list search                                                            | Optional search arg in list; filter by name/character                                                                                                                                    | convex/builds.ts, web/src/app/builds/page.tsx                                     | S          |
| Build list sort and order                                                    | sortBy (name, progress, targetDate, budgetCents), order (asc/desc)                                                                                                                       | convex/builds.ts, web/src/app/builds/page.tsx                                     | S          |
| buildTasks: reminder + notes fields                                          | Add reminderAt, notes/detail; task form alarm + date/time + notes                                                                                                                        | convex/schema.ts, convex/buildTasks.ts, TaskChecklist + task form                 | M          |
| Task reminder notifications                                                  | In-app or push at reminderAt                                                                                                                                                             | convex (scheduled or action) or Expo/OneSignal                                    | L          |
| About page                                                                   | Version, dev, copyright, language credits                                                                                                                                                | web/src/app/about/page.tsx, package or env for version                            | S          |
| Menu: About, Rate, Share, Feedback                                           | Add menu items and links                                                                                                                                                                 | Layout/nav, app config (store URL, feedback URL)                                  | S          |
| Settings: theme, currency, thumbnail size                                    | User preferences; Convex users or prefs table; settings UI                                                                                                                               | convex/schema or users, web settings subpages                                     | M          |

---

**Document generated from competitor screenshots (docs/competitor/IMG_1061–IMG_1081) and Kyarafit implementation docs (docs/implementation/, convex/, web/).**

**Related:** This doc is linked from [implementation/README.md](../implementation/README.md), [ROADMAP.md](../implementation/ROADMAP.md), [GAP_ANALYSIS.md](../implementation/GAP_ANALYSIS.md), [COMMIT_PLAN.md](../implementation/COMMIT_PLAN.md), and [IMPLEMENTATION_GUIDES_INDEX.md](../implementation/IMPLEMENTATION_GUIDES_INDEX.md). Use those for the main phased plan and commit breakdown; use this doc for competitor-parity scope and design details.
