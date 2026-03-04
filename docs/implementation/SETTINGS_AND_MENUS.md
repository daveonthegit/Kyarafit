# Settings and Menus

**Purpose:** Settings menu with real screens: Account Details, Subscription Plan, Notification Style; optionally About, Privacy, Help. Same on web and mobile. Tier/usage from useTier (and Convex users when wired).

**Scope:** In: Settings page and sub-routes, Better Auth for account (email, name, change password link), Convex users for tier/usage, Stripe for subscription when implemented. Out: Supabase auth (use Better Auth).

**Current state:**

- **Web:** [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx) — shows tier/storage (useTier) and three labels: "Account Details", "Subscription Plan", "Notification Style" with no links or forms.
- **Auth:** Better Auth — email/name from session; change password / manage account via Better Auth docs or provider link.
- **Tier:** [web/src/lib/api/useTier.ts](web/src/lib/api/useTier.ts) — returns hardcoded FREE; when Convex users.getMe (or equivalent) returns tier/usage, wire useTier to it.
- **Convex:** [convex/users.ts](convex/users.ts) — getMe, upsert; schema has tier, currentUsageMb, stripeCustomerId, etc.

**Next steps:**

1. **Wire menu items:** Each settings item → Link to /settings/account, /settings/subscription, /settings/notifications (or tabs on one page). Create placeholder or full pages.
2. **Account Details page:** Show email, display name from auth (authClient.useSession() or server session); "Change password" / "Manage account" link to Better Auth account page or provider.
3. **Subscription Plan page:** Show tier and usage from useTier (then from Convex users when wired); "Upgrade" / "Manage" link to Stripe Checkout/Portal when implemented (see SUBSCRIPTION_SERVICE).
4. **Notification Style page:** Placeholder or preferences form if product defines it.
5. **About / Privacy / Help:** Static content or links.
6. **Mobile:** Same menu and sub-screens; use same auth and tier sources.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Settings, Tiers), [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md), [docs/auth.md](../auth.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
