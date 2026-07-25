# NG+ Design — Phase 3 (design-only, no code)

Decided 2026-07-09 with Brent. This doc is the contract for Phase 4
implementation. Game code is untouched this phase.

## Design pillars

1. **Additive, never punitive** — NG+ takes nothing away. No prestige
   resets, no wiped upgrades. Filling the bar only ever adds.
2. **Master is the arena** — Stars are primarily earned by performing on
   Master difficulty, making it the endgame destination, not a novelty.
3. **Guaranteed slow path** — weaker players still inch forward via the
   lifetime-coin meter, so nobody is hard-locked out of NG+ content.

---

## 1. The Reveal (bar fill at 25k lifetime coins)

> **v0.25.0 retune**: reveal dropped from 100k → **25k** and the meter
> cadence changed (see §2). Faster onboarding into NG+.

When `lifetimeCoins` crosses `NG_PLUS_REVEAL` (25,000):

- **Master Shop tab appears** in the existing shop (segmented
  REGULAR / MASTER control, per Phase 2 scaffolding).
- **First Star granted** — this is the meter's first fill payout (see
  §2), so the reveal moment comes with currency in hand.
- **One-shot reveal toast** on the main menu, reusing the Master-unlock
  toast pattern. Copy suggestion: *"Signal decoded — the Master Shop is
  open. ✦"* Gated by new flag `rocketRushNgPlusRevealSeen`.
- The vague scoreboard tile re-labels from mystery copy to an honest
  **Star meter**: progress toward the next meter Star.

**Gate change**: Master Shop visibility becomes
`MASTER_SHOP_AVAILABLE && ngPlusUnlocked` — the current additional
`isMasterUnlocked()` gate is dropped. Rationale: a player can reach the
lifetime-coin reveal without ever scoring 5,000 on Expert; they should still
get the reveal (their Star income is just meter-only until they unlock
Master). The two gates stay independent by design.

## 2. Star economy

Two sources, milestone-dominant:

### a) Master score milestones (primary, skill path)

Earned per run, **Master difficulty only**, credited at game over:

| Milestone (score in one Master run) | Stars |
|---|---|
| 2,500 | 1✦ |
| 5,000 | +1✦ (2 total) |
| 10,000 | +1✦ (3 total, per-run cap) |

Constant: `MASTER_STAR_MILESTONES = [2500, 5000, 10000]`. These are
**guesses pending playtest** — tune after feeling out Master pacing.
No persistence needed; computed at `gameOver()` and added to
`bankedStars`.

### b) Lifetime-coin meter (secondary, guaranteed path)

**v0.25.0 schedule**: star 1 at **25k** lifetime coins (= the reveal),
then **+1✦ every 50k** after (star N at `NG_PLUS_REVEAL + (N-1)*METER_STEP`).
Any difficulty. Was a flat 1✦/100k in v0.23.0. Implementation shape:
credited stars = `meterStarsEarnedAt(lifetime)`; persist how many have
been credited (`rocketRushMeterStarsGranted`) and pay out the difference
at game over / on load. Idempotent, no double-grants; the cheaper
schedule only ever raises the earned count, so returning players get
owed stars, never a clawback.

> Reconciliation note: the playtest decisions picked both "meter
> re-arms" (reveal question) and "milestones only" (earning question).
> Resolved as: milestones are the *designed* path and dominate pacing;
> the meter is a slow fallback (~1✦ per 100k) so low-skill players
> still progress. If playtest shows meter stars feel irrelevant or too
> generous, cutting or re-pricing the meter is a one-constant change.

### Pacing check (target: capstones in ~10-15 good runs)

- Capstone total: 14✦ (Phoenix 1 + Autopilot 3 + Surplus 10).
- A good Master run (2,500–5,000) yields 1–2✦ → 14✦ in ~7–14 runs. ✓
- Skins add 12✦ of optional sinks → full completion ~20–25 runs.
- Meter (v0.25.0) contributes 1✦ by 25k, then 1 per 50k — noticeably
  faster early income, and NG+ opens much sooner.

### Retroactive grant (Phase 4 migration)

Players already past 100k lifetime when Phase 4 ships (the bar has been
sitting capped at 100%) get their meter stars immediately on first load:
grant `floor(lifetimeCoins / threshold)`, set
`rocketRushMeterStarsGranted`, fire the reveal toast. Nobody's waiting
grind is discarded.

## 3. Rocket variants — cosmetic skins, Star-bought

Palette swaps of the existing drawn rocket. Zero gameplay impact.
Sold in the Master Shop below the capstones. Tap an owned skin to equip.

| id | Label | Cost | Palette direction |
|---|---|---|---|
| `classic` | Classic | — (default) | current white/red |
| `comet` | Comet Trail | 2✦ | icy blue hull, cyan flame |
| `solar` | Solar Flare | 4✦ | gold/orange hull, amber flame |
| `void` | Void Runner | 6✦ | dark hull, violet flame (pairs with Autopilot's violet guide line) |

Implementation shape (Phase 4): `drawRocket()` reads colors from a
`SKIN_PALETTES[activeSkin]` lookup instead of literals — same pattern as
the v0.21.0 `drawCoin()` palette refactor. Flame/particle tints follow
the palette.

## 4. Capstone final mechanics

### Phoenix Cell — 1✦

- Triggers when a hit **would be fatal** (shields === 0) and
  `!phoenixUsedThisRun`. Any death source counts.
- Effect: shields → 1, once per run. Brief invulnerability window
  (reuse the existing shield-hit i-frame pattern), orange rebirth
  particle burst, distinct SFX, haptic pulse.
- HUD: shield pip relights with a flash so the save reads clearly.
- Run-state flag `phoenixUsedThisRun` resets in `reset()`.

### Full Autopilot — 3✦ (already coded, dormant)

- Mechanics shipped in v0.20.0: `AUTOPILOT_STRENGTH_MULT = 2.0`,
  `AUTOPILOT_DAMPING_MULT = 1.15`, violet guide-line tint.
- Requires regular Guidance at T3 Precision — Master boost layers on
  top of the regular progression, never bypasses it.
- Phase 4 work is purchase exposure only.

### Stellar Surplus — 10✦

- +5% score multiplier per 10 asteroids passed **this run**, caps at
  +50% (100 asteroids).
- Applies to **score gains only** (pass points + coin score points).
  Does **NOT** touch wallet coin earnings — otherwise it inflates the
  coin economy and indirectly accelerates the Star meter.
- Stacks **multiplicatively** with the 2x powerup (2.0 × 1.5 = 3.0x
  peak) — matches how the score pipeline already multiplies.
- Active on all difficulties (Master wares are global capabilities,
  consistent with Phoenix/Autopilot).
- HUD: small ✦ +N% indicator near the score once the first +5% kicks in.

## 5. Save v2 shape

| Key | Type | Status |
|---|---|---|
| `rocketRushStars` | int | exists (Phase 2) |
| `rocketRushMasterUpgrades` | booleans object | exists (Phase 2) |
| `rocketRushLifetimeCoins` | int | exists (Phase 2) |
| `rocketRushMeterStarsGranted` | int | **NEW** — meter stars already credited |
| `rocketRushNgPlusRevealSeen` | bool | **NEW** — one-shot reveal toast |
| `rocketRushSkinsOwned` | JSON object `{comet, solar, void}` | **NEW** — shape-preserving merge like `loadUpgrades()` |
| `rocketRushActiveSkin` | string, default `'classic'` | **NEW** — unknown/unowned values fall back to classic |

No changes to existing keys; all new keys default sanely when absent —
same shape-preserving philosophy as every prior migration.

## 6. Phase 4 implementation checklist (for later — not now)

1. Flip `MASTER_SHOP_AVAILABLE = true`.
2. Change shop gate from `MASTER_SHOP_AVAILABLE && isMasterUnlocked()`
   to `MASTER_SHOP_AVAILABLE && ngPlusUnlocked` (index.html ~line 3486).
3. Star earning at `gameOver()`: milestone check (Master only) + meter
   diff payout; retroactive grant migration on load.
4. Reveal toast + scoreboard tile re-label (mystery copy → Star meter).
5. Segmented REGULAR/MASTER shop UI + ✦ balance display + NEW! badge.
6. Wire Phoenix Cell + Stellar Surplus effects; expose Autopilot
   purchase (already wired).
7. Skins: `SKIN_PALETTES` lookup in `drawRocket()`, shop rows, equip UI.
8. Standard release checklist (3 version strings, node --check, stale
   version grep, version-tagged comments).
