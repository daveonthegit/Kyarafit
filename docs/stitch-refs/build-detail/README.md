# Stitch reference — Unified Editorial Build Detail

- **Project ID:** `4723828042438665807`
- **Screen ID:** `7d30c8b4d9124e4fa8f9d07943592d5c`

## Download reference HTML + PNG

1. Set `STITCH_API_KEY` in your environment (do not commit).
2. From the repo root:

```bash
node scripts/fetch-stitch-screen.mjs
```

This writes `reference.html` and `reference.png` next to this README.

If you cannot use the API, place your own exports here as `reference.html` / `reference.png` for local design comparison.

These files are **not** loaded by the app at runtime; they are design references only.
