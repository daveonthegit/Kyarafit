// Stub: auth not implemented in minimal baseline.
export const signIn = { email: async () => ({ error: null }) };
export const signUp = { email: async () => ({ error: null }) };
export const signOut = async () => {};
export function useSession() {
  return { data: null, isPending: false };
}
export async function getSession() {
  return null;
}
