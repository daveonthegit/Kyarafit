import type { LocalStore } from "./localStore";

export async function adoptLegacyStore(
  legacy: LocalStore,
  destination: LocalStore,
  subject: string,
  source: string
): Promise<void> {
  const marker = `legacy-adopted:${source}`;
  if (await destination.getMeta(marker)) return;
  const rows = await legacy.listEntityRows();
  const owned = rows.filter((row) => row.userId === subject);
  const owners = new Map<string, Set<string>>();
  for (const row of rows) {
    const accounts = owners.get(row.id) ?? new Set<string>();
    accounts.add(row.userId);
    owners.set(row.id, accounts);
  }
  const existing = new Set(
    (await destination.listEntityRows()).map((row) => `${row.table}\0${row.id}`)
  );
  for (const row of owned) {
    if (!existing.has(`${row.table}\0${row.id}`)) await destination.putEntityRow(row);
  }
  const ownedIds = new Set(owned.map((row) => row.id));
  const queue = await legacy.listPendingMutations(Number.MAX_SAFE_INTEGER);
  for (const mutation of queue) {
    let args: unknown;
    try {
      args = JSON.parse(mutation.args_json);
    } catch {
      continue;
    }
    if (!args || typeof args !== "object" || Array.isArray(args)) continue;
    const input = args as Record<string, unknown>;
    const actor = input.userId;
    const targets = typeof input.id === "string" ? [input.id] : input.ids;
    const ownsTargets =
      Array.isArray(targets) &&
      targets.length > 0 &&
      targets.every(
        (id) =>
          typeof id === "string" && owners.get(id)?.size === 1 && owners.get(id)?.has(subject)
      );
    let hasForeignReference = false;
    const visit = (value: unknown): void => {
      if (typeof value === "string") {
        const accounts = owners.get(value);
        if (accounts && [...accounts].some((owner) => owner !== subject)) hasForeignReference = true;
      } else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(args);
    visit(mutation.client_id);
    if (hasForeignReference || (actor !== undefined ? actor !== subject : !ownsTargets)) continue;
    await destination.commitCommand(
      {
        fn: mutation.fn,
        argsJson: mutation.args_json,
        idempotencyKey: mutation.idempotency_key,
        clientId: mutation.client_id,
      },
      []
    );
    if (mutation.client_id) ownedIds.add(mutation.client_id);
  }
  const mappings = await legacy.loadIdMap();
  const existingMappings = await destination.loadIdMap();
  for (const [clientId, serverId] of Object.entries(mappings)) {
    if (ownedIds.has(clientId) && !existingMappings[clientId]) {
      await destination.setServerId(clientId, serverId);
    }
  }
  await destination.setMeta(marker, "1");
}
