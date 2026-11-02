import { Alert } from "react-native";
import { VaultWriteError } from "@/vault/store";

/**
 * Show an error alert for a failed action — except a failed local save, which
 * `VaultWriteErrorAlerts` already reported once app-wide (avoids a double alert).
 */
export function alertUnlessReported(title: string, error: unknown): void {
  if (error instanceof VaultWriteError) return;
  Alert.alert(title, error instanceof Error ? error.message : String(error));
}
