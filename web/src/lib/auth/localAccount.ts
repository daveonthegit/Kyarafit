const KEY = "kyarafit:last-signed-in-account";
const EVENT = "kyarafit:local-account";

export function readLocalAccount(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function rememberLocalAccount(subject: string | null): void {
  if (subject === readLocalAccount()) return;
  if (subject) window.localStorage.setItem(KEY, subject);
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeLocalAccount(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === KEY || event.key === null)) {
      listener();
    }
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function subscribeConnectivity(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export const readOnline = () => navigator.onLine !== false;
