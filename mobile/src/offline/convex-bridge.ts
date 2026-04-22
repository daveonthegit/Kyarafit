/**
 * Named entry points for offline-aware data (KFM-026).
 * Today these mirror Convex hooks; SQLite read-through + queue replay land on feature screens.
 */
export { useQuery as useOfflineQuery, useMutation as useOfflineMutation } from "convex/react";
