import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { getStoredLocale } from "../i18n/locale";

export const RESTORE_SESSION_KEY = "restore:session:v1";

export class RestoreInProgressError extends Error {
  constructor() {
    super((getStoredLocale() === "es" ? es : en).DataPortability.restoreReadOnly);
    this.name = "RestoreInProgressError";
  }
}
