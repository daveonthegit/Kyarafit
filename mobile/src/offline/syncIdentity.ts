import { getActiveVault } from "@/vault/activeVault";
import { getBearerToken, subscribeBearerToken } from "@/lib/auth/bearer-storage-plugin";
import { authClient } from "@/lib/auth/client";
import { getIsOnline } from "./connectivity";

let generation = 0;
subscribeBearerToken(() => {
  generation += 1;
});

export function invalidateSyncSession(): void {
  generation += 1;
}

export async function syncScope() {
  const vault = getActiveVault();
  const token = getBearerToken();
  const started = generation;
  let subject: string | undefined;
  if (vault && token && getIsOnline()) {
    try {
      const session = await authClient.getSession({ query: { disableCookieCache: true } });
      if (!session.error) subject = session.data?.user.id;
    } catch {
      subject = undefined;
    }
  }
  const current = () =>
    Boolean(
      getIsOnline() &&
        vault &&
        token &&
        subject === vault.subject &&
        getActiveVault() === vault &&
        getBearerToken() === token &&
        generation === started
    );
  const assertCurrent = () => {
    if (!current()) throw new Error("Sync account changed");
  };
  return { current, assertCurrent };
}
