import { GameState } from './state.js';
import { CONFIG } from './config.js';
import { CREW_TYPES, UPGRADE_TYPES, CONTRACTS } from './data.js';

export class Game {
  constructor() {
    this.state = new GameState();
    this.crewTypes = JSON.parse(JSON.stringify(CREW_TYPES));
    this.upgradeTypes = UPGRADE_TYPES;
    this.contracts = CONTRACTS;
    
    this.snitchTimer = null;
    this.lastSaveTime = Date.now();
    this.autosaveEnabled = true;
    this.autosaveId = null;
    this.tickId = null;
    this.suppressSaves = false;
    
    this.onStateChange = null; // Callback for UI updates
    this.onToast = null;       // Callback for toast messages
  }

  init() {
    this.load();
    this.updateSnitchAutoclicker();
    this.applyUpgradeEffects();
    this.startAutosave();
    this.startGameLoop();
  }

  setCallbacks(onStateChange, onToast) {
    this.onStateChange = onStateChange;
    this.onToast = onToast;
  }

  notifyUI() {
    if (this.onStateChange) this.onStateChange(this);
  }

  showToast(message, type) {
    if (this.onToast) this.onToast(message, type);
  }

  // --- Logic Methods ---

  getCrewCost(crew) {
    return Math.floor(crew.baseCost * Math.pow(crew.scaling, crew.count));
  }

  getSnitchIntervalTicks(snitch) {
    if (snitch.count <= 0) return snitch.baseClickInterval;
    return 1 / Math.pow(2, snitch.count - 1);
  }

  getSnitchIntervalMs(snitch) {
    if (snitch.count <= 0) return null;
    return this.getSnitchIntervalTicks(snitch) * CONFIG.TICK_MS;
  }

  getUpgradeCost(upgrade) {
    const count = this.state.upgrades[upgrade.id] || 0;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.scaling, count));
  }

  getButtonValue(typeId) {
    const t = this.state.buttonTypes[typeId] || { base: 1, multiplier: 1 };
    return (t.base || 1) * (t.multiplier || 1);
  }

  getClickValue() {
    return this.getButtonValue('action');
  }

  canClick(typeId) {
    const cd = this.state.cooldowns[typeId] || { readyAt: 0 };
    return Date.now() >= (cd.readyAt || 0);
  }

  startCooldown(typeId) {
    if (!this.state.cooldowns[typeId]) return;
    const cd = this.state.cooldowns[typeId];
    const dur = cd.ms != null ? cd.ms : CONFIG.BASE_COOLDOWN_MS;
    cd.readyAt = Date.now() + dur;
    this.notifyUI();
  }

  // --- Actions ---

  clickAction() {
    if (!this.canClick('action')) return;
    this.state.credits += this.getClickValue();
    this.startCooldown('action');
    this.notifyUI();
  }

  hireCrew(crewId) {
    if (!this.canClick('hire')) return;
    
    const crew = this.crewTypes.find(c => c.id === crewId);
    if (!crew) return;
    
    const cost = this.getCrewCost(crew);
    if (this.state.credits < cost) return;
    
    this.state.credits -= cost;
    crew.count += 1;
    this.startCooldown('hire');
    
    if (crew.id === 'snitch') {
      this.updateSnitchAutoclicker();
      const interval = this.getSnitchIntervalTicks(crew);
      const tickText = Math.abs(interval - CONFIG.SINGLE_TICK_THRESHOLD) < CONFIG.TICK_INTERVAL_TOLERANCE ? "tick" : "ticks";
      this.showToast(`Hired ${crew.name}! Autoclicks every ${interval.toFixed(1)} ${tickText}`);
    } else {
      this.showToast(`Hired ${crew.name}! +${crew.perTick} credits/tick`);
    }
    
    this.notifyUI();
  }

  purchaseUpgrade(upgradeId) {
    const upgrade = this.upgradeTypes.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const cost = this.getUpgradeCost(upgrade);
    if (this.state.credits < cost) return;

    const count = this.state.upgrades[upgradeId] || 0;
    if (upgrade.maxCount && count >= upgrade.maxCount) return;

    this.state.credits -= cost;
    this.state.upgrades[upgradeId] = count + 1;
    
    this.applyUpgradeEffects();
    this.showToast(`Purchased ${upgrade.name}!`);
    this.notifyUI();
  }

  advanceContract() {
      if (!this.canClick('action')) return;
      if (!this.state.contractActive) return;
      
      const add = this.getClickValue();
      const contract = this.contracts[this.state.currentContract];
      this.state.contractProgress += add;
      this.checkAndCompleteContract(contract);
      
      this.startCooldown('action');
      this.notifyUI();
  }
  
  takeContract() {
      if (this.state.contractActive) return;
      this.state.contractActive = true;
      this.state.contractProgress = 0;
      this.notifyUI();
  }

  // --- Effects & Logic ---

  applyUpgradeEffects() {
    this.updateCooldownFromUpgrades();
    this.updateClickPowerFromUpgrades();
  }

  updateCooldownFromUpgrades() {
    const count = this.state.upgrades.reduceCooldown || 0;
    const linearFactor = count >= CONFIG.REDUCE_CD_MAX_COUNT ? 0 : Math.max(0, 1 - 0.05 * count);
    const now = Date.now();
    
    for (const key of Object.keys(this.state.cooldowns)) {
      const cd = this.state.cooldowns[key];
      if (!cd) continue;
      
      const base = cd.baseMs || CONFIG.BASE_COOLDOWN_MS;
      const oldMs = cd.ms || base;
      const newMs = linearFactor === 0 ? 0 : Math.max(100, Math.round(base * linearFactor));
      cd.ms = newMs;
      
      if (cd.readyAt && cd.readyAt > now) {
        if (newMs === 0) {
          cd.readyAt = now;
        } else {
          const remaining = cd.readyAt - now;
          const scaled = Math.round(remaining * (newMs / oldMs));
          cd.readyAt = now + Math.max(0, scaled);
        }
      }
    }
  }

  updateClickPowerFromUpgrades() {
    if (!this.state.buttonTypes.action) {
      this.state.buttonTypes.action = { base: 1, multiplier: 1 };
    }
    const count = this.state.upgrades.doubleClick || 0;
    this.state.buttonTypes.action.multiplier = Math.pow(2, count);
  }

  checkAndCompleteContract(contract) {
    if (this.state.contractProgress >= contract.goal) {
      this.completeContract(contract);
      return true;
    }
    return false;
  }

  completeContract(contract) {
    this.state.credits += contract.reward;
    this.state.contractActive = false;
    this.state.contractProgress = 0;
    this.showToast(`Contract completed! +${contract.reward} credits`);
  }

  updateSnitchAutoclicker() {
    const snitch = this.crewTypes[1];
    if (this.snitchTimer) {
      clearInterval(this.snitchTimer);
      this.snitchTimer = null;
    }
    
    const intervalMs = this.getSnitchIntervalMs(snitch);
    if (!intervalMs) return;
    
    this.snitchTimer = setInterval(() => {
      if (snitch.autoclickType === "action" && this.canClick('action')) {
        this.startCooldown('action');
        if (this.state.contractActive) {
          const contract = this.contracts[this.state.currentContract];
          this.state.contractProgress += this.getClickValue();
          this.checkAndCompleteContract(contract);
        } else {
          this.state.credits += this.getClickValue();
        }
        this.notifyUI();
      }
    }, intervalMs);
  }

  // --- Loops & Saves ---

  startGameLoop() {
    if (this.tickId) clearInterval(this.tickId);
    this.tickId = setInterval(() => {
      this.tick();
    }, CONFIG.TICK_MS);
  }

  tick() {
      this.state.ticks += 1;

      if (this.state.contractActive) {
        const contract = this.contracts[this.state.currentContract];
        let contractPerTick = 0;
        for (const crew of this.crewTypes) {
          contractPerTick += crew.count * crew.perTick;
        }
        this.state.contractProgress += contractPerTick;
        this.checkAndCompleteContract(contract);
      } else {
        let passivePerTick = 0;
        for (const crew of this.crewTypes) {
          passivePerTick += crew.count * crew.perTick;
        }
        this.state.unbanked += passivePerTick;

        const whole = Math.floor(this.state.unbanked);
        if (whole > 0) {
          this.state.credits += whole;
          this.state.unbanked -= whole;
        }
      }

      this.notifyUI();
  }

  startAutosave() {
    if (this.autosaveId) clearInterval(this.autosaveId);
    if (!this.autosaveEnabled) return;
    
    this.autosaveId = setInterval(() => {
      this.save();
    }, CONFIG.AUTOSAVE_INTERVAL_MS);
  }

  save() {
    if (this.suppressSaves) return;
    const saveObj = {
      state: this.state,
      crewCounts: this.crewTypes.map(c => ({ id: c.id, count: c.count, revealed: c.revealed })),
      timestamp: Date.now()
    };
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveObj));
    this.lastSaveTime = Date.now();
  }

  load() {
    const json = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!json) return;
    
    try {
      const data = JSON.parse(json);
      // Merge saved state with default state to handle schema changes
      Object.assign(this.state, data.state);
      
      // Restore crew counts
      if (data.crewCounts) {
        for (const savedCrew of data.crewCounts) {
          const local = this.crewTypes.find(c => c.id === savedCrew.id);
          if (local) {
            local.count = savedCrew.count;
            local.revealed = savedCrew.revealed;
          }
        }
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
  }

  resetSave() {
    this.suppressSaves = true;
    if (this.autosaveId) clearInterval(this.autosaveId);
    if (this.tickId) clearInterval(this.tickId);
    if (this.snitchTimer) clearInterval(this.snitchTimer);
    localStorage.removeItem(CONFIG.SAVE_KEY);
    location.reload();
  }
}
