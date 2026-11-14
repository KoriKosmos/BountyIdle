import { CONFIG } from './config.js';
import { CREW, ALL_UPGRADES, CONTRACT_TIERS } from './data.js';

export const SAVE_VERSION = 3;

export function createState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    credits: 0,
    lifetime: 0,
    rep: 0,
    crew: Object.fromEntries(CREW.map((c) => [c.id, 0])),
    upgrades: {},
    seen: { crew: {}, upgrades: {} },
    contract: {
      active: null,     // { ...offer, progress }
      offers: [],
      refreshedAt: 0,
      unlocked: false,
    },
    stats: { hunts: 0, autoHunts: 0, contracts: 0, startedAt: now, playMs: 0, bestRate: 0 },
    savedAt: now,
  };
}

const num = (v, fallback = 0) => (Number.isFinite(v) && v >= 0 ? v : fallback);

/**
 * Normalise any parsed save into a valid current-version state. Unknown keys
 * are dropped and every field is type-checked, so a hand-edited or corrupted
 * save can never put the game into an impossible state.
 */
export function hydrate(raw) {
  const s = createState();
  if (!raw || typeof raw !== 'object') return s;

  if (raw.version !== SAVE_VERSION) raw = migrateLegacy(raw);

  s.credits = num(raw.credits);
  s.lifetime = Math.max(num(raw.lifetime), s.credits);
  s.rep = Math.floor(num(raw.rep));

  for (const c of CREW) s.crew[c.id] = Math.floor(num(raw.crew?.[c.id]));
  for (const u of ALL_UPGRADES) {
    const n = Math.floor(num(raw.upgrades?.[u.id]));
    if (n > 0) s.upgrades[u.id] = Math.min(n, u.kind === 'once' ? 1 : u.max);
  }
  for (const k of ['crew', 'upgrades']) {
    const seen = raw.seen?.[k];
    if (seen && typeof seen === 'object') {
      for (const id of Object.keys(seen)) if (seen[id] === true) s.seen[k][id] = true;
    }
  }

  const c = raw.contract;
  if (c && typeof c === 'object') {
    s.contract.unlocked = c.unlocked === true;
    s.contract.refreshedAt = num(c.refreshedAt);
    if (Array.isArray(c.offers)) s.contract.offers = c.offers.filter(isOffer);
    if (isOffer(c.active)) s.contract.active = { ...c.active, progress: num(c.active.progress) };
  }

  const st = raw.stats || {};
  s.stats.hunts = Math.floor(num(st.hunts));
  s.stats.autoHunts = Math.floor(num(st.autoHunts));
  s.stats.contracts = Math.floor(num(st.contracts));
  s.stats.startedAt = num(st.startedAt, Date.now()) || Date.now();
  s.stats.playMs = num(st.playMs);
  s.stats.bestRate = num(st.bestRate);
  s.savedAt = num(raw.savedAt, Date.now()) || Date.now();
  return s;
}

function isOffer(o) {
  return !!o && typeof o === 'object'
    && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.crime === 'string'
    && (o.alias == null || typeof o.alias === 'string')
    && CONTRACT_TIERS.some((t) => t.id === o.tier)
    && Number.isFinite(o.goal) && o.goal > 0
    && Number.isFinite(o.reward) && o.reward >= 0
    && Number.isFinite(o.rep);
}

/**
 * Converts the v2 save format ({ state, crewCounts }) into v3 shape. Old
 * players keep their credits, their crew (novices become rookies) and their
 * upgrade levels; the old autoclicker becomes the Snitch upgrade.
 */
export function migrateLegacy(raw) {
  if (!raw.state || !Array.isArray(raw.crewCounts)) return raw;
  const old = raw.state;
  const counts = Object.fromEntries(raw.crewCounts.map((c) => [c.id, c.count]));
  const up = old.upgrades || {};
  return {
    credits: old.credits,
    lifetime: old.credits,
    crew: { rookie: counts.novice || 0 },
    upgrades: {
      reflexes: Math.min(15, up.reduceCooldown || 0),
      iron: up.doubleClick || 0,
      snitch: Math.min(5, counts.snitch || 0),
    },
    contract: { unlocked: !!old.flags?.contractsUnlocked },
    savedAt: raw.timestamp,
  };
}

export function readSave() {
  try {
    const cur = localStorage.getItem(CONFIG.SAVE_KEY);
    if (cur) return { state: hydrate(JSON.parse(cur)), migrated: false };
    const legacy = localStorage.getItem(CONFIG.LEGACY_SAVE_KEY);
    if (legacy) return { state: hydrate(JSON.parse(legacy)), migrated: true };
  } catch (err) {
    console.warn('[save] could not read save, starting fresh', err);
  }
  return { state: createState(), migrated: false, fresh: true };
}

export function writeSave(state) {
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('[save] write failed', err);
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.SAVE_KEY);
    localStorage.removeItem(CONFIG.LEGACY_SAVE_KEY);
  } catch { /* storage unavailable */ }
}

/** Save strings are base64 JSON so they survive copy/paste through chat apps. */
export function encodeSave(state) {
  const json = JSON.stringify(state);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

export function decodeSave(str) {
  const bin = atob(str.trim());
  const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  const raw = JSON.parse(json);
  if (!raw || typeof raw !== 'object' || (!('credits' in raw) && !raw.state)) {
    throw new Error('Not a Bounty Office save');
  }
  return hydrate(raw);
}
