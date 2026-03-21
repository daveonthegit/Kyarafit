---
name: continue-redesign
overview: Continuation of the web-first Kyarafit redesign, picking up where the previous session left off (completing detail pages and finishing remaining web views before moving to mobile).
todos:
  - id: complete-convention-detail
    content: Complete the Convention Detail Page redesign (staggered timeline, split-screen layout)
    status: pending
  - id: group-detail-page
    content: Redesign Group Detail page using the split-screen editorial layout and poster-style cards
    status: pending
  - id: remaining-web-pages
    content: Redesign remaining web views (Profile, Settings, Planner polish)
    status: pending
  - id: web-add-flows
    content: Refactor Web Add/Create flows (Slide-out Sheets/Modals) to match the new rounded-2xl aesthetic and typography
    status: pending
  - id: mobile-unified-add
    content: Rebuild Mobile unified Add/Create flows using Bottom Sheets
    status: pending
  - id: mobile-screens-rebuild
    content: Rebuild Mobile screens from Web references, establishing feature parity
    status: pending
isProject: true
---

# Continuation Plan: Kyarafit Web-First Redesign

## Progress Summary (What's Done)

In the previous sessions, we successfully established the new design direction:

1. **Design System Updated:** Transitioned from sharp corners to soft, elegant `rounded-2xl` surfaces and `rounded-full` pills/buttons/checkboxes. Adopted `shadow-soft` for subtle elevation.
2. **Home Dashboard:** Rewritten into a modern "Bento Box" grid, featuring horizontal scrolling carousels for events and projects, and a fixed height (`100dvh`) without page-level scrolling.
3. **List Pages Unified:** Builds, Closet, Conventions, and Groups list pages were updated. Cards now use a "Poster Style" (image background with gradient overlay and text on top). Checkboxes, filters, and action bars were rounded out.
4. **Closet Item Detail:** Completely redesigned into a split-screen editorial layout. The left column features a sticky, large image. The right column contains scrollable details, task lists, and associated lookbooks. A fixed floating bottom action bar handles page-level actions.
5. **Backend Data Support:** Updated Convex queries (e.g., `getBuildsUsingClosetItem`) to ensure rich image data is passed to UI components where needed.

## Immediate Next Steps

### 1. Complete Convention Detail Page Redesign

We have an existing plan for this (`convention-detail-redesign_5f0d57c7.plan.md`) which needs to be executed successfully.

- Apply the split-screen layout (sticky left image).
- Implement the **Staggered Timeline** for daily cosplay schedules, alternating rich build cards.
- Restyle the Logistics and Packing List sections.
- Move primary actions to a floating bottom action bar.

### 2. Group Detail Page Redesign

Apply the same editorial principles to `/g/[groupId]/page.tsx`.

- Use the split-screen layout.
- Use poster-style cards for members, associated conventions, and builds in the group.
- Floating bottom action bar for group-level actions.

### 3. Remaining Web Views & Polish

- Ensure Profile (`/u/[username]`), Planner (`/planner`), and Settings pages perfectly match the new aesthetics.
- Refine form inputs (underline style or rounded pills).

### 4. Web Unified Add/Create Flows

- Ensure all slide-out sheets and modals for creating items (Builds, Closet items, Events) are scaled responsively and use the new typography, border-radius (`rounded-2xl`), and layout conventions.

### 5. Mobile Rebuild

Once the web foundation is complete, begin rebuilding the React Native (`mobile/`) application to achieve feature parity, adapting layouts into mobile-native paradigms (e.g., Bottom Sheets instead of right-side drawers).
