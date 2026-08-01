# Rocket Rush

Flappy-style web game: dodge asteroid pairs, collect coins, grab powerups.
Mobile-first, PWA-enabled. Currently at v0.36.0.
Shipping on Google Play as a TWA (`com.astralgamer.rocketrush`) — in closed testing.

Architecture note (v0.24.0): no longer purely single-file — the global
leaderboard added `netlify/functions/leaderboard.js` (Netlify Blobs store,
per-tier Top 100, name charset allowlist + normalized profanity blocklist),
plus `package.json` (@netlify/blobs) and `netlify.toml`. The game itself
(index.html) is still build-free. Leaderboard fails soft offline. Spec:
`leaderboard-design.md`. Function can't run under plain http-server — test
via Netlify deploy previews (branch PRs) or `netlify dev`.

Live: https://asteroidrocketrush.netlify.app

## Architecture

Single-file game. No build step, no framework.

- **`index.html`** — HTML + `<style>` + `<script>` all inline. ~5185 lines. The entire game.
- **`sw.js`** — Service worker. `CACHE_NAME` must bump on every release.
- **`manifest.json`** — PWA manifest. Rarely changes.

Deploys via GitHub → Netlify on push to main.

## Conventions

- **Comments explain the *why*** — balance reasoning, migration notes, version history. Don't strip them. When changing a block, add a version-tagged comment describing the reason.
- **Shape-preserving save migrations** — `loadUpgrades()` merges defaults with stored data. Adding a new upgrade = new key in `DEFAULT_UPGRADES`, existing saves auto-adopt tier 0. When *renaming* a key, add targeted migration to copy old → new and delete old.
- **Named tier progressions** — upgrade labels like "Stock → Turbo Injectors → Afterburners → Overdrive Reactor" instead of "T0/T1/T2/T3".
- **Hidden-via-flag for dormant features** — `MASTER_SHOP_AVAILABLE = false` keeps Phase 4 scaffolding in main codebase without exposing it to players.

## Release checklist

For every version bump X.Y.Z:

1. Bump 3 version strings:
   - `<div class="version-badge" id="versionBadge">vX.Y.Z</div>` in HTML
   - `const GAME_VERSION = 'vX.Y.Z';` in JS
   - `const CACHE_NAME = 'rocket-rush-vX.Y.Z';` in sw.js
2. Make code changes.
3. Syntax-check: extract the `<script>` block, run `node --check`.
4. Grep for stale version strings before shipping.
5. Add a version-tagged comment on any block you modified explaining the change.

## Key structures

Inside `index.html`:

- `DIFFICULTIES` — Beginner, Intermediate, Expert, Master (last is locked).
- `UPGRADE_DEFS` + `TIER_VALUES` — 14 shop upgrades, 5 categories (Shield / Magnet / Multiplier / Hangar / Hyperfocus). Max tier 3.
- `MASTER_UPGRADE_DEFS` — NG+ capstones (Stars currency). Gated behind `MASTER_SHOP_AVAILABLE = false` until Phase 4.
- `Audio` module (IIFE) — localStorage-backed. Exposes `Audio.play.coinGold()` etc.
- `Accessibility` module (IIFE) — Reduce Motion. Exposes `shakeScale()`, `flashScale()`, `particleScale()`, `sweepScale()`.
- Game loop — `update(dt)` for logic, `render(dt)` for canvas draws. Separate raw dt (rocket physics) from `sdt` (world scroll, which Hyperfocus scales).

## Save data (localStorage)

| Key | Type |
|---|---|
| `rocketRushUpgrades` | Upgrade tiers object |
| `rocketRushMasterUpgrades` | NG+ capstone booleans |
| `rocketRushBankedCoins` | Integer wallet |
| `rocketRushStars` | Integer Stars (note: NOT `rocketRushBankedStars` — this table said so until v0.35.0 and it was wrong) |
| `rocketRushLifetimeCoins` | Monotonic total |
| `rocketRushDifficulty` | Selected tier id |
| `rocketRushAudioSettings` | Music/SFX flags |
| `rocketRushAccessibility` | Reduce Motion flag |
| `rocketRushShopMaxedSeen` | One-shot celebration flag |
| `rocketRushUpgradeAffordableSeen` | Per-upgrade NEW! badge state |
| `rocketRushMasterUnlockSeen` | Master difficulty unlock toast flag |
| `rocketRushMasterEnabled` | v0.30.0 — per-capstone on/off (owned ≠ active) |
| `rocketRushPowerupFilters` | v0.30.0 — per-type powerup spawn allowlist |
| `rocketRushFilterUnlocked` | v0.32.0 — per-type filter switch bought with ✦ |
| `rocketRushMasterMilestoneIdx` | v0.33.0 — highest Master ✦ milestone already paid |
| `rocketRushMasterUpgrades.master_assist` | v0.35.0 — Master Assist tier 0-3 (integer, unlike the sibling capstone booleans) |
| `rocketRushTutorialRewarded` | v0.36.0 — one-shot flag; tutorial completion bonus pays once ever |

## Recent history (v0.18.0 → v0.29.0)

1. **v0.18.0**: Rebuilt "Deflection Field" (repulsion) into "Guidance System" (gap centering).
2. **v0.19.0**: Added velocity damping to fix oscillation.
3. **v0.20.0**: Tuning pass + Full Autopilot capstone in Master Shop (dormant until Phase 4).
4. **v0.20.1**: Guidance damping + deadzone tuning ("erratic feel" fix).
5. **v0.21.0**: Silver coins middle tier (bronze/silver/gold economy) + Guidance strength tap-down.
6. **v0.21.1**: Pre-launch 3-2-1-GO countdown on every run start and retry (`STATE.COUNTDOWN`).
7. **v0.22.0–v0.25.0**: Phase 4 (NG+) — see the Phase 4 section above.
8. **v0.25.1**: Leaderboard — mobile Enter-key submission.
9. **v0.25.2**: Leaderboard root-cause fix — submissions were gated on all-time
   local best instead of best-*submitted* (`rocketRushBestSubmittedByTier`).
   Unlocking Master requires a 5000+ Expert score, so every progressed player
   had an Expert local best their normal runs couldn't beat — silently blocking
   the entire Expert board.
10. **v0.26.0–v0.28.0**: Play Store Phases A–C — see the TWA section above.
11. **v0.28.1**: Background-audio fix (first closed-testing bug report) — music
    kept playing after the app was backgrounded or closed. Nothing touched the
    audio graph on hide: the sequencer kept queueing beats, ~500ms of notes were
    already scheduled on the audio clock, and the persistent thrust oscillator
    is stopped by `syncThrustSound()` from the update loop, which is frozen
    while hidden. Fix is `Audio.suspendAll()` / `Audio.wake()` on
    `visibilitychange` + `pagehide`/`pageshow` — suspending the AudioContext is
    the only thing that silences already-queued notes. Deliberately
    state-independent: the old auto-pause only fired from `STATE.PLAY`, so
    backgrounding from the menu left music running.
12. **v0.28.2**: Eager music start (second closed-testing report — "music
    doesn't start until the screen is touched"). Chrome's autoplay policy
    exempts *installed* web apps (TWA/home-screen PWA) but the game never
    tried: `Audio.init()` only ran inside input handlers. Now attempts init on
    `load`; if the context comes up `running` (exemption applies) music starts
    immediately, if `suspended` (plain tab) the old first-gesture path takes
    over unchanged. Companion hardening: `tone()`/`noise()` bail while the
    clock is halted so pre-gesture/backgrounded SFX can't pile up and fire
    stale on resume — except when a `resume()` is in flight (`resumePending`),
    which keeps the first tap's own click SFX audible.
13. **v0.28.3**: Eager start, second attempt — tester still silent on launch.
    v0.28.2's probe was wrong: Chrome can create the context **suspended at
    load even where autoplay is permitted**, so state-at-creation proves
    nothing. `Audio.eagerStart()` calls `ctx.resume()` regardless: permitted →
    resolves immediately, music with no gesture; blocked → Chrome parks the
    promise until the first gesture, making it equivalent to the old
    behavior (`!musicRunning` prevents a double-start next to `wake()`).
    The parked resume deliberately does NOT set `resumePending`, and
    `begin()` re-checks `document.hidden` at resolve time so a late
    resolution can't start music over the launcher.
14. **v0.28.4**: TEMPORARY diagnostic (tester still silent after v0.28.3) —
    the version badge ticks `Audio.debugState()` every 500ms:
    `none|suspended|running` + `♪` when the sequencer is live. Answers, on
    real hardware, (a) is the update actually installed and (b) what Chrome
    decided about autoplay. Remove `debugState()` + the badge ticker once
    the launch-music mystery is closed.
15. **v0.28.5**: Global first-gesture audio unlock. The v0.28.4 badge gave
    the verdict: `suspended` at launch — Chrome genuinely blocks autoplay in
    the TWA on real hardware, so **launch music is a platform impossibility;
    music-on-first-touch is the design target.** But Brent observed the
    first tap NOT unlocking (needed a second tap on a specific control):
    `ensureAudio()` was wired per-widget (~14 call sites), a
    somebody-always-gets-missed pattern. Fix: document-level
    pointerdown/keydown listeners (capture phase — several buttons
    `stopPropagation()`) make every first gesture an audio unlock.
16. **v0.28.6**: Root cause of the two-tap bug — a **parked `resume()`** left
    over from a cold start consumed the first gesture without transitioning
    the context; only the second tap's fresh resume() actually unlocked.
    TWO eager-resume sources, both killed: (a) `eagerStart()` called
    `ctx.resume()` when suspended — now it only starts music if the context
    comes up already `running`; (b) — the sneaky one — the v0.28.1 `pageshow`
    handler called `wake()` (→ resume) on **every cold load**, because
    `pageshow` fires on first load too, not just bfcache restores. Now gated
    on `e.persisted`. Rule: **never call `resume()` outside a user gesture** —
    a parked resume is worse than no resume. Verified by counting `resume()`
    calls: 0 at load, exactly 1 on the first tap. Diagnostic badge still
    present; strip it + `debugState()` once Brent confirms one-tap on device.
17. **v0.28.7**: Removed the v0.28.4 diagnostic badge ticker + `debugState()`
    — device still needed two taps, so **the two-tap-to-start audio is
    accepted as a minor known issue** (music comes up on first interaction
    regardless; not worth more churn during the 14-day tester window). Kept
    all the substantive audio fixes underneath (v0.28.1 background suspend,
    v0.28.6 no-parked-resume hygiene). Badge back to a static version string.
    **If ever revisited**: the residual two-tap is a real-device Chrome
    resume() timing quirk that does NOT reproduce headless — the parked-resume
    theory (v0.28.6) was correct hygiene but didn't fully clear it on device;
    a genuine fix would need on-device debugging (re-add a state readout),
    not more armchair guessing.
18. **v0.29.0**: Respec — every upgrade card above Tier 0 grows a muted
    full-width `↩ REFUND +N` bar (N = 50% of all coins spent on that line,
    floored, per the line's own cost table). Two-step confirm: first tap
    arms it amber ("SURE? RESETS TO TIER 0") for 2.5s, second tap resets
    the line to T0 and banks the refund. Deliberately untouched:
    `lifetimeCoins` (monotonic), NEW!-badge seen state (monotonic max — no
    badge spam on rebuy), `shopMaxedSeen` (one-shot celebration stays
    consumed). Refunding Guidance below T3 leaves an owned Full Autopilot
    inert (strength multiplies a 0), not revoked. First of the three-part
    feature batch (respec → Master-shop toggles → platinum coins).
19. **v0.30.0**: Master-shop toggles, part 2 of the batch. Two independent
    switch systems, both defaulting ON so existing saves are unchanged:
    - **ACTIVE** section — per-capstone on/off for OWNED capstones
      (`rocketRushMasterEnabled`). Ownership is never revoked; this only
      gates the effect. All three effect sites now go through
      `isCapstoneActive(id)` (owned && enabled) instead of bare
      `masterUpgrades.x === true`, so a site can't miss the switch. Section
      is hidden until at least one capstone is owned.
    - **POWERUP SPAWNS** section — per-type spawn filters
      (`rocketRushPowerupFilters`). `spawnPowerup()`'s three inline
      threshold chains became explicit weight tables; filtered types drop to
      weight 0 and the survivors renormalize (relative ratios preserved).
      Spawns nothing when no type is eligible — including the subtle case of
      "only shield enabled while shield-capped" (weight 0). Filters do NOT
      disable the underlying shop upgrades.
    Verified with a parity harness that extracts both the old (git
    `origin/main`) and new `spawnPowerup` and samples 40k spawns each: with
    all filters on, distributions match within 0.5pp across all three shield
    states. Note the pre-existing single "variety reroll" flattens observed
    frequencies away from the raw weights — expected, unchanged.
20. **v0.31.0**: Platinum coins, part 3 of 3. A fourth coin tier (bronze <
    silver < gold < platinum) worth **2× gold**, unlocked by a new
    **Platinum Extraction** upgrade (`double.platinum`, MULTIPLIER
    category, own premium curve `PLATINUM_COSTS = [0,900,4000,14000]`).
    Tiers raise the per-pair spawn chance (`platinumChance
    [0,0.10,0.20,0.32]`), never the value — the payout stays a known
    quantity so the risk read at the moment of the dive doesn't shift.
    **Placement is the feature**: rolled independently of the in-gap coin,
    platinum spawns in the open corridor AFTER the pair (`x + width + 42`,
    mid-corridor even at the 140px minimum spacing) pinned to the top
    (y 34-54) or bottom (y 532-550) edge — never in the opening. The player
    must leave the safe gap-to-gap line and recover before the next pair;
    the bottom band is the greedy one since the floor kills outright.
    Widest glow (3.4×) + blue-white face + a 5-layer rising chime so the
    rarest coin reads and sounds distinct at the screen edge.
    Verified by extracting the real `spawnAsteroidPair`/`makeCoin` and
    simulating 6,000 pairs: T0 spawns zero, T3 measures 31.8% vs the 32%
    table, and platinum never lands inside its own or the next asteroid
    column, never in the mid-screen band, always clear of the floor.
21. **v0.32.0**: Powerup filters became a **paid** feature. They shipped free
    in v0.30.0, but they're stronger than they look: `spawnPowerup()`
    renormalizes after removing a type, so switching three off concentrates
    ~100% of spawns onto the fourth ("disable all but 2×" is a permanent
    buff). Two-stage economy per type — `FILTER_UNLOCK_STARS` (1✦, once,
    `rocketRushFilterUnlocked`) buys that type's switch, then
    `FILTER_TOGGLE_COST` (5,000 coins) is charged on **every** flip, both
    directions. Symmetric on purpose: free re-enabling would make it a
    rental and let players re-tune the spawn table between every run for
    nothing. Cards render two states (✦ buy button when locked → switch +
    running price line when unlocked), and the switch dims with an amber
    price when the wallet can't cover a flip, so a dead switch always
    explains itself. Capstone ACTIVE toggles stay free — those only gate
    something already paid for in ✦.
22. **v0.33.0**: Balance pass — one real bug plus two tuning changes.
    - **Master ✦ farm closed (the bug)**. `grantMasterMilestoneStars()` had
      no ledger, so *every* Master run ≥2,500 paid out again — 50 routine
      6,000-point runs granted **100✦** (measured against v0.32.0). That
      made every price in the Master shop meaningless. Milestones now pay
      **once ever**, tracked by `rocketRushMasterMilestoneIdx` (an index,
      not a set — milestones ascend, so clearing a high one implies the
      lower ones and a single int can't desync). Ladder deepened to
      `[2500, 5000, 10000, 20000, 35000, 50000, 75000]` = 7✦ lifetime, so
      Master stays the primary ✦ path per the NG+ design intent. Migration
      seeds the ledger from the player's best Master score: no clawback of
      banked ✦, but no retroactive windfall for milestones already paid.
      Note the v0.23.0 spec explicitly said "earned per run / no
      persistence needed" — **the spec was the bug**, not the code.
    - **Phoenix Cell no longer bounces**. It applied `vy = -4.5` (launch is
      only -2.5), punting the player upward — often straight into the
      asteroid above, i.e. a save that could immediately kill you. Now it
      zeroes velocity (a *catch*). Floor deaths can't use a positional lift
      alone: at `BASE_GRAVITY` 0.52 px/frame² a 30px lift is worth ~180ms
      (measured 176ms) and a usable 0.8s would need a ~600px drop, taller
      than the play area. So floor saves get `PHOENIX_FLOOR_GRACE_MS` (900ms)
      during which the floor is non-lethal — a Phoenix-only timer, NOT
      `shieldIFrameUntil`, since the floor is meant to kill through shields.
      Verified behaviorally: +913ms survival vs. +176ms before the fix.
    - **Platinum Extraction gated behind Multiplier T2** via a new generic
      `prereq` field on `UPGRADE_DEFS` + `upgradePrereqMet()` (mirrors
      `masterPrereqMet`). Inert for the other 13 lines. Gates *purchase*
      only — refunding the prereq later leaves an owned platinum working,
      matching how the Master-shop gate behaves.
    Held for after launch: **skill tree** (restructures the whole shop and
    every save's upgrade layout — wrong thing to ship mid-closed-test),
    plus tap-to-start and a Master assist upgrade.
23. **v0.34.0**: **Tap-to-start** — pulled off the held list above ahead of
    the skill tree, because it doesn't share that feature's reason for
    being held: no save migration, no economy change, no shop
    restructuring, so it's safe to ship mid-closed-test.
    - New `STATE.READY` sits between MENU/DEAD and COUNTDOWN. `startGame()`
      now lands there and stops; the player's own tap calls the new
      `beginCountdown()`, which holds everything from the 3-2-1 beat onward
      (including the launch burst). Why: LAUNCH and RETRY are *menu
      buttons*, so the countdown used to start while the finger was still
      travelling back to the play area — the beat was partly spent
      repositioning rather than preparing.
    - READY behaves as COUNTDOWN everywhere else. loop()'s trailing `else`
      already covers it (idle float, no physics/spawning), and it was added
      to `renderPowerupBadges` and `handleBackPress` alongside COUNTDOWN.
    - **Three input paths, not one.** `handlePointerDown` is not enough:
      `touchstart` fires ~50-100ms earlier on mobile and sets `touchHandled`,
      which makes the synthetic pointerdown bail — so on the game's primary
      platform `touchstart` is the *only* handler that sees the starting
      tap. Keyboard is the third. Missing the touch path would have shipped
      a gate that silently never opens on Android.
    - The start tap deliberately falls through to `thrusting = true` rather
      than returning, preserving the existing contract that holding through
      the countdown means thrust is live the instant PLAY begins.
    - `inputLockUntil` gets a 140ms bump on entering READY so the gesture
      that pressed LAUNCH/RETRY can't also satisfy the gate it just opened.
      Reuses the existing post-death lock both input paths already respect.
    - **Esc now abandons from READY/COUNTDOWN.** Esc claimed to "mirror the
      Android back button" but only handled PLAY/PAUSED. That was harmless
      while COUNTDOWN was transient (~2.2s); READY waits indefinitely, so a
      desktop player who pressed LAUNCH by mistake had no keyboard way out.
      `handleBackPress()` already did this — this makes Esc's claim true.
    - Verified in a real browser: gate holds in READY, the same-tick tap is
      swallowed by the input lock, a later tap runs 3→2→GO→PLAY, the
      `touchstart` path advances the gate, Esc abandons cleanly (prompt
      cleared, HUD hidden, menu restored) and the run is relaunchable.
      RETRY shares `startGame()` via `bindStart`, so it's covered by
      construction.
    - **Note for future local testing**: `sw.js` is cache-first and only
      invalidates on `CACHE_NAME`. Editing index.html without bumping it
      leaves the service worker serving the *old* file — this cost real
      debugging time here (a stale page made the gate look bypassed). Clear
      it with `navigator.serviceWorker.getRegistrations()` +
      `caches.keys()` deletes, or bump `CACHE_NAME` between test builds.
24. **v0.35.0**: **Master Assist** — the last item off the v0.33.0 held
    list. Shipped live (unlike the skill tree, which stays flag-off).
    - **The only tiered line in the Master shop.** Its siblings are
      single-purchase booleans; this is an integer 0-3 with an escalating
      ✦ price (`MASTER_ASSIST_COSTS = [0,2,4,7]`, 13✦ for the full line).
      That meant a second purchase handler
      (`attemptMasterAssistPurchase`), its own card builder borrowing the
      *coin* shop's pip + "current → next" vocabulary, and its own
      section label — grouping it under CAPSTONES would imply
      single-purchase.
    - **Cumulative stages**, each softening a different edge of Master:
      `Stabilizers` (gap ramp 2.0 → 1.55), `Bulwark Plating` (+1 starting
      shield, additive on top of Reinforced Hull), `Resupply Line`
      (powerups every 9 pairs instead of 13, matching Expert). `gapMin`
      is deliberately untouched — Assist buys time to reach the 85px
      wall, it never moves the wall.
    - **Why it exists**: Master is the primary ✦ income path but also the
      only tier starting at *zero* shields with the tightest gaps and
      sparsest powerups. The tier you must survive to afford capstones
      was the one giving no margin.
    - **`masterAssistTier()` is the single chokepoint** for the
      Master-tier-only rule, and every effect getter reads through it. A
      future effect site structurally *cannot* forget the check — the
      lesson from v0.30.0, where each capstone site had to remember the
      enabled-toggle until `isCapstoneActive()` centralised it.
    - **Cannot reopen the v0.33.0 ✦ farm**: milestones pay once ever, so
      an easier Master lets a player *reach* higher milestones, never
      re-earn old ones. Lifetime milestone ✦ stays 7.
    - Verified by a harness extracting the real `DIFFICULTIES`, tuning
      tables and accessors: 29 checks — cumulative tier effects, zero
      leakage into the other three tiers at any tier, the ACTIVE toggle
      restoring byte-identical unassisted Master, stacking with
      Reinforced Hull, legacy saves adopting tier 0 unchanged, and
      escalating costs. Plus a separate invariant check that starting
      shields never exceed max across all 64 tier × hull × assist
      combinations. Browser-verified: 20✦ → 18 → 14 → 7 through all three
      tiers, pips filling, MAXED at T3, ACTIVE toggle appearing on first
      purchase and persisting both ways.
    - **Doc bug found and fixed**: the save-data table above listed the ✦
      balance key as `rocketRushBankedStars`. The code has always used
      `rocketRushStars` — the playtest recipe further down had it right,
      the table did not.
    - Remaining from the held list: only the **skill tree** (PR #28,
      flag-off — now needs renumbering to v0.37.0).
25. **v0.36.0**: **Tutorial** — menu-only, replayable, scripted.
    - **A real `DIFFICULTIES` entry** (`tutorial`) deliberately absent from
      `DIFFICULTY_ORDER`. That array is the *only* thing the difficulty
      selector and the leaderboard tier list iterate, so the tier is
      invisible in both without either needing a special case. Gap is
      300px of a 600px field with `gapRamp: 0` — it never tightens,
      because a tutorial that gets harder while you read a card would be
      self-defeating.
    - **The run is otherwise real.** Ordinary `STATE.PLAY`, real physics,
      collision, coins and rendering — what you learn has to transfer.
      Only three things differ: scripted spawns, the lesson freeze, and
      the fact that nothing is banked.
    - **`STATE.TUTORIAL_INFO`** shares loop()'s frozen branch with PAUSED.
      That's not just tidiness: powerup timers are frame-driven (`ms
      left`, decremented inside `update`), so *not calling update* is
      exactly what stops a lesson card from burning down the buff it is
      describing. A wall-clock timer would have leaked.
    - **Missed pickups re-queue.** The type stays at the head of
      `tutorialQueue` and respawns a few pairs later, so fumbling the
      magnet doesn't mean never being taught the magnet. Out-of-order
      pickups are ignored rather than consuming the wrong lesson.
    - **`goToMenu()` is the single teardown chokepoint** — it restores the
      player's real difficulty and clears the card. Every exit (QUIT, back,
      Esc, death, completion) funnels through it, so no route can strand
      `tutorial` as the active tier. `startTutorial()` deliberately does
      NOT use `setDifficulty()`, which would persist `tutorial` to
      localStorage if the app were killed mid-lesson.
    - **`gameOver()` bails before any persistence** when the tutorial is
      live — one early return covering bests, wallet, lifetime coins, ✦
      meter, Master milestones and leaderboard submission, rather than
      sprinkling guards through each and eventually missing one. It
      deliberately does *not* call `endTutorialMode()` there: the death
      animation is still reading `getDifficulty()`.
    - **Reward**: 500 coins, once ever (`rocketRushTutorialRewarded`),
      credited to `bankedCoins` but **not** `lifetimeCoins` — lifetime
      drives the NG+ reveal and ✦ meter and should only count coins picked
      up in a scored run. Same reasoning v0.29.0's respec used.
    - Verified by a harness driving the real state machine: 50 checks
      covering lesson order, missed-pickup re-queue, out-of-order pickups,
      no double-spawn, outro pacing, both hooks being no-ops outside the
      tutorial, and a source-level assertion that `gameOver` bails ahead of
      every persistence path. Browser-verified through to the WELCOME card;
      the full run couldn't be driven headlessly because a hidden Browser
      pane throttles `requestAnimationFrame` and freezes the game loop.
    - **Not playtested for feel** — pacing of the lessons and the card copy
      are unreviewed.

Guidance tuning knobs in one block, all single-line edits:

```js
const GUIDANCE_STRENGTH = [0, 0.25, 0.45, 0.65];
const GUIDANCE_DAMPING  = [0, 0.12, 0.18, 0.24];
const GUIDANCE_RANGE    = [0, 100,  140,  180];
const GUIDANCE_DEADZONE = [0, 40,   30,   25];
const AUTOPILOT_STRENGTH_MULT = 2.0;
const AUTOPILOT_DAMPING_MULT  = 1.15;
```

## Phase 4 (NG+) progress

Broken into three shippable releases. Full spec: `ngplus-design.md`.

- **4A (v0.22.0) ✅** — Phoenix Cell + Stellar Surplus mechanics wired dormant + 5×/10× multiplier popup.
- **4B (v0.23.0) ✅** — flipped `MASTER_SHOP_AVAILABLE = true`; NG+ reveal at 100k lifetime (Signal Decoded toast + scoreboard → ✦ Star meter); Star economy (Master milestones `MASTER_STAR_MILESTONES = [2500,5000,10000]` + idempotent 1✦-per-100k meter via `rocketRushMeterStarsGranted`, retroactive grant on load); MASTER shop tab (violet, ✦ balance, buy via `attemptMasterPurchase`). Full Autopilot purchase blocked until Guidance T3 (`masterPrereqMet`). Gate is `MASTER_SHOP_AVAILABLE && ngPlusUnlocked()`.
- **4C (v0.25.0) ✅** — rocket skins (`SKIN_PALETTES` refactor of `drawRocket()`, shop rows, equip UI) + meter retune (reveal dropped 100k → 25k, `METER_STEP` 50k).

Phase 4 is fully shipped. The global leaderboard landed alongside it in
v0.24.0 (see `leaderboard-design.md`).

## TWA / Google Play (Phases A–D complete; in closed testing)

- **Phase A (v0.26.0) — PWA/mobile hardening**: manifest `id`/lang/categories,
  safe-area left/right insets, pause system (`STATE.PAUSED`, frozen loop branch,
  resume re-runs countdown without launch burst), Android back-button handling
  (history sentinel trap: back closes overlays / pauses runs / double-back-to-exit
  hint at menu; countdown + game-over timers made cancellation-safe). Esc mirrors
  back on desktop; tab-hide auto-pauses.
- **Phase B (v0.27.0) — privacy policy** page (required: leaderboard collects
  name+scores). Brent must review before ship.
- **Phase C (v0.28.0) ✅ — TWA packaging**: PWABuilder wrapper, package
  `com.astralgamer.rocketrush`, `.well-known/assetlinks.json` with the Play App
  Signing SHA-256 fingerprint. Verified against Google's Digital Asset Links API.
- **Phase D ✅ — store listing**: Data Safety, IARC rating, ad-ID declaration
  (No), listing copy + assets, closed testing track live in 177 countries.
  Answer keys and copy: `play-store-phase-d.md`. Assets: `store-assets/`.

**Current gate**: 12+ testers must opt in via the Google Group
(`rocket-rush-testers@googlegroups.com`, attached to the Closed testing track)
and stay enrolled 14 continuous days before production access can be requested.
Tester chain is group membership → opt-in link → install link; all three need
the *same* Google account, which is the usual failure point.

## Playtest testing NG+ / Master Shop (v0.23.0, live in-game)

The Master Shop is now real. To jump straight to a testable NG+ state via DevTools:

```js
localStorage.setItem('rocketRushLifetimeCoins', '100000'); // unlock NG+ (reveal is 25k as of v0.25.0)
localStorage.setItem('rocketRushStars', '20');             // ✦ to spend
localStorage.setItem('rocketRushMeterStarsGranted', '1');  // no surprise re-grant
localStorage.setItem('rocketRushMasterUpgrades', JSON.stringify({phoenix_cell:false, full_autopilot:false, stellar_surplus:false}));
localStorage.setItem('rocketRushMasterUnlocked', '1');     // play Master to earn milestone ✦
location.reload();
```

- **Reveal**: to see the "Signal Decoded" toast again, `localStorage.removeItem('rocketRushNgPlusRevealSeen')` and reload (fires on load since lifetime ≥ 100k).
- **Star meter**: menu tile shows `✦ N` + progress to next 100k meter star.
- **Master shop**: SHOP → MASTER ✦ tab. Buy capstones with ✦. Full Autopilot shows LOCKED until Guidance is T3 (`rocketRushUpgrades.hyperfocus.guidance = 3`).
- **Earning**: score 2,500 / 5,000 / 10,000 on **Master** in one run → 1/2/3 ✦ (game-over shows "+N ✦ earned").

### Capstone behavior reference (all now buyable via the Master Shop)

- **Phoenix Cell** (1✦): die with 0 shields (asteroid hit or floor) → orange/gold
  fire burst, rising "re-ignition" SFX, upward kick, 1 shield pip relights, run
  continues. Once per run; second death is final.
- **Stellar Surplus** (10✦): pass 10+ pairs → gold `✦ +5%` HUD badge, +5% per 10
  pairs (cap +50%). Scales **score only** — banked coin wallet is untouched.
- **Full Autopilot** (3✦): needs Guidance T3. Guide line tints **violet**, pull is
  ~2× stronger (`AUTOPILOT_STRENGTH_MULT`). Blocked in-shop until Guidance is maxed.
