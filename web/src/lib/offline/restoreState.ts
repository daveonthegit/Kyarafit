import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { getStoredLocale } from "../i18n/locale";

export const RESTORE_SESSION_KEY = "restore:session:v1";

const PERSONAL_TABLES = new Set([
  "builds",
  "cosplayNodes",
  "buildTasks",
  "workflowItems",
  "workflowAttachments",
  "workflowDependencies",
  "conventions",
  "conventionDayPlans",
  "packingListItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
]);

export function isPersonalTable(table: string): boolean {
  return PERSONAL_TABLES.has(table);
}

export interface EntityWriteOptions {
  restore?: boolean;
}

export class RestoreInProgressError extends Error {
  constructor() {
    super((getStoredLocale() === "es" ? es : en).DataPortability.restoreReadOnly);
    this.name = "RestoreInProgressError";
  }
}
