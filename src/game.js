import { CONFIG } from './config.js';
import { CREW, ALL_UPGRADES, CONTRACT_TIERS, CONTRACT_NAMES } from './data.js';
import { readSave, writeSave, clearSave, encodeSave, decodeSave } from './state.js';
import { fmt } from './format.js';

const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c]));
const UPGRADE_BY_ID = Object.fromEntries(ALL_UPGRADES.map((u) => [u.id, u]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * The simulation. Owns state, does all arithmetic, never touches the DOM.
 * The UI subscribes with `on(event, fn)` and reads derived values through
 * the getters below.
 */
export class Game {
  constructor() {
    this.listeners = new Map();
    this.state = null;
    this.derived = null;
    this.huntReadyAt = 0;
    this.autoHuntTimer = 0;
    this.lastFrame = 0;
    this.loopId = null;
    this.autosaveId = null;
    this.autosave = true;
    this.lastSavedAt = Date.now();
    this.saveLocked = false;
  }

  // ── events ────────────────────────────────────────────────────────────

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }

  emit(type, payload) {
    this.listeners.get(type)?.forEach((fn) => fn(payload));
  }

  log(text, tone = 'info') {
    this.emit('log', { text, tone, at: new Date() });
  }

  // ── lifecycle ─────────────────────────────────────────────────────────

  start() {
    const { state, migrated, fresh } = readSave();
    this.state = state;
    this.recompute();

    if (fresh) {
      this.log('Office lease signed. The desk is yours.', 'muted');
    } else if (migrated) {
      this.log('Old ledger recovered and transferred to the new books.', 'good');
    }
    this.applyOfflineProgress();

    this.lastFrame = performance.now();
    this.loopId = setInterval(() => this.step(), CONFIG.TICK_MS);
    this.setAutosave(this.autosave);
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });
  }

  step() {
    const now = performance.now();
    // A throttled or sleeping tab can deliver one long step. Pay it in full
    // (up to the offline cap) so returning to the tab loses nothing.
    const dt = Math.min(CONFIG.OFFLINE_CAP_S, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.tick(dt);
  }

  tick(dt) {
    const s = this.state;
    const income = this.derived.income * dt;

    if (s.contract.active) this.addContractProgress(income);
    else this.earn(income);

    const auto = this.derived.autoHuntMs;
    if (auto) {
      // The snitch only works while you're watching, same as offline rules.
      this.autoHuntTimer += Math.min(dt, 5) * 1000;
      if (this.autoHuntTimer >= auto) {
        const n = Math.floor(this.autoHuntTimer / auto);
        this.autoHuntTimer -= n * auto;
        this.resolveHunt(n, true);
      }
    }

    s.stats.playMs += dt * 1000;
    if (this.derived.income > s.stats.bestRate) s.stats.bestRate = this.derived.income;

    this.checkUnlocks();
    this.emit('tick', dt);
  }

  // ── derived values ────────────────────────────────────────────────────

  /** Rebuilds every multiplier from scratch. Called after any purchase. */
  recompute() {
    const s = this.state;
    let incomeMult = 1, huntMult = 1, huntFromIncome = 0, contractMult = 1, repMult = 1, cooldownCut = 0;
    const crewMult = Object.fromEntries(CREW.map((c) => [c.id, 1]));

    for (const [id, lvl] of Object.entries(s.upgrades)) {
      const e = UPGRADE_BY_ID[id]?.effect;
      if (!e || !lvl) continue;
      if (e.incomeMult) incomeMult *= e.incomeMult ** lvl;
      if (e.huntMult) huntMult *= e.huntMult ** lvl;
      if (e.huntFromIncome) huntFromIncome += e.huntFromIncome;
      if (e.contractMult) contractMult *= e.contractMult;
      if (e.repMult) repMult *= e.repMult;
      if (e.crewMult) crewMult[e.crewMult.id] *= e.crewMult.x ** lvl;
      if (e.cooldownStep) cooldownCut += e.cooldownStep * lvl;
    }

    const repBonus = 1 + s.rep * CONFIG.REP_BONUS * repMult;
    const crewRates = {};
    let income = 0;
    for (const c of CREW) {
      crewRates[c.id] = c.rate * crewMult[c.id] * incomeMult * repBonus;
      income += crewRates[c.id] * s.crew[c.id];
    }

    const cooldownMs = Math.max(
      CONFIG.HUNT_MIN_COOLDOWN_MS,
      CONFIG.HUNT_BASE_COOLDOWN_MS * (1 - cooldownCut),
    );

    const snitch = s.upgrades.snitch || 0;
    const autoHuntMs = snitch ? Math.max(cooldownMs, 4000 / 2 ** (snitch - 1)) : 0;

    this.derived = {
      income, crewRates, crewMult, cooldownMs, autoHuntMs, contractMult, repBonus,
      huntBase: CONFIG.HUNT_BASE_VALUE * huntMult * repBonus,
      huntFromIncome,
    };
    this.emit('change');
  }

  get huntValue() {
    const d = this.derived;
    return d.huntBase + d.income * d.huntFromIncome;
  }

  get crewTotal() {
    return Object.values(this.state.crew).reduce((a, b) => a + b, 0);
  }

  /** Rough "credits per second" a player can produce, used to size contracts. */
  get power() {
    const d = this.derived;
    const huntRate = (this.huntValue / (d.cooldownMs / 1000)) * 0.5;
    const autoRate = d.autoHuntMs ? this.huntValue / (d.autoHuntMs / 1000) : 0;
    return Math.max(0.5, d.income + huntRate + autoRate);
  }

  // ── economy ───────────────────────────────────────────────────────────

  earn(amount) {
    this.state.credits += amount;
    this.state.lifetime += amount;
  }

  spend(amount) {
    if (this.state.credits + 1e-9 < amount) return false;
    this.state.credits = Math.max(0, this.state.credits - amount);
    return true;
  }

  /** Total cost of the next `n` hires: geometric series. */
  crewCost(id, n = 1) {
    const c = CREW_BY_ID[id];
    const owned = this.state.crew[id];
    const first = c.cost * c.scaling ** owned;
    return first * (c.scaling ** n - 1) / (c.scaling - 1);
  }

  maxAffordable(id) {
    const c = CREW_BY_ID[id];
    const first = c.cost * c.scaling ** this.state.crew[id];
    const n = Math.floor(Math.log(this.state.credits * (c.scaling - 1) / first + 1) / Math.log(c.scaling));
    return Math.max(0, n);
  }

  /** amount: number | 'max'. Returns hires actually made. */
  hire(id, amount = 1) {
    if (!CREW_BY_ID[id]) return 0;
    const n = amount === 'max' ? this.maxAffordable(id) : amount;
    if (n < 1 || !this.spend(this.crewCost(id, n))) return 0;
    this.state.crew[id] += n;
    this.state.seen.crew[id] = true;
    this.recompute();
    this.emit('purchase', { kind: 'crew', id, n });
    return n;
  }

  upgradeLevel(id) {
    return this.state.upgrades[id] || 0;
  }

  upgradeMaxed(u) {
    return this.upgradeLevel(u.id) >= (u.kind === 'once' ? 1 : u.max);
  }

  upgradeCost(u) {
    return u.kind === 'once' ? u.cost : u.cost * u.scaling ** this.upgradeLevel(u.id);
  }

  meetsReq(u) {
    const r = u.req, s = this.state;
    if (!r) return true;
    if (r.lifetime && s.lifetime < r.lifetime) return false;
    if (r.crewTotal && this.crewTotal < r.crewTotal) return false;
    if (r.contracts && s.stats.contracts < r.contracts) return false;
    if (r.rep && s.rep < r.rep) return false;
    if (r.crew && s.crew[r.crew.id] < r.crew.n) return false;
    return true;
  }

  buyUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (!u || this.upgradeMaxed(u) || !this.meetsReq(u)) return false;
    if (!this.spend(this.upgradeCost(u))) return false;
    this.state.upgrades[id] = this.upgradeLevel(id) + 1;
    this.recompute();
    this.log(`Bought ${u.name}${u.kind === 'repeat' ? ` (lvl ${this.upgradeLevel(id)})` : ''}.`);
    this.emit('purchase', { kind: 'upgrade', id });
    return true;
  }

  // ── hunting ───────────────────────────────────────────────────────────

  get huntReady() {
    return performance.now() >= this.huntReadyAt;
  }

  /** 0 → just fired, 1 → ready. */
  get huntCharge() {
    const left = this.huntReadyAt - performance.now();
    return left <= 0 ? 1 : 1 - left / this.derived.cooldownMs;
  }

  hunt() {
    if (!this.huntReady) return false;
    this.huntReadyAt = performance.now() + this.derived.cooldownMs;
    this.resolveHunt(1, false);
    return true;
  }

  resolveHunt(times, auto) {
    const value = this.huntValue * times;
    if (this.state.contract.active) this.addContractProgress(value);
    else this.earn(value);
    if (auto) this.state.stats.autoHunts += times;
    else this.state.stats.hunts += times;
    this.emit('hunt', { value, auto });
  }

  // ── contracts ─────────────────────────────────────────────────────────

  makeOffer(tier) {
    const t = tier ?? pick(CONTRACT_TIERS);
    const first = pick(CONTRACT_NAMES.first);
    const last = pick(CONTRACT_NAMES.last);
    const goal = Math.max(50, Math.ceil(this.power * t.seconds));
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: `${first} ${last}`,
      alias: Math.random() < 0.55 ? pick(CONTRACT_NAMES.alias) : null,
      crime: pick(CONTRACT_NAMES.crime),
      tier: t.id,
      goal,
      reward: Math.ceil(goal * t.payout),
      rep: t.rep,
    };
  }

  refreshOffers(force = false) {
    const c = this.state.contract;
    const now = Date.now();
    if (!force && c.offers.length === CONFIG.CONTRACT_OFFERS && now - c.refreshedAt < CONFIG.CONTRACT_REFRESH_MS) return;
    // One of each tier keeps the board readable.
    c.offers = CONTRACT_TIERS.slice(0, CONFIG.CONTRACT_OFFERS).map((t) => this.makeOffer(t));
    c.refreshedAt = now;
    this.emit('offers');
  }

  takeContract(offerId) {
    const c = this.state.contract;
    if (c.active) return false;
    const offer = c.offers.find((o) => o.id === offerId);
    if (!offer) return false;
    c.active = { ...offer, progress: 0 };
    c.offers = c.offers.filter((o) => o.id !== offerId);
    this.log(`Took the contract on ${offer.name}. Crew output now goes to the hunt.`);
    this.emit('offers');
    return true;
  }

  abandonContract() {
    const c = this.state.contract;
    if (!c.active) return;
    this.log(`Dropped the contract on ${c.active.name}.`, 'bad');
    c.active = null;
    this.emit('offers');
  }

  addContractProgress(amount) {
    const a = this.state.contract.active;
    a.progress += amount;
    if (a.progress >= a.goal) {
      // Anything past the goal isn't wasted.
      const overflow = a.progress - a.goal;
      this.completeContract();
      if (overflow > 0) this.earn(overflow);
    }
  }

  completeContract() {
    const s = this.state;
    const a = s.contract.active;
    const reward = a.reward * this.derived.contractMult;
    s.contract.active = null;
    s.stats.contracts += 1;
    s.rep += a.rep;
    this.earn(reward);
    this.recompute();
    // Old offers were priced for a weaker office; draw fresh ones.
    this.refreshOffers(true);
    this.log(`${a.name} brought in. +${fmt(reward)} cr, +${a.rep} rep.`, 'good');
    this.emit('contract-complete', { contract: a, reward });
  }

  // ── unlocks ───────────────────────────────────────────────────────────

  checkUnlocks() {
    const s = this.state;
    if (!s.contract.unlocked && this.crewTotal >= CONFIG.CONTRACTS_UNLOCK_CREW) {
      s.contract.unlocked = true;
      this.log('Word gets around. The contract board is open.', 'good');
      this.emit('unlock', 'contracts');
    }
    if (s.contract.unlocked) this.refreshOffers();

    for (const c of CREW) {
      if (!s.seen.crew[c.id] && s.lifetime >= c.cost * 0.6) {
        s.seen.crew[c.id] = true;
        this.emit('change');
      }
    }
    for (const u of ALL_UPGRADES) {
      if (!s.seen.upgrades[u.id] && this.meetsReq(u) && s.lifetime >= u.cost * 0.5) {
        s.seen.upgrades[u.id] = true;
        this.emit('change');
      }
    }
  }

  // ── persistence ───────────────────────────────────────────────────────

  applyOfflineProgress() {
    const s = this.state;
    const away = (Date.now() - s.savedAt) / 1000;
    if (away < CONFIG.OFFLINE_MIN_S || this.derived.income <= 0) return;
    const seconds = Math.min(away, CONFIG.OFFLINE_CAP_S);
    const before = s.credits;
    const hadContract = s.contract.active?.name;
    const total = this.derived.income * seconds;
    if (s.contract.active) this.addContractProgress(total);
    else this.earn(total);
    this.emit('offline', {
      away, seconds, total,
      credits: s.credits - before,
      contractClosed: hadContract && !s.contract.active ? hadContract : null,
      capped: away > CONFIG.OFFLINE_CAP_S,
    });
  }

  save() {
    if (this.saveLocked || !this.state) return false;
    this.state.savedAt = Date.now();
    const ok = writeSave(this.state);
    if (ok) {
      this.lastSavedAt = Date.now();
      this.emit('saved');
    }
    return ok;
  }

  setAutosave(on) {
    this.autosave = on;
    clearInterval(this.autosaveId);
    this.autosaveId = on ? setInterval(() => this.save(), CONFIG.AUTOSAVE_MS) : null;
  }

  exportSave() {
    this.save();
    return encodeSave(this.state);
  }

  /** Throws on invalid input; on success replaces the whole state. */
  importSave(str) {
    const next = decodeSave(str);
    next.savedAt = Date.now();
    this.state = next;
    this.huntReadyAt = 0;
    this.autoHuntTimer = 0;
    this.recompute();
    this.save();
    this.log('Save imported.', 'good');
    this.emit('reset');
  }

  hardReset() {
    this.saveLocked = true;
    clearInterval(this.loopId);
    clearInterval(this.autosaveId);
    clearSave();
    location.reload();
  }
}
