/**
 * DB entry point. For TypeScript and fallback resolution only.
 * Metro uses platform extensions: db.web.ts (web) or db.native.ts (iOS/Android),
 * so expo-sqlite is never loaded in the web bundle.
 */
export { initClosetDb, getDb } from "./db.web";
