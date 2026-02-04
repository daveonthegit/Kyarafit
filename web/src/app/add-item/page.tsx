'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect to the canonical new-item flow (parity with mobile single add-item screen).
 */
export default function AddItemRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/closet/new');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[12px] text-kyar-textTertiary">Redirecting…</p>
    </div>
  );
}
