# Web restore — PR body notes

- An incomplete restore makes this browser's vault read-only for personal planner data until the restore completes or is undone. Undo deletes the session's recorded rows and unlocks normal editing.
- Edits made on another device during an incomplete restore are not blocked. Undo can cascade into those edits; cross-device isolation is a follow-up.
- A server create that commits just before the browser closes, before its destination ID is recorded, is not visible to Undo. The vault remains non-empty and the user must remove that row through the normal UI. Closing this window requires backend work outside this slice.
- Merge-restore into a non-empty vault and resumable restore are later features. Restore currently requires an internet connection and an empty vault.
