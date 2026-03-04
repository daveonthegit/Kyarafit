/**
 * Polyfill global `crypto` for React Native (Expo). RN does not provide the Web Crypto API;
 * expo-crypto provides randomUUID and getRandomBytes. This must be imported before any code
 * that uses crypto.randomUUID() or crypto.getRandomValues().
 */
import * as ExpoCrypto from "expo-crypto";

const g: typeof globalThis =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof global !== "undefined"
      ? (global as typeof globalThis)
      : ({} as typeof globalThis);

if (typeof (g as unknown as { crypto?: unknown }).crypto === "undefined") {
  (g as unknown as { crypto: Crypto }).crypto = {
    randomUUID: (): `${string}-${string}-${string}-${string}-${string}` =>
      ExpoCrypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array == null) return array;
      const byteLength = array.byteLength;
      const bytes = ExpoCrypto.getRandomBytes(byteLength);
      if (bytes.length !== byteLength) throw new RangeError("getRandomBytes length mismatch");
      new Uint8Array(array.buffer, array.byteOffset, byteLength).set(bytes);
      return array;
    },
  } as Crypto;
}
