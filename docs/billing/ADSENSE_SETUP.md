# Google AdSense setup

Kyarafit web Free-tier ads are implemented as a slim right-side AdSense display unit in the app shell. Pro and Studio users do not see ads.

AdSense is for the web app only. Native iOS and Android ads should use AdMob in a separate integration.

## Google setup

1. Sign in to Google AdSense.
2. Add the Kyarafit web domain on the AdSense Sites page and wait until the site is approved.
3. Go to Ads, then By ad unit, then Display ads.
4. Create a responsive display ad unit named something like `Kyarafit web sidebar`.
5. Copy the ad slot ID from the generated ad unit code.

Google’s docs describe the [global AdSense code](https://support.google.com/adsense/answer/9274634) as the snippet placed on pages to enable AdSense features, and [display ad units](https://support.google.com/adsense/answer/9274025) as responsive placements that adapt to the page layout.

## App configuration

The AdSense client defaults to `ca-pub-8056052475009755`, matching `web/public/ads.txt`. The sidebar display ad slot defaults to `6551071878`.

No AdSense environment variables are required for production if you are using the default Kyarafit publisher and sidebar unit.

Optional overrides for staging/testing:

```bash
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-8056052475009755
NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT=0000000000
```

Restart the web server after adding or changing these values.

## Placement rules

- Keep the ad in the sidebar rail only.
- Keep the `Sponsored` and `Ad` labels visible.
- Do not use pop-ups, interstitials, or content-mimicking placements.
- Do not refresh ads automatically.
- Do not try to bypass ad blockers or hide that an ad is an ad.

Review Google’s [AdSense ad placement policies](https://support.google.com/adsense/answer/1346295) before adding more surfaces.

If the AdSense script is blocked, the site should continue working normally. If Google returns no fill, the ad unit is hidden by AdSense’s `data-ad-status="unfilled"` state.

## If ads are verified but not filling

- Confirm the deployed app includes the ad slot `6551071878`, not just `ads.txt`.
- Check on a desktop viewport while signed in as a Free user. The web sidebar rail is hidden on smaller mobile/tablet widths, and Pro/Studio users do not see ads.
- AdSense may return no fill while the new site or new ad unit warms up.
- Because Kyarafit app pages are login-protected, configure AdSense crawler access for authenticated pages in AdSense: Account → Access and authorization → Crawler access.
- `web/public/robots.txt` explicitly allows `Mediapartners-Google` and `Google-Display-Ads-Bot`.
