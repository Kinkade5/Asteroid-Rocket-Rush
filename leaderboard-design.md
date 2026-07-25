# Global Leaderboard — Design (v0.24.0)

Decided 2026-07-09 with Brent. First feature that adds a backend to the
otherwise pure-static, offline-first PWA.

## Decisions

- **Global leaderboard**, not personal cross-device sync. Players see each
  other's top scores; no accounts, no login.
- **One board per difficulty tier** (beginner/intermediate/expert/master) —
  scores aren't comparable across tiers (same reason `bestScoreByTier` is
  already split).
- **Each row shows BOTH points and rounds** (score + asteroids passed).
  Ranked by **points** (primary); rounds shown as a second column. A
  Points⇄Rounds sort toggle is an easy future add if wanted.
- **Anonymous name entry** (arcade style, 3–12 chars), saved to localStorage
  and reused. No auth.
- **Name rules (added after playtest, same release)**: charset allowlist
  `A-Z 0-9 space hyphen`, uppercase enforced server-side, 3–12 chars, and a
  server-side profanity blocklist. Matching runs on NORMALIZED forms —
  leetspeak digits mapped to letters (0→O, 1→I, 3→E, 4→A, 5→S, 7→T, 8→B…),
  separators stripped, repeated letters collapsed — so `F U C K`, `FUUUCK`,
  and `SH1T` all match. Scunthorpe-prone short words (ASS, SEX, ANAL, SPIC,
  COON, RAPE, ARSE, ANUS…) are EXACT-match only so BASS/ESSEX/CANAL/SPICY/
  RACCOON/GRAPE/PARSER/URANUS survive. Rejection is transparent: server 422
  `bad name` → client shows "try a different name" and reopens the entry
  row; the name is only persisted client-side once the server accepts it.
  Client mirrors charset/length for instant feedback; the blocklist lives
  server-side only (single source of truth). 45-case unit test covered
  evasions + false-positive guards at build time.
- **Backend: Netlify Blobs + Functions** — stays in the existing Netlify
  project. One serverless function + a Blobs KV store.
- **Offline-graceful**: no network → game plays exactly as today; the board
  just shows "couldn't load."

## Backend

`netlify/functions/leaderboard.js` (Functions v2 API):

- `GET  /.netlify/functions/leaderboard?tier=<tier>` → `{ tier, entries }`
- `POST /.netlify/functions/leaderboard` `{ tier, name, score, asteroids }`
  → `{ tier, rank, entries }` (`rank` 1-based, or `null` if it missed Top N)

Storage: Netlify Blobs store `leaderboard`, one JSON array per tier key.
Each entry `{ name, score, asteroids, ts }`. Kept sorted by score desc
(tie-break asteroids desc), truncated to **Top 100**.

Read-modify-write on POST — low-traffic hobby board, so a rare lost update
under concurrent writes is acceptable; can harden with etag compare-and-set
later.

### Anti-cheat (intentionally light)

Client-submitted web scores are **always spoofable** by a determined user.
The server only rejects lazy garbage:

- integer, non-negative
- `score ≤ 100,000,000`, `asteroids ≤ 100,000`
- ratio gate: `score ≤ asteroids × 8000 + 10000` (generous — maxed
  multipliers score a lot per pair, so only the clearly-impossible is cut)

Not tamper-proof. Fine for a friends/small-audience board.

## Client (index.html)

- **LEADERBOARD 🏆 button** on the main menu → overlay.
- Overlay: tier selector (reuse difficulty palette) + Top-100 list, columns
  **RANK · NAME · POINTS · ROUNDS**, the player's own row highlighted.
- **Name entry**: first qualifying submission prompts for a name (saved as
  `rocketRushPlayerName`), reused after.
- **Submit on game over** when the run makes the board; game-over shows a
  "🏆 Rank #N" line (reuse the star-earned line pattern).
- Fetch failures fail quietly (spinner → "couldn't load, tap to retry").

## Save data (localStorage) — new keys

| Key | Type | Purpose |
|---|---|---|
| `rocketRushPlayerName` | string | reused leaderboard name |

## Build / deploy impact

- Adds `package.json` (`@netlify/blobs` dep) + `netlify.toml`. Netlify now
  runs `npm install` on deploy. **The game itself stays build-free** — only
  the function has a dependency.
- Blobs works automatically on Netlify deploys (free tier, no add-on).

## Testing

`http-server` (our current local preview) can't run the function. Options:
1. **`netlify dev`** — runs functions + a local Blobs sandbox. Needs
   `netlify-cli` + `netlify link`.
2. **Branch-deploy preview URL** — push the branch, test on Netlify's
   preview deploy against real Blobs.

(Open: which testing path Brent prefers.)

## Ship

- Own release: **v0.24.0**. Rocket skins bump to **v0.25.0**.
