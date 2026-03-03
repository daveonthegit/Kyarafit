# Authentication

Kyarafit uses **Better Auth** with OAuth (Google required, GitHub optional), integrated as a Convex component. There is no email/password authentication.

## Architecture

```
User (Browser/Mobile)
        │
        ▼ OAuth redirect
Google / GitHub OAuth
        │
        ▼ callback
Better Auth (Convex component, /auth/* HTTP actions)
        │
        ▼ session stored in Convex DB
ConvexBetterAuthProvider (React)
        │
        ▼ signed requests
Convex Functions (queries/mutations)
```

## Environment Variables

### Convex Dashboard (Settings → Environment Variables)

| Variable                    | Description                                                                 | Required |
| --------------------------- | --------------------------------------------------------------------------- | -------- |
| `GOOGLE_CLIENT_ID`          | Google OAuth app client ID                                                  | Yes      |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth app client secret                                              | Yes      |
| `BETTER_AUTH_SECRET`        | Random secret for signing sessions                                          | Yes      |
| `SITE_URL`                  | Production app URL (e.g. `https://yourapp.com`) for CORS + OAuth callbacks | Yes (prod) |
| `ADDITIONAL_CORS_ORIGINS`   | Comma-separated origins (e.g. `exp://192.168.1.5:8081` for Expo Go on device) | No     |
| `RESEND_API_KEY`            | Resend API key for transactional emails                                     | No       |
| `EMAIL_FROM`                | Sender address (`Kyarafit <noreply@yourdomain.com>`)                        | No       |
| `APP_URL`                   | App URL used in email links (default: localhost:3000)                       | No       |
| `GITHUB_CLIENT_ID`          | GitHub OAuth app client ID                                                  | No       |
| `GITHUB_CLIENT_SECRET`      | GitHub OAuth app client secret                                              | No       |

### Web (`web/.env.local`)

| Variable                      | Description                        |
| ----------------------------- | ---------------------------------- |
| `CONVEX_DEPLOYMENT`           | Convex deployment name (auto-set)  |
| `CONVEX_URL`                  | Convex backend URL (auto-set)      |
| `CONVEX_SITE_URL`             | Convex HTTP actions URL (auto-set) |
| `NEXT_PUBLIC_CONVEX_URL`      | Public URL for React client        |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Public site URL for auth client    |

### Mobile (`mobile/.env`)

| Variable                      | Description                     |
| ----------------------------- | ------------------------------- |
| `EXPO_PUBLIC_CONVEX_URL`      | Convex backend URL for Expo     |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex site URL for Better Auth |

### Email verification (sign-up / password reset)

For email/password sign-up and password reset to work:

1. **Convex** sets `CONVEX_SITE_URL` automatically. The auth config uses it as `baseURL` so verification links in emails point to Convex (e.g. `https://your-deployment.convex.site/auth/verify-email?token=...`). No extra config needed.
2. **Resend**: In Convex Dashboard → Settings → Environment Variables, set:
   - `RESEND_API_KEY` — required for any email to be sent; if missing, sign-up succeeds but no verification email is sent (see Convex logs).
   - `EMAIL_FROM` — sender address (e.g. `Kyarafit <noreply@yourdomain.com>`); must be a verified domain in Resend.
3. After the user clicks the link in the email, they hit Convex, which verifies the token and (with `autoSignInAfterVerification: true`) signs them in and can redirect to your app.

## Auth Flow

### Sign In (Web)

1. User visits `/auth/signin` and clicks "Continue with Google"
2. `authClient.signIn.social({ provider: "google", callbackURL: "/home" })` is called
3. Browser redirects to Google OAuth consent screen
4. Google redirects to `NEXT_PUBLIC_CONVEX_SITE_URL/auth/callback/google`
5. Better Auth creates a session in Convex (user + session + account records)
6. Browser redirects to `/home` with session cookie set
7. `ConvexBetterAuthProvider` picks up the session and all Convex queries run authenticated

### Sign In (Mobile)

1. User taps "Continue with Google" on the auth screen
2. `authClient.signIn.social({ provider: "google" })` opens OAuth in-app browser
3. Same server-side flow as above
4. Session is established and the app navigates to tabs

### Sign Out

```typescript
await authClient.signOut();
```

### Anonymous / Offline Use

- Mobile: Users can tap "Continue without account" and use the app fully offline with local SQLite storage. No Convex sync.
- Web: Unauthenticated users are redirected to `/auth/signin` by `AuthGate`.

## Key Files

### Web

| File                                          | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `web/src/lib/auth/auth-client.ts`             | Better Auth React client (OAuth sign in/out, `useSession`) |
| `web/src/lib/auth/auth-server.ts`             | Next.js server helpers (`getToken`, `handler`)             |
| `web/src/app/api/auth/[...all]/route.ts`      | Auth route handler                                         |
| `web/src/components/AuthGate.tsx`             | Client-side route protection                               |
| `web/src/components/ConvexClientProvider.tsx` | `ConvexBetterAuthProvider` wrapper                         |

### Convex

| File                          | Purpose                                            |
| ----------------------------- | -------------------------------------------------- |
| `convex/auth.config.ts`       | Better Auth provider config                        |
| `convex/convex.config.ts`     | Component registration                             |
| `convex/betterAuth/auth.ts`   | Better Auth instance (OAuth providers, DB adapter) |
| `convex/betterAuth/schema.ts` | Auth tables (user, session, account, verification) |
| `convex/http.ts`              | HTTP router mounting auth routes                   |

## Setting Up OAuth

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URIs:
   - `https://your-deployment.convex.site/auth/callback/google`
   - `http://localhost:3000/auth/callback/google` (for local dev, if needed)
4. Copy Client ID and Secret → Convex dashboard environment variables

### GitHub OAuth (Optional)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New OAuth App
2. Set Authorization callback URL: `https://your-deployment.convex.site/auth/callback/github`
3. Copy Client ID and Secret → Convex dashboard environment variables

## Troubleshooting

### "CONVEX_SITE_URL is not set"

Ensure `web/.env.local` contains both `CONVEX_SITE_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`. Run `npx convex dev` from the project root to auto-populate these.

### OAuth redirect mismatch

The callback URL must exactly match what you registered in the OAuth provider console. The format is:

```
https://<your-deployment>.convex.site/auth/callback/<provider>
```

### Session not persisting

Check that `BETTER_AUTH_SECRET` is set in the Convex dashboard. Without it, sessions cannot be signed.

### Mobile OAuth not working

Mobile OAuth requires a proper deep-link redirect URL. Configure `scheme` in `mobile/app.json` and register it with the OAuth provider.
