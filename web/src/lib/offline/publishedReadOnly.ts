import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { getStoredLocale } from "../i18n/locale";

/**
 * Web shows published copies only (ADR-0005): personal data is edited in the mobile app, whose
 * vault replicates to Kyarafit Cloud, so web never writes personal domain rows. Social actions on
 * published copies (groups, collaborators, likes, comments) live in other modules and stay allowed.
 */
const PERSONAL_MODULES = new Set([
  "builds",
  "conventions",
  "cosplayNodes",
  "buildTasks",
  "workflow",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
  "seed",
  "publications",
]);

export const PUBLISHED_READ_ONLY_MESSAGE = en.Sync.publishedReadOnly;

export class PublishedReadOnlyError extends Error {
  constructor() {
    super((getStoredLocale() === "es" ? es : en).Sync.publishedReadOnly);
    this.name = "PublishedReadOnlyError";
  }
}

/**
 * Refuse a personal-data write on web. The refusal is shown once, app-wide (like a failed local
 * write), so a screen that keeps its form open on error never fails silently.
 */
export function assertWebMutationAllowed(name: string): void {
  if (PERSONAL_MODULES.has(name.split(":")[0]) && name !== "builds:setGroupId") {
    const error = new PublishedReadOnlyError();
    if (typeof window !== "undefined") window.alert(error.message);
    throw error;
  }
}
