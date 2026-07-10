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

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'AAA';
  // Keep printable characters only (drop ASCII control chars + DEL), then
  // trim and cap to 12. A char-code filter avoids embedding control-char
  // literals in this source file.
  let cleaned = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (code >= 32 && code !== 127) cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, 12);
  return cleaned.length ? cleaned : 'AAA';
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
    const name = sanitizeName(body.name);
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
