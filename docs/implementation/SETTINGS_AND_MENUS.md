# Settings and Other Menus

Build out the **settings** menu (Account Details, Subscription Plan, Notification Style) and other global menus with real screens or forms. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx) shows tier/storage and three labels ("Account Details", "Subscription Plan", "Notification Style") with no destinations or forms. Same idea on mobile.
- **Target**: Each settings item goes to a real page or modal: Account Details (email, name, password/auth link), Subscription Plan (tier, usage, upgrade/manage link), Notification Style (preferences). Other menus (About, Privacy, Help) have content or links.

---

## Prerequisites

- [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx): Exists; menu items are static labels.
- Auth: How user email/name are stored and updated (Supabase or other). Subscription: see [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md).
- useTier / useFeatureAccess for tier and usage.

---

## Step 1: Wire settings menu items to routes or modals

**What to do**

- In [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx): Make each menu item a Link or button that navigates to a route (e.g. /settings/account, /settings/subscription, /settings/notifications) or opens a modal. Create placeholder pages or modals so navigation works. Use Next.js Link for client-side navigation.

**Files to touch**

- `web/src/app/settings/page.tsx`
- New routes: e.g. `web/src/app/settings/account/page.tsx`, `web/src/app/settings/subscription/page.tsx`, `web/src/app/settings/notifications/page.tsx` (or use one page with a tab/query).

**Cursor prompt**

```
In web/src/app/settings/page.tsx, wire each menu item to a destination: (1) "Account Details" → Link to /settings/account (or open AccountDetailsModal). (2) "Subscription Plan" → Link to /settings/subscription. (3) "Notification Style" → Link to /settings/notifications. Create minimal placeholder pages under web/src/app/settings/account/, subscription/, notifications/ that render a title and back link to /settings. Use Next.js Link and existing layout. Run npm run build.
```

---

## Step 2: Account Details page

**What to do**

- Build the Account Details page (or modal): show current email and display name (from auth/session). Provide a way to change password or "Manage account" that links to the auth provider (e.g. Supabase account page). If the app manages profile in-house, add a form to update display name and call the appropriate API. Do not store passwords in the app; link out for password change if needed.

**Files to touch**

- `web/src/app/settings/account/page.tsx` (or a component used by settings).

**Cursor prompt**

```
Build the Account Details settings page: (1) Show current user email and display name from auth/session (use the same auth hook as elsewhere). (2) Add a link or button "Change password" / "Manage account" that goes to the auth provider (e.g. Supabase) or a dedicated account management URL. (3) If the app has a profile update API, add a form to edit display name and call it. (4) Back link to /settings. Use existing design tokens. Run npm run build.
```

---

## Step 3: Subscription Plan page

**What to do**

- Build the Subscription Plan page: show current tier and storage usage (use useTier or user API). Add a button "Upgrade" or "Manage subscription" that links to the subscription flow (Stripe Checkout or Customer Portal); see [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md). For FREE users, emphasize upgrade; for paying users, show "Manage" to update payment or cancel.

**Files to touch**

- `web/src/app/settings/subscription/page.tsx`

**Cursor prompt**

```
Build the Subscription Plan settings page: (1) Show current tier and storage (use useTier or GET /api/v1/users/me). (2) For FREE users, show "Upgrade to Premium Basic" (or similar) and a button that opens the subscription checkout or a link to /api/v1/subscription/checkout (or Customer Portal). (3) For paying users, show "Manage subscription" linking to Customer Portal or billing. (4) Back link to /settings. Wire the upgrade button to the subscription API when implemented. Run npm run build.
```

---

## Step 4: Notification Style page

**What to do**

- Build the Notification Style page: options for push notifications, email notifications, and in-app preferences (e.g. on/off toggles). If the backend does not yet store notification preferences, use local state or a stub API and document that backend support is needed later.

**Files to touch**

- `web/src/app/settings/notifications/page.tsx`

**Cursor prompt**

```
Build the Notification Style settings page: (1) Add toggles or options for push notifications and email notifications (and any in-app notification prefs). (2) If backend has a user preferences API, wire the toggles to it; otherwise use local state and document that API is TODO. (3) Back link to /settings. Use existing design tokens. Run npm run build.
```

---

## Step 5: Other menus (About, Privacy, Help)

**What to do**

- Identify other global menus (e.g. in footer or header). Add About (app version, link to terms), Privacy (link to privacy policy or inline text), Help (link to docs or FAQ). Create static pages or external links as appropriate.

**Files to touch**

- New pages or links in layout/footer, e.g. `web/src/app/about/page.tsx`, `web/src/app/privacy/page.tsx`, or links in settings.

**Cursor prompt**

```
Add other global menus: (1) About page or link (version, terms). (2) Privacy page or link (policy URL or placeholder). (3) Help page or link (docs/FAQ). Add them to the settings page or to a footer/nav so users can find them. Use minimal static content or external URLs. Run npm run build.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Wire settings items to routes or modals; create placeholder pages. |
| 2 | Account Details: email, name, password/auth link. |
| 3 | Subscription Plan: tier, usage, upgrade/manage button. |
| 4 | Notification Style: toggles for push/email. |
| 5 | About, Privacy, Help pages or links. |
