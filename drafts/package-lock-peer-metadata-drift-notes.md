# Draft: package-lock.json peer-metadata drift

**Status:** DRAFT — not applied to the codebase. Hand-off for another agent/engineer.

## What this is

A pending `package-lock.json` change detected in the working tree on 2026-07-31.
The change re-resolves lockfile metadata: it adds `"peer": true` to ~15 package
entries, drops `@emnapi/core` / `@emnapi/runtime` blocks, and flips `fsevents` to
`dev: true`.

It is **not committed to `package-lock.json`** — the codebase is left untouched.
It has been captured as a standalone patch so someone can review/apply it
deliberately.

## Files

- `package-lock-peer-metadata-drift.patch` — full unified diff (apply with
  `git apply drafts/package-lock-peer-metadata-drift.patch`)
- `package-lock-peer-metadata-drift-notes.md` — this file

## Why it exists

The drift was noticed in the working tree. Per request, it was parked in draft
form instead of being applied directly, so it can be handed off for review.

## How to use

1. Review the patch.
2. If you want it in the codebase, apply and regenerate:
   ```
   git apply drafts/package-lock-peer-metadata-drift.patch
   npm install  # or npm ci
   ```
3. Or apply, resolve the peer/optional metadata decision, and commit normally.

## Open questions for the next person

- Was this drift produced by a different npm version (npm v10/11 peer dedupe)?
- Are `@emnapi/core` / `@emnapi/runtime` needed? They dropped out of the lockfile.
- Should `fsevents` be `dev` or `devOptional`?
