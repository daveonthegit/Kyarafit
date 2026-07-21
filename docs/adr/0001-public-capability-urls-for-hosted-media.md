# Hosted media is served via public capability URLs, never signed URLs

Hosted media (published feed/group images, public build pages, collab-shared media, avatars) lives
in a public-read Cloudflare R2 bucket behind a Kyarafit media domain, with unguessable random UUIDs
in every object key. Access control is possession of the URL: Convex authorizes *discovery* (only a
collaborator/member can query the row that contains the URL), but anyone holding the URL can fetch
the bytes. We deliberately rejected per-view signed URLs: minting one per image render would burn
Convex function calls on every feed page (~30 images/page against a 1M/month free budget), and the
unique query strings would defeat Cloudflare edge caching — the zero-egress, CDN-cached serving
path is the economic foundation of hosting social media for free. Consequences: revocation =
delete the R2 object + purge the CDN cache (moderation/takedown must do both); leaked URLs remain
fetchable until then; upload UI copy should note that shared/published photos are
link-accessible. The URL shape gets baked into stored rows and client caches, so reversing this
later means a full media migration.
