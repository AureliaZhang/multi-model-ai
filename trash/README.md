# trash — archived (not deleted)

Moved here during cleanup against `framework.md` **v0.7.0** (2026-07-11).

## Rules
- Files here are **obsolete or superseded**, not removed from the repo history of the working tree intentionally.
- Do **not** delete these without product owner approval.
- Active product SSOT remains `../framework.md`.

## folders
- `screenshots/` — old UI check/screenshot PNGs; not imported by the app.
- `plans-superseded/` — early plan markdowns largely implemented or superseded by framework sections (Arena §10.5–10.6, roadmap).
- `build-artifacts/` — local compiler caches (e.g. `tsconfig.tsbuildinfo`).

## Restore
```bash
mv trash/screenshots/<file> ./
# or
mv trash/plans-superseded/<file> plans/
```
