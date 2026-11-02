import type { VaultReader, VaultWriter } from "./store";

/** Context handed to a local personal-data query (the vault's committed read view). */
export type LocalQueryCtx = { db: VaultReader; userId: string; now: number };
/** Context handed to a local personal-data command (a staged, transactional write view). */
export type LocalMutationCtx = { db: VaultWriter; userId: string; now: number };
export type LocalQueryHandler = (ctx: LocalQueryCtx, args: Record<string, unknown>) => unknown;
export type LocalMutationHandler = (
  ctx: LocalMutationCtx,
  args: Record<string, unknown>
) => unknown;
