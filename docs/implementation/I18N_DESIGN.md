# Feature 19 — i18n Implementation Design

**Source:** FEATURES_CANONICAL §19, FEATURE_STATUS (i18n: NOT IMPLEMENTED).

**Acceptance criteria (verbatim):**

- App UI (or key screens) can be shown in more than one language (e.g. via i18n library and locale selection).
- User can select preferred language (e.g. in settings or on first run).
- Optional: About or Settings shows language credits (contributors per language) and link/CTA to request or contribute a new language.

---

## Step 1 — Design Plan

### Data model / backend / DB

- **None.** Locale is client-only (localStorage). No Convex schema or API changes.

### Frontend architecture

- **Library:** `next-intl` (App Router–friendly, type-safe, small bundle).
- **Locale storage:** `localStorage` key `kyarafit-locale`; validated against allowlist `['en','es']` (expandable).
- **Provider:** Client component `LocaleProvider` wraps app with `NextIntlClientProvider`; reads initial locale from `getStoredLocale()`; loads message objects for all supported locales and passes `messages[locale]`; exposes `setLocale` via React context so Settings can switch language and re-render.
- **First translated screen:** Settings (menu labels, headings, storage copy, Sign out). Additional screens can be moved to translation in follow-up PRs.
- **Language selector:** In Settings page under "Profile & Identity" (or its own section): row "Language" with current language label; tap opens inline select or modal to choose English / Español; on change call `setLocale`, persist to localStorage, provider re-renders.

### Edge cases and error states

- Invalid or missing value in `localStorage`: treat as `'en'`.
- Missing translation key: next-intl falls back to key or default; we keep keys consistent between en.json and es.json.
- SSR: Root layout stays server; locale is resolved only in client after hydration. First paint may show default (en) until client runs; acceptable for this slice.

### Security

- No authz; locale is a display preference. Validation: only allow locales in `SUPPORTED_LOCALES` before storing.

### Tests to add

- **Unit:** `web/src/lib/i18n/locale.test.ts` — `getStoredLocale` returns stored value when valid, returns `'en'` when missing/invalid; `setStoredLocale` writes only allowlisted values.
- **Component:** Settings page — render and expect translated heading "Settings" (or key) for default locale; optionally assert Language row present and change triggers re-render (mock context).

### Files to create or touch

| Path                                    | Action                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `web/package.json`                      | Add dependency `next-intl`                                                                   |
| `web/messages/en.json`                  | Create — English strings for Settings (and shared)                                           |
| `web/messages/es.json`                  | Create — Spanish strings for Settings                                                        |
| `web/src/lib/i18n/locale.ts`            | Create — getStoredLocale, setStoredLocale, SUPPORTED_LOCALES                                 |
| `web/src/lib/i18n/context.tsx`          | Create — LocaleContext (locale + setLocale)                                                  |
| `web/src/components/LocaleProvider.tsx` | Create — client wrapper: locale state, load messages, NextIntlClientProvider + LocaleContext |
| `web/src/app/layout.tsx`                | Edit — wrap children with LocaleProvider (inside ConvexClientProvider)                       |
| `web/src/app/settings/page.tsx`         | Edit — useTranslations, Language selector, translate all visible strings                     |
| `web/src/lib/i18n/locale.test.ts`       | Create — unit tests for locale helpers                                                       |
| `web/src/app/settings/page.test.tsx`    | Edit — assert translated content and Language selector                                       |

---

## Verification

- Run `npm run validate` and `npm run test` in web.
- Manually: Open Settings, switch language to Español; confirm labels and headings change; reload page and confirm language persists.
