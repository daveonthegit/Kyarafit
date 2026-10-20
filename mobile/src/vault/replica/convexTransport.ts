import { ConvexError } from "convex/values";
import { api } from "convex/_generated/api";
import {
  REPLICA_PROTOCOL_VERSION,
  type ReplicaErrorData,
  type ReplicaPullResult,
  type ReplicaPushResult,
} from "@kyarafit/design-system/domain/replicaProtocol";
import {
  ReplicaAuthError,
  ReplicaEntitlementError,
  ReplicaOfflineError,
  type ReplicaTransport,
} from "./replicator";

/** The calls the transport needs (`ConvexReactClient` or `ConvexHttpClient`). */
export interface ReplicaConvexClient {
  mutation(reference: unknown, args: unknown): Promise<unknown>;
  query(reference: unknown, args: unknown): Promise<unknown>;
}

/** A request that has not answered by now is treated as offline (the client queues while offline). */
const REQUEST_TIMEOUT_MS = 30_000;

/** Map a server failure onto the replicator's states; anything unrecognized is a server error. */
export function classifyReplicaError(error: unknown): unknown {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<ReplicaErrorData> | undefined;
    if (data?.code === "unauthorized") return new ReplicaAuthError(data.message);
    if (data?.code === "not-entitled") return new ReplicaEntitlementError(data.message);
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    /Unauthorized|Unauthenticated|not authenticated|InvalidAuthHeader|Could not (verify|validate|decode|parse)/i.test(
      message
    )
  )
    return new ReplicaAuthError(message);
  if (/Network request failed|Failed to fetch|fetch failed|ECONNREFUSED|timed out/i.test(message))
    return new ReplicaOfflineError(message);
  return error;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ReplicaOfflineError("Sync timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface ConvexReplicaTransportOptions {
  /** The vault's account; the server refuses a session for any other account. */
  subject: string;
  isOnline?: () => boolean;
  timeoutMs?: number;
}

export function convexReplicaTransport(
  client: ReplicaConvexClient,
  { subject, isOnline = () => true, timeoutMs = REQUEST_TIMEOUT_MS }: ConvexReplicaTransportOptions
): ReplicaTransport {
  const protocol = REPLICA_PROTOCOL_VERSION;
  const call = async <T>(run: () => Promise<unknown>): Promise<T> => {
    if (!isOnline()) throw new ReplicaOfflineError();
    try {
      return (await withTimeout(run(), timeoutMs)) as T;
    } catch (error) {
      throw classifyReplicaError(error);
    }
  };
  return {
    push: (deviceId, ops) =>
      call<ReplicaPushResult>(() =>
        client.mutation(api.replica.push, { protocol, subject, deviceId, ops })
      ),
    pull: (after, limit) =>
      call<ReplicaPullResult>(() =>
        client.query(api.replica.pull, { protocol, subject, after, limit })
      ),
    dismissConflicts: async (ids) => {
      await call(() => client.mutation(api.replica.dismissConflicts, { protocol, subject, ids }));
    },
  };
}

/**
 * The same client with every call bounded by a timeout, for sync follow-up work (photo bytes,
 * publication removals): the Convex client otherwise waits indefinitely while offline, which would
 * hold up the next sync pass.
 */
export function timedConvexClient(
  client: ReplicaConvexClient,
  timeoutMs = REQUEST_TIMEOUT_MS
): ReplicaConvexClient {
  return {
    mutation: (reference, args) => withTimeout(client.mutation(reference, args), timeoutMs),
    query: (reference, args) => withTimeout(client.query(reference, args), timeoutMs),
  };
}
