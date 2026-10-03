/** Stable account-local retry identity; server-side session/operation scoping remains authoritative. */
export function importKey(userId: string, collection: string, row: { id: string }): string {
  return `import:v2:${JSON.stringify([userId, collection, row.id])}`;
}
