# Seed the first admin user (KFM-028b)

Convex stores role on `users.role` (`"user"` | `"admin"`). Mutations such as `broadcasts.create` call `requireAdmin`, which succeeds only when the authenticated Convex identity maps to a row with `role === "admin"`.

## Steps (development)

1. Sign up or sign in once in the app or web so a `users` document exists for your account.
2. Open the [Convex dashboard](https://dashboard.convex.dev) for this deployment.
3. Go to **Data** → table **`users`**.
4. Find your user row (match `email`, `subject`, or auth identifier used by Better Auth).
5. Edit the document and set **`role`** to **`admin`** (string).
6. Save. The next admin-gated mutation runs with your session.

## Production notes

- Prefer promoting admins through a controlled internal process; avoid leaving dashboard access wide open.
- After schema changes, confirm codegen (`npx convex codegen`) and redeploy so `requireAdmin` and indexes stay in sync.
