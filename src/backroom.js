import { fmt } from './format.js';

/**
 * The Back Room: side rackets that unlock as the office grows. Each one is a
 * different way to turn credits (or attention) into more credits.
 *
 *  Dock Dice     push-your-luck: grow a pot, cash out before a one.
 *  Warrant Exchange  a mean-reverting index; buy low, sell high, pick leverage.
 *  Intercepts    a code-breaking puzzle that pays in minutes of income.
 *
 * Every number is sized from `game.power` (credits/s the office can produce)
 * so the games stay relevant from the first thousand credits to the last.
 */

export const RACKETS = [
  { id: 'dice',     name: 'Dock Dice',        unlockAt: 3_000,   blurb: 'A crate, two stools and a cup of bone dice behind the cargo lift.' },
  { id: 'exchange', name: 'Warrant Exchange', unlockAt: 60_000,  blurb: 'Bonds on outstanding warrants, traded by people who never leave the station.' },
  { id: 'cipher',   name: 'Intercepts',       unlockAt: 750_000, blurb: 'Guild traffic your informants pulled off the relay. Crack the key, sell what’s inside.' },
];

// ── Dock Dice ───────────────────────────────────────────────────────────
export const DICE_STAKES = [
  { id: 'small', label: 'Small', seconds: 30 },
  { id: 'mid',   label: 'Fair',  seconds: 120 },
  { id: 'big',   label: 'Heavy', seconds: 600 },
];
/** Each non-bust roll of r adds r × this to the pot multiplier. */
const DICE_STEP = 0.1;

// ── Exchange ────────────────────────────────────────────────────────────
export const EXCHANGE_RISK = [
  { id: 'low',  label: 'Hedged',    leverage: 0.5 },
  { id: 'mid',  label: 'Straight',  leverage: 1 },
  { id: 'high', label: 'Leveraged', leverage: 2.5 },
];
export const EXCHANGE_STEP_S = 2;
export const EXCHANGE_HISTORY = 90;
/** Largest position the exchange will let you hold, in seconds of output. */
const EXCHANGE_CAP_S = 1800;
const REVERT = 0.035;   // pull back toward par each step
const VOL = 0.024;      // per-step volatility of log(index)
const NEWS = [
  { p: 0.012, shock: -0.16, text: 'Dock strike on the Kepler Ring. Warrants slump.' },
  { p: 0.012, shock: 0.15, text: 'Guild doubles bounty payouts for the quarter. Warrants rally.' },
  { p: 0.008, shock: -0.22, text: 'A judge voids a batch of warrants. The index drops hard.' },
  { p: 0.008, shock: 0.2, text: 'Three syndicate captains surface at once. Buyers pile in.' },
];

// ── Intercepts ──────────────────────────────────────────────────────────
export const CIPHER_GLYPHS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const CIPHER_LENGTH = 4;
export const CIPHER_TRIES = 8;
const CIPHER_COOLDOWN_MS = 3 * 60 * 1000;
const CIPHER_BASE_S = 240;

export function createBackroom() {
  return {
    unlocked: { dice: false, exchange: false, cipher: false },
    dice: { stake: 0, mult: 1, rolls: [], won: 0, lost: 0, best: 0 },
    exchange: {
      index: 100,
      history: Array(EXCHANGE_HISTORY).fill(100),
      value: 0, basis: 0, risk: 'mid', realised: 0,
    },
    cipher: { code: null, guesses: [], readyAt: 0, solved: 0, failed: 0, earned: 0 },
  };
}

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const pos = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? v : d);
const isGlyphRow = (a) => Array.isArray(a) && a.length === CIPHER_LENGTH
  && a.every((x) => Number.isInteger(x) && x >= 0 && x < CIPHER_GLYPHS.length);

/** Type-checks a saved back room; anything malformed falls back to defaults. */
export function hydrateBackroom(raw) {
  const b = createBackroom();
  if (!raw || typeof raw !== 'object') return b;

  for (const r of RACKETS) b.unlocked[r.id] = raw.unlocked?.[r.id] === true;

  const d = raw.dice || {};
  b.dice.stake = pos(d.stake);
  b.dice.mult = Math.max(1, fin(d.mult, 1));
  b.dice.rolls = Array.isArray(d.rolls) ? d.rolls.filter((r) => Number.isInteger(r) && r >= 1 && r <= 6).slice(-12) : [];
  b.dice.won = pos(d.won);
  b.dice.lost = pos(d.lost);
  b.dice.best = pos(d.best);
  if (!b.dice.stake) { b.dice.mult = 1; b.dice.rolls = []; }

  const e = raw.exchange || {};
  b.exchange.index = Math.min(1000, Math.max(1, pos(e.index, 100) || 100));
  if (Array.isArray(e.history) && e.history.every((v) => Number.isFinite(v) && v > 0)) {
    const h = e.history.slice(-EXCHANGE_HISTORY);
    b.exchange.history = [...Array(EXCHANGE_HISTORY - h.length).fill(h[0] ?? 100), ...h];
  }
  b.exchange.value = pos(e.value);
  b.exchange.basis = pos(e.basis);
  b.exchange.risk = EXCHANGE_RISK.some((r) => r.id === e.risk) ? e.risk : 'mid';
  b.exchange.realised = fin(e.realised);

  const c = raw.cipher || {};
  b.cipher.code = isGlyphRow(c.code) ? c.code : null;
  if (b.cipher.code && Array.isArray(c.guesses)) {
    b.cipher.guesses = c.guesses
      .filter((g) => g && isGlyphRow(g.guess))
      .slice(0, CIPHER_TRIES)
      .map((g) => ({ guess: g.guess, ...score(b.cipher.code, g.guess) }));
  }
  b.cipher.readyAt = pos(c.readyAt);
  b.cipher.solved = Math.floor(pos(c.solved));
  b.cipher.failed = Math.floor(pos(c.failed));
  b.cipher.earned = pos(c.earned);
  return b;
}

/** Mastermind scoring: exact = right glyph, right slot; near = right glyph, wrong slot. */
export function score(code, guess) {
  let exact = 0;
  const restCode = [], restGuess = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) exact++;
    else { restCode.push(code[i]); restGuess.push(guess[i]); }
  }
  let near = 0;
  for (const g of restGuess) {
    const k = restCode.indexOf(g);
    if (k !== -1) { near++; restCode.splice(k, 1); }
  }
  return { exact, near };
}

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class BackRoom {
  constructor(game) {
    this.game = game;
    this.exchangeClock = 0;
  }

  get s() { return this.game.state.backroom; }

  emit() { this.game.emit('backroom'); }

  // ── lifecycle ─────────────────────────────────────────────────────────

  tick(dt) {
    const g = this.game;
    for (const r of RACKETS) {
      if (!this.s.unlocked[r.id] && g.state.lifetime >= r.unlockAt) {
        this.s.unlocked[r.id] = true;
        g.log(`Back room: ${r.name} is open for business.`, 'good');
        g.emit('unlock', r.id);
        this.emit();
      }
    }
    if (this.s.unlocked.exchange) {
      // Markets only move while you're watching; a long gap is one step.
      this.exchangeClock += Math.min(dt, EXCHANGE_STEP_S * 3);
      while (this.exchangeClock >= EXCHANGE_STEP_S) {
        this.exchangeClock -= EXCHANGE_STEP_S;
        this.stepExchange();
      }
    }
  }

  nextLocked() {
    return RACKETS.find((r) => !this.s.unlocked[r.id]) || null;
  }

  // ── Dock Dice ─────────────────────────────────────────────────────────

  stakeAmount(id) {
    const t = DICE_STAKES.find((x) => x.id === id);
    return t ? Math.max(10, Math.round(this.game.power * t.seconds)) : 0;
  }

  get diceActive() { return this.s.dice.stake > 0; }

  get dicePot() { return this.s.dice.stake * this.s.dice.mult; }

  placeStake(id) {
    const d = this.s.dice;
    if (d.stake) return false;
    const amt = this.stakeAmount(id);
    if (!amt || !this.game.spend(amt)) return false;
    d.stake = amt;
    d.mult = 1;
    d.rolls = [];
    this.emit();
    return true;
  }

  /** Returns the face rolled, or 0 if no hand is in play. */
  roll() {
    const d = this.s.dice;
    if (!d.stake) return 0;
    const r = 1 + Math.floor(Math.random() * 6);
    d.rolls.push(r);
    if (r === 1) {
      d.lost += d.stake;
      this.game.log(`Dock dice: rolled a one. Lost ${fmt(d.stake)} cr.`, 'bad');
      d.stake = 0;
      d.mult = 1;
    } else {
      d.mult += r * DICE_STEP;
    }
    this.emit();
    return r;
  }

  cashOut() {
    const d = this.s.dice;
    if (!d.stake || d.rolls.length === 0) return 0;
    const pot = d.stake * d.mult;
    const profit = pot - d.stake;
    this.game.earn(pot);
    d.won += profit;
    d.best = Math.max(d.best, d.mult);
    this.game.log(`Dock dice: walked away ×${d.mult.toFixed(1)}, +${fmt(profit)} cr.`, 'good');
    d.stake = 0;
    d.mult = 1;
    this.emit();
    return pot;
  }

  // ── Warrant Exchange ──────────────────────────────────────────────────

  get leverage() {
    return EXCHANGE_RISK.find((r) => r.id === this.s.exchange.risk).leverage;
  }

  get exchangeCap() {
    return Math.max(1000, this.game.power * EXCHANGE_CAP_S);
  }

  stepExchange() {
    const e = this.s.exchange;
    const x = Math.log(e.index / 100);
    let dx = -REVERT * x + VOL * gauss();
    for (const n of NEWS) {
      if (Math.random() < n.p) {
        dx += n.shock;
        this.game.log(`Exchange: ${n.text}`, n.shock < 0 ? 'bad' : 'good');
        break;
      }
    }
    const next = Math.min(1000, Math.max(1, 100 * Math.exp(x + dx)));
    const ret = next / e.index - 1;
    e.index = next;
    e.history.push(next);
    if (e.history.length > EXCHANGE_HISTORY) e.history.shift();
    if (e.value > 0) {
      e.value = Math.max(0, e.value * (1 + this.leverage * ret));
      if (e.value < 1) {
        this.game.log('Exchange: your position was wiped out.', 'bad');
        e.realised -= e.basis;
        e.value = 0;
        e.basis = 0;
      }
    }
    this.emit();
  }

  /** fraction of current credits to put in, capped by the position limit. */
  buy(fraction) {
    const e = this.s.exchange;
    const room = Math.max(0, this.exchangeCap - e.value);
    const amt = Math.min(room, this.game.state.credits * fraction);
    if (amt < 1 || !this.game.spend(amt)) return 0;
    e.value += amt;
    e.basis += amt;
    this.emit();
    return amt;
  }

  sellAll() {
    const e = this.s.exchange;
    if (e.value <= 0) return 0;
    const pnl = e.value - e.basis;
    this.game.earn(e.value);
    e.realised += pnl;
    this.game.log(`Exchange: sold out for ${fmt(e.value)} cr (${pnl >= 0 ? '+' : '−'}${fmt(Math.abs(pnl))}).`, pnl >= 0 ? 'good' : 'bad');
    const out = e.value;
    e.value = 0;
    e.basis = 0;
    this.emit();
    return out;
  }

  setRisk(id) {
    const e = this.s.exchange;
    if (e.value > 0 || !EXCHANGE_RISK.some((r) => r.id === id)) return false;
    e.risk = id;
    this.emit();
    return true;
  }

  // ── Intercepts ────────────────────────────────────────────────────────

  get cipherReady() {
    return !this.s.cipher.code && Date.now() >= this.s.cipher.readyAt;
  }

  /** Payout if solved on attempt number `tries` (1-based). */
  cipherReward(tries) {
    return this.game.power * CIPHER_BASE_S * (1 + (CIPHER_TRIES - tries) * 0.25);
  }

  openIntercept() {
    if (!this.cipherReady) return false;
    const c = this.s.cipher;
    c.code = Array.from({ length: CIPHER_LENGTH }, () => Math.floor(Math.random() * CIPHER_GLYPHS.length));
    c.guesses = [];
    this.emit();
    return true;
  }

  guess(row) {
    const c = this.s.cipher;
    if (!c.code || !isGlyphRow(row)) return null;
    const result = { guess: row, ...score(c.code, row) };
    c.guesses.push(result);
    if (result.exact === CIPHER_LENGTH) {
      const reward = this.cipherReward(c.guesses.length);
      this.game.earn(reward);
      c.solved += 1;
      c.earned += reward;
      this.game.log(`Intercept cracked in ${c.guesses.length}. Sold the contents for ${fmt(reward)} cr.`, 'good');
      this.game.emit('cipher-solved', { reward, tries: c.guesses.length });
      this.closeIntercept();
    } else if (c.guesses.length >= CIPHER_TRIES) {
      c.failed += 1;
      this.game.log(`Intercept went stale. The key was ${c.code.map((i) => CIPHER_GLYPHS[i]).join('')}.`, 'bad');
      this.closeIntercept();
    }
    this.emit();
    return result;
  }

  closeIntercept() {
    const c = this.s.cipher;
    c.lastCode = c.code;
    c.code = null;
    c.readyAt = Date.now() + CIPHER_COOLDOWN_MS;
  }
}
