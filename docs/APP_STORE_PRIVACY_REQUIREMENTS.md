# App Store Privacy Requirements

This checklist is the release gate for App Store privacy readiness.

## Allowed data collection

- Account identifiers required for authentication
- User-created cosplay content required for closet, build, and planning features
- Images explicitly selected by the user for upload
- Device-local cache data required for offline support or signed-in persistence
- Minimal billing metadata required for subscriptions if that feature is enabled

## Data collection to avoid

- Precise location collection
- Contacts, address book, or social graph imports from the device
- Health, fitness, or medical data
- Advertising identifiers
- Third-party ad SDKs
- Cross-app tracking
- Background collection of photos, files, or sensor data

## Permission rules

- Photo-library permission must be requested only when the user explicitly chooses to add or edit an image
- The app must not request contacts, microphone, Bluetooth, motion, camera, or location permissions unless a reviewed product change makes them necessary
- Permission copy must explain the actual feature purpose in plain language

## Current App Store privacy mapping

Likely collected and linked to the user:

- Email address and account/profile identifiers
- User content such as closet items, builds, plans, notes, and uploaded images
- Coarse purchase or subscription metadata if billing launches

Not collected:

- Precise location
- Contacts
- Browsing history
- Health and fitness data
- Financial account data
- Advertising identifiers
- Cross-app tracking data

## Release checklist

- Privacy Policy is publicly reachable and linked from inside the app
- In-app delete-account flow works on supported signed-in platforms
- Delete-account flow removes cloud account data and clears signed-in local cache
- App Store privacy answers are reviewed against current code and SDKs
- Mobile permission prompts match actual runtime behavior
- No undisclosed processors or SDKs have been added
- Signup and account settings both expose privacy-policy access
