import type { ImportIdentity, ImportIdentityStore } from "./dataPortability";
import { importKey } from "./importKey";
import { offlineRuntime } from "./offline/runtime";

export function createImportIdentityStore(subject: string): ImportIdentityStore {
  const store = offlineRuntime.getStore();
  const assertCurrent = offlineRuntime.sessionGuard();
  const check = () => {
    assertCurrent();
    if (offlineRuntime.getSubject() !== subject) throw new Error("Local account changed");
  };
  return {
    async read(collection, sourceId) {
      check();
      const raw = await store.getMeta(`${importKey(subject, collection, { id: sourceId })}:identity`);
      check();
      if (raw === null) return null;
      const value = JSON.parse(raw) as ImportIdentity;
      if (
        !value || typeof value.id !== "string" || !value.id ||
        typeof value.complete !== "boolean" || !value.row || value.row.id !== sourceId
      ) {
        throw new Error("Invalid saved import identity");
      }
      return value;
    },
    async write(collection, sourceId, identity) {
      check();
      await store.setMeta(
        `${importKey(subject, collection, { id: sourceId })}:identity`,
        JSON.stringify(identity)
      );
      check();
    },
  };
}
