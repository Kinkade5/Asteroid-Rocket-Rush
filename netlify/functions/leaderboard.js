// Rocket Rush — global leaderboard (Netlify Function, v2 API).
//
//   GET  /.netlify/functions/leaderboard?tier=<tier>
//        -> { tier, entries: [{ name, score, asteroids, ts }, ...] }
//   POST /.netlify/functions/leaderboard  { tier, name, score, asteroids }
//        -> { tier, rank, entries }   (rank is 1-based, or null if it missed
//                                       the board)
//
// Storage: Netlify Blobs, one JSON array per tier, kept sorted by score desc
// (tie-break asteroids desc) and truncated to TOP_N. Everything lives in the
// existing Netlify project — no external DB.
//
// ANTI-CHEAT IS INTENTIONALLY LIGHT. Client-submitted web scores can always
// be spoofed by a determined user (open devtools, POST anything). These
// checks only stop lazy garbage — absurd values and impossible
// score-for-asteroids ratios. Do NOT treat this board as tamper-proof.

import { getStore } from '@netlify/blobs';

const TIERS = ['beginner', 'intermediate', 'expert', 'master'];
const TOP_N = 100;

// Soft plausibility bounds. Generous on purpose: with maxed multipliers
// (2x powerup x Shock x Stellar Surplus = up to 27x) a legit run scores a lot
// per pair, so we only reject the clearly-impossible.
const MAX_SCORE = 100000000;          // 100M hard ceiling
const MAX_ASTEROIDS = 100000;         // nobody threads 100k gaps legitimately
const MAX_SCORE_PER_ASTEROID = 8000;  // ratio gate (+ slack below)
const BASE_SCORE_SLACK = 10000;       // allow small scores at 0-few asteroids

// === v0.24.0 — name rules (arcade style) ===
// Charset: A-Z 0-9 space hyphen, uppercase enforced, 3-12 chars. The strict
// allowlist is most of the profanity defense — no emoji, no Unicode
// homoglyphs, no punctuation tricks. On top of that, a blocklist is checked
// against NORMALIZED forms of the name (leetspeak digits mapped to letters,
// separators stripped, repeated letters collapsed) so "F U C K", "FUUUCK",
// and "FVCK-1" style evasions all still match.
//
// Philosophy: reject with a clear error (client shows "try a different
// name") rather than silently storing AAA — transparent for legit players
// hit by a rare false positive. The blocklist deliberately sticks to
// unambiguous strong terms; short Scunthorpe-prone words (ASS in PASS,
// SPIC in SPICY, ANAL in CANAL...) are matched EXACTLY instead of as
// substrings so ordinary names don't get eaten.
const NAME_MIN = 3;
const NAME_MAX = 12;
const NAME_CHARS = /^[A-Z0-9 -]+$/;

// Leetspeak digit map used only for matching (stored name keeps its digits).
const LEET = { '0': 'O', '1': 'I', '2': 'Z', '3': 'E', '4': 'A', '5': 'S', '6': 'G', '7': 'T', '8': 'B', '9': 'G' };

// Substring terms — unambiguous enough that ANY occurrence is rejected.
const BANNED_SUBSTRINGS = [
  'FUCK', 'SHIT', 'BITCH', 'CUNT', 'COCK', 'DICK', 'PENIS', 'PUSSY',
  'WHORE', 'SLUT', 'TWAT', 'WANK', 'PRICK', 'BOLLOCK', 'PISS', 'JIZZ',
  'SEMEN', 'DILDO', 'MILF', 'BLOWJOB', 'HANDJOB', 'HENTAI', 'PORN',
  'ASSHOLE', 'BASTARD', 'RETARD', 'RAPIST', 'MOLEST', 'PEDO',
  'NIGGER', 'NIGGA', 'FAGGOT', 'TRANNY', 'DYKE', 'KIKE', 'CHINK',
  'WETBACK', 'BEANER', 'GOOK', 'NEGRO', 'SWASTIKA', 'HITLER', 'NAZI',
];
// Exact-match terms — too collision-prone as substrings (Scunthorpe words).
const BANNED_EXACT = [
  'ASS', 'SEX', 'CUM', 'TIT', 'TITS', 'FAG', 'FAGS', 'KKK', 'HOE',
  'RAPE', 'ANAL', 'ANUS', 'ARSE', 'SPIC', 'COON',
];

// Collapse runs of the same letter (FUUUCK -> FUCK). Matching-only.
function collapseRepeats(s) {
  let out = '';
  for (const ch of s) { if (ch !== out[out.length - 1]) out += ch; }
  return out;
}

// Map leet digits to letters and drop separators. Matching-only.
function normalizeForMatch(s) {
  let out = '';
  for (const ch of s) {
    if (ch === ' ' || ch === '-') continue;
    out += LEET[ch] || ch;
  }
  return out;
}

function isNameClean(name) {
  const norm = normalizeForMatch(name);      // FVCK-1 -> FVCKI, F U C K -> FUCK
  const collapsed = collapseRepeats(norm);   // FUUUCK -> FUCK
  for (const term of BANNED_SUBSTRINGS) {
    if (norm.includes(term)) return false;
    if (collapsed.includes(collapseRepeats(term))) return false;
  }
  for (const term of BANNED_EXACT) {
    if (norm === term) return false;
    if (collapsed === collapseRepeats(term)) return false;
  }
  return true;
}

// Full validation: returns the cleaned, uppercased name to store, or null
// if the submission should be rejected (charset / length / profanity).
function validateName(raw) {
  if (typeof raw !== 'string') return null;
  // Uppercase, squeeze runs of whitespace to single spaces, trim.
  const cleaned = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (cleaned.length < NAME_MIN || cleaned.length > NAME_MAX) return null;
  if (!NAME_CHARS.test(cleaned)) return null;
  if (!isNameClean(cleaned)) return null;
  return cleaned;
}

function isPlausible(score, asteroids) {
  if (!Number.isInteger(score) || !Number.isInteger(asteroids)) return false;
  if (score < 0 || asteroids < 0) return false;
  if (score > MAX_SCORE || asteroids > MAX_ASTEROIDS) return false;
  if (score > asteroids * MAX_SCORE_PER_ASTEROID + BASE_SCORE_SLACK) return false;
  return true;
}

export default async (req) => {
  const store = getStore('leaderboard');

  if (req.method === 'GET') {
    const tier = new URL(req.url).searchParams.get('tier');
    if (!TIERS.includes(tier)) {
      return Response.json({ error: 'bad tier' }, { status: 400 });
    }
    const entries = (await store.get(tier, { type: 'json' })) || [];
    return Response.json({ tier, entries });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    const tier = body && body.tier;
    if (!TIERS.includes(tier)) {
      return Response.json({ error: 'bad tier' }, { status: 400 });
    }
    // v0.24.0 — names are validated, not sanitized: a bad name (charset,
    // length, or profanity) rejects the whole submission with a distinct
    // error so the client can prompt for a different name.
    const name = validateName(body.name);
    if (name === null) {
      return Response.json({ error: 'bad name' }, { status: 422 });
    }
    const score = Number(body.score);
    const asteroids = Number(body.asteroids);
    if (!isPlausible(score, asteroids)) {
      return Response.json({ error: 'implausible score' }, { status: 422 });
    }

    // Read-modify-write. Low-traffic hobby board, so a rare lost update under
    // concurrent writes is acceptable; harden with etag compare-and-set later.
    const entries = (await store.get(tier, { type: 'json' })) || [];
    const entry = { name, score, asteroids, ts: Date.now() };
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score || b.asteroids - a.asteroids);
    const trimmed = entries.slice(0, TOP_N);
    await store.setJSON(tier, trimmed);

    // The same object reference survives the sort/slice, so indexOf locates
    // it; -1 means it was trimmed off the end (didn't make the Top N).
    const idx = trimmed.indexOf(entry);
    return Response.json({ tier, rank: idx >= 0 ? idx + 1 : null, entries: trimmed });
  }

  return Response.json({ error: 'method not allowed' }, { status: 405 });
};
