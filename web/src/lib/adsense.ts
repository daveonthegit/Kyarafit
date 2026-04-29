export const KYARAFIT_ADSENSE_CLIENT = "ca-pub-8056052475009755";
export const KYARAFIT_ADSENSE_SIDEBAR_SLOT = "6551071878";

export function getAdsenseClient(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim() || KYARAFIT_ADSENSE_CLIENT;
}

export function getAdsenseSidebarSlot(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT?.trim() || KYARAFIT_ADSENSE_SIDEBAR_SLOT
  );
}
