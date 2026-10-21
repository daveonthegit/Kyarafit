import { appleAppSiteAssociation, associationResponse } from "@/lib/appLinks";

// Read at request time so each deployment serves its own configured app identity.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return associationResponse(appleAppSiteAssociation(process.env));
}
