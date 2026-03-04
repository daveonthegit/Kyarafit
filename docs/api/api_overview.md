# Kyarafit – API Overview (Convex)

The app uses **Convex** as the backend. There is no REST API; data is accessed via Convex queries and mutations from web and mobile using `useQuery` / `useMutation` and the generated `api` object.

## Auth

- **Better Auth** handles sign-in/sign-up (email+password and OAuth). Auth HTTP routes live at `*.convex.site` (see `convex/http.ts` and `convex/betterAuth/`).
- **Convex identity**: After auth, the Convex client sends a JWT; `api.auth.getCurrentUser()` returns the current user (subject, name, email).

## Convex API (main modules)

| Module        | Purpose                          | Examples |
| ------------- | --------------------------------- | -------- |
| `auth`       | Current user identity             | `api.auth.getCurrentUser` |
| `closetItems`| Closet CRUD                       | `list`, `get`, `create`, `update`, `remove` |
| `builds`     | Builds CRUD + linked items        | `list`, `get`, `getItems`, `create`, `update`, `remove`, `linkItems` |
| `buildTasks` | Build task checklist              | `listByBuild`, `create`, `update`, `remove` |
| `conventions`| Conventions, plans, packing       | `list`, `get`, `getPlan`, `getPacking`, `create`, `update`, `remove`, `replacePlan`, `regeneratePacking`, `updatePackingItem`, `addManualPackingItem` |
| `users`      | User profile                      | `getMe`, `upsert` |
| `files`      | File storage                      | `generateUploadUrl`, `getUrl` |

All mutations and queries that touch user data require an authenticated user and enforce ownership via `userId`.

## Legacy REST API

The previous Go Fiber REST API is documented in [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for reference only. It is not used by the current app.
