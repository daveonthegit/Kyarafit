import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The last account that signed in on this device and has not signed out — the durable local
 * identity that keeps the planner usable offline across restarts and token expiry.
 *
 * This is display metadata plus the subject that names the account's vault, never a credential:
 * remote credentials stay in SecureStore (`bearer-storage-plugin`) and every server call still
 * presents and validates them. Offline, the app trusts this record only to decide WHICH local vault
 * to unlock; it grants no server access.
 */
export interface VaultAccount {
  /** Better Auth user id == Convex identity `subject` (the JWT `sub`). */
  subject: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** Last time the server confirmed this session (ms epoch). */
  lastVerifiedAt: number;
}

const ACTIVE_ACCOUNT_KEY = "kyarafit.vault.activeAccount.v1";

function isVaultAccount(value: unknown): value is VaultAccount {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.subject === "string" &&
    record.subject.length > 0 &&
    typeof record.lastVerifiedAt === "number"
  );
}

export async function loadActiveAccount(): Promise<VaultAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isVaultAccount(parsed) ? parsed : null;
  } catch (error) {
    console.warn("[vault] could not read the active account", error);
    return null;
  }
}

export async function saveActiveAccount(account: VaultAccount): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(account));
}

export async function clearActiveAccount(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}
