"use client";

import { useEffect, useId } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type GoogleAdsenseUnitProps = {
  client: string;
  slot: string;
  className?: string;
  layoutKey?: string;
};

export function GoogleAdsenseUnit({ client, slot, className, layoutKey }: GoogleAdsenseUnitProps) {
  const generatedId = useId();
  const unitKey = layoutKey ?? `${client}:${slot}:${generatedId}`;

  useEffect(() => {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense can be unavailable during review, no-fill, or when users block ads.
    }
  }, [unitKey]);

  return (
    <ins
      key={unitKey}
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
