# Play Store Phase D — Store Listing, Data Safety, IARC

Working reference for the final Play Console steps. Everything here is grounded
in `privacy.html` (effective July 15, 2026) — if the privacy policy ever
changes, re-check the Data Safety answers against it.

App: **Rocket Rush** · package `com.astralgamer.rocketrush` · Free, no ads, no IAP.

---

## 1. Data Safety form (answer key)

Play Console → App content → Data safety. Answers below follow the form's
order. The whole form derives from one fact: **the only data that ever leaves
the device is an optional leaderboard submission** (nickname, score, rounds,
timestamp) over HTTPS to our Netlify function.

### Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS everywhere — Netlify enforces it) |
| Which methods of account creation does your app support? | **My app does not allow users to create an account** |
| Do you provide a way for users to request that their data is deleted? | **Yes** — email removal requests (see privacy policy, "Removing your data"). If a URL is requested, use `https://asteroidrocketrush.netlify.app/privacy.html` |

### Data types — check exactly these two, nothing else

1. **Personal info → User IDs** — the leaderboard nickname (a self-chosen
   public handle, 3–12 chars, filtered).
   - *Why not "Name"?* The policy explicitly tells players NOT to use a real
     name, and nothing verifies or links it to a person. A gamertag-style
     handle is declared as User IDs.
2. **App activity → Other actions** — the score and rounds in a leaderboard
   submission (gameplay statistics). The submission timestamp rides along with
   this and needs no separate declaration.

Leave every other category unchecked. Notably:
- **Location / Device IDs / Financial / Contacts / etc. — No.** We collect none of it.
- Netlify's infrastructure transiently sees IP addresses to serve the site
  (standard hosting; disclosed in privacy.html). That's the host acting as a
  service provider for delivery, not app data collection — do not declare it.

### Per-type questions (same answers for BOTH declared types)

| Question | Answer |
|---|---|
| Is this data collected, shared, or both? | **Collected** (not shared — public leaderboard display is a user-initiated action the user expects, and Netlify is a service provider; both are outside Play's definition of "sharing") |
| Is this data processed ephemerally? | **No** (leaderboard entries are stored) |
| Is this data required, or can users choose? | **Users can choose whether this data is collected** (submission is entirely optional; game is fully playable without it) |
| Why is this data collected? | **App functionality** only (the leaderboard). No other purposes. |

The resulting public label should read: *Data is encrypted in transit · You can
request that data be deleted · Data collection is optional.*

---

## 2. IARC content rating questionnaire (answer key)

Play Console → App content → Content rating. Category: **Game**.
Contact email: `AstralGamer444@gmail.com`.

Default answer to everything is **No**, with these exceptions/notes:

| Topic | Answer | Notes |
|---|---|---|
| Violence (toward humans / animals / fantasy characters) | **No** | Nobody gets hurt; there are no characters. A rocket pops in a cartoon burst on impact. |
| Destruction of objects/vehicles (if asked separately) | **Yes**, unrealistic/cartoon | Only if the form explicitly asks about damage to *objects or vehicles*: the rocket crashes with a stylized cartoon explosion. This does not raise the rating above Everyone. |
| Fear / horror | No | |
| Sexuality / nudity | No | |
| Language / profanity | No | Nickname filter actively blocks it. |
| Drugs / alcohol / tobacco | No | |
| Gambling (simulated or real) | **No** | Coins are earned by play only — nothing is wagered, no chance mechanics, no purchases. |
| **Does the app allow users to interact or exchange content? / share user-generated content?** | **Yes** | Public leaderboard shows user-chosen nicknames. If asked "is it moderated/filtered": yes — charset allowlist + profanity blocklist, and no free-form chat exists. |
| Does the app share the user's location with others? | No | |
| Digital purchases (in-app purchases) | **No** | Economy is earned-only. |
| Contains ads / promotional content | **No** | |
| Is it a web browser or search engine? | No | |

Expected result: **ESRB Everyone / PEGI 3** with a "Users Interact" notice
(that's normal and correct — it comes from the leaderboard UGC answer).

---

## 3. Store listing copy

Play Console → Grow → Store presence → Main store listing.

### App name (max 30 chars)

> **Rocket Rush**

(11 chars. If Play flags a name collision or discoverability is a concern,
fallback: **Rocket Rush: Asteroid Dodge** — 27 chars.)

### Short description (max 80 chars)

> **Dodge asteroids, bank coins, upgrade your rocket. One tap to fly. No ads, free.**

(79 chars.)

### Full description (max 4000 chars)

```
One tap. Endless space. How far can you fly?

ROCKET RUSH is a fast, no-nonsense arcade dodger. Tap to fire your thrusters, weave through the asteroid field, and grab every coin you can before the inevitable happens. Then upgrade your rocket and go again — a little stronger, a little richer, a little further.

HOW IT PLAYS
• One-finger controls — tap to thrust, release to fall
• Slip through the gaps in oncoming asteroid pairs
• Bank bronze, silver, and gold coins as you fly
• Grab power-ups mid-run and cash in your haul at the end

BUILD YOUR ROCKET
Spend banked coins in the Shop on 13 upgrades across five systems:
• Shield — survive hits that would end your run
• Magnet — pull nearby coins into your path
• Multiplier — boost the value of everything you collect
• Hangar — launch with head starts and bonuses
• Hyperfocus — slow the world down while you thread the needle
Every upgrade has named tiers — from Turbo Injectors all the way to the Overdrive Reactor.

FOUR DIFFICULTIES
Beginner, Intermediate, and Expert are open from the start. Prove yourself on Expert and you'll unlock MASTER — where the real scores (and the rarest rewards) live.

BEYOND THE SHOP
Keep flying and you'll discover there's more to the game than coins. Veteran pilots earn Stars ✦ and unlock capstone technology: cheat death with the Phoenix Cell, amplify your scores with Stellar Surplus, or let Full Autopilot thread the asteroids for you. Rocket skins let you do it all in style.

GLOBAL LEADERBOARD
Every difficulty has its own public Top 100. Post your best runs under a nickname — or don't. It's entirely optional.

NO NONSENSE
• Free. No ads. No in-app purchases.
• No account, no sign-in, no tracking.
• Works offline once installed.
• Reduce Motion accessibility option.

Your rocket is waiting. The asteroids aren't going to dodge themselves.
```

### Other listing fields

- **App category**: Game → Arcade
- **Tags**: pick from suggestions (Arcade, Casual, Action, Offline, Single player)
- **Contact email** (shown publicly): `AstralGamer444@gmail.com`
- **Privacy policy URL**: `https://asteroidrocketrush.netlify.app/privacy.html` (already set)

---

## 4. Graphic assets

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG | ✅ `icon-512.png` (already uploaded with AAB) |
| Feature graphic | 1024×500 PNG/JPEG | `store-assets/feature-graphic-1024x500.png` |
| Phone screenshots | 2–8, PNG/JPEG, 16:9 or 9:16, ≥1080px recommended, max ratio 2:1 | `store-assets/screenshots/` (1080×2160 portrait) |
| 7" / 10" tablet screenshots | optional for phones-only launch | skip for now |

`store-assets/feature-graphic.html` is the source for the feature graphic —
re-render at 1024×500 with headless Chrome if it ever needs edits.

Screenshot set (1080×2160, captured from the live v0.28.0 site with a seeded
mid-game save — upload in this order; Play shows the first ones most):

1. `phone-01-gameplay-shield.png` — mid-run, +SHIELD pickup popup, score 16
2. `phone-02-gameplay-coins.png` — mid-run, silver + gold coins, planets
3. `phone-03-menu.png` — main menu, difficulty select, Star meter
4. `phone-04-shop.png` — shop category cards
5. `phone-05-master-shop.png` — MASTER ✦ tab, capstones + skins
6. `phone-06-leaderboard.png` — optional; current live board is sparse (4 low
   scores, one nickname is "Jesus"). Consider re-shooting after the board
   fills up, or skipping it — 5 screenshots is plenty.

---

## 5. Closed testing → production (the 14-day gauntlet)

Personal developer accounts created after Nov 2023 must run a closed test
before production access:

1. Play Console → Testing → **Closed testing** → create track (or promote the
   existing Internal build to it).
2. Add a tester email list; share the opt-in link.
3. Recruit **12+ real testers** — each must opt in via the link AND install via
   Play with their own Google account. Play verifies real engagement; throwaway
   accounts won't count.
4. Keep 12+ testers enrolled for **14 continuous days** (they need the app
   installed, ideally opening it now and then).
5. After 14 days, the console offers **Apply for production access** — a short
   questionnaire about the app and testing feedback. Answer honestly; approval
   typically takes a few days.
6. Then: Production release → countries → rollout.
