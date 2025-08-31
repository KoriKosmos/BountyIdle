// Bounty Office - Refactored Game (V2)
// Optimized, responsive, modular JavaScript (ES Module)

const SAVE_KEY_V2 = 'bountySaveV2';
const LEGACY_SAVE_KEY = 'bountySaveV1';

// DOM refs
const el = {
  credits: () => document.getElementById('creditsValue'),
  clickPower: () => document.getElementById('clickPowerValue'),
  actionBtn: () => document.getElementById('actionButton'),
  actionCooldown: () => document.getElementById('actionCooldown'),
  crewList: () => document.getElementById('crewList'),
  upgradeList: () => document.getElementById('upgradeList'),
  contracts: () => document.getElementById('contractsContainer'),
  lastSaved: () => document.getElementById('lastSaved'),
  toastContainer: () => document.getElementById('toastContainer'),
  saveBtn: () => document.getElementById('manualSaveBtn'),
  resetBtn: () => document.getElementById('resetBtn'),
  exportBtn: () => document.getElementById('exportBtn'),
  importBtn: () => document.getElementById('importBtn'),
};

// Core state
const state = {
  credits: 0,
  clickPowerBase: 1,
  flags: {
    contractsUnlocked: false,
  },
  cooldowns: {
    action: { readyAt: 0, baseMs: 2500 },
  },
  upgrades: {
    reduceCooldown: 0,
    doubleClick: 0,
  },
  crew: {
    novice: 0,
    snitch: 0,
  },
  contracts: {
    activeId: null,
    startedCredits: 0,
  },
  lastSavedAt: 0,
};

const crewTypes = [
  {
    id: 'novice',
    name: 'Novice Hunter',
    baseCost: 10,
    costGrowth: 1.12,
    cps: 0.2,
    description: 'Generates passive credits.'
  },
  {
    id: 'snitch',
    name: 'Snitch',
    baseCost: 150,
    costGrowth: 1.15,
    autoClickEveryMs: 5000,
    description: 'Occasionally auto-investigates a lead.'
  },
];

const upgradeTypes = [
  {
    id: 'reduceCooldown',
    name: 'Sharper Instincts',
    baseCost: 100,
    costGrowth: 1.35,
    description: 'Reduce action cooldown by 8% per level.'
  },
  {
    id: 'doubleClick',
    name: 'Stronger Leads',
    baseCost: 120,
    costGrowth: 1.4,
    description: 'Doubles click power each level (x2, x4, ...).'
  },
];

const contracts = [
  { id: 'minor', name: 'Minor Bounty', target: 200, reward: 100, description: 'Collect 200 credits while active.' },
  { id: 'standard', name: 'Standard Contract', target: 1200, reward: 900, description: 'Collect 1.2k credits while active.' },
  { id: 'high', name: 'High Profile', target: 8000, reward: 7000, description: 'Collect 8k credits while active.' },
];

// Utility
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const now = () => Date.now();
const format = (n) => {
  if (n >= 1e12) return (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(2) + 'k';
  return Math.floor(n).toString();
};

const toast = (msg) => {
  const c = el.toastContainer();
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2500);
};

// Saving
function save() {
  try {
    const data = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY_V2, data);
    state.lastSavedAt = now();
    updateLastSaved();
    // Toast only when manual save is pressed; autosave path won't show toast
  } catch {}
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY_V2);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      Object.assign(state, d);
      // ensure all keys exist in case of older saves
      state.upgrades = Object.assign({ reduceCooldown: 0, doubleClick: 0 }, state.upgrades || {});
      state.crew = Object.assign({ novice: 0, snitch: 0 }, state.crew || {});
      state.cooldowns = Object.assign({ action: { readyAt: 0, baseMs: 2500 } }, state.cooldowns || {});
    } catch {}
  } else {
    migrateLegacy();
  }
}

function migrateLegacy() {
  // Best-effort migration for older saves (structure may differ)
  const raw = localStorage.getItem(LEGACY_SAVE_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    if (typeof d === 'object') {
      if (typeof d.state?.credits === 'number') state.credits = d.state.credits;
      if (Array.isArray(d.crewTypes)) {
        const novice = d.crewTypes.find(c => c.id === 'novice');
        const snitch = d.crewTypes.find(c => c.id === 'snitch');
        if (novice) state.crew.novice = novice.count || 0;
        if (snitch) state.crew.snitch = snitch.count || 0;
      }
      if (d.state?.upgrades) {
        state.upgrades.reduceCooldown = d.state.upgrades.reduceCooldown || 0;
        state.upgrades.doubleClick = d.state.upgrades.doubleClick || 0;
      }
      if (d.state?.flags?.contractsUnlocked) state.flags.contractsUnlocked = true;
      toast('Legacy save imported');
      save();
    }
  } catch {}
}

function updateLastSaved() {
  const elLast = el.lastSaved();
  if (!elLast) return;
  if (!state.lastSavedAt) {
    elLast.textContent = 'Never saved';
    return;
  }
  const secs = Math.max(0, Math.floor((now() - state.lastSavedAt) / 1000));
  elLast.textContent = `Last saved ${secs}s ago`;
}

// Derived values
function currentClickPower() {
  const multiplier = Math.pow(2, state.upgrades.doubleClick || 0);
  return state.clickPowerBase * multiplier;
}

function currentActionCooldownMs() {
  const levels = state.upgrades.reduceCooldown || 0;
  const factor = Math.pow(0.92, levels); // 8% faster per level
  return Math.max(250, Math.floor(state.cooldowns.action.baseMs * factor));
}

// Crew helpers
function crewCost(id, countOverride) {
  const type = crewTypes.find(c => c.id === id);
  const owned = countOverride ?? state.crew[id];
  return Math.floor(type.baseCost * Math.pow(type.costGrowth, owned));
}

function upgradeCost(id) {
  const type = upgradeTypes.find(u => u.id === id);
  const lvl = state.upgrades[id] || 0;
  return Math.floor(type.baseCost * Math.pow(type.costGrowth, lvl));
}

// Rendering
function renderCredits() {
  const e = el.credits();
  if (e) e.textContent = format(state.credits);
}

function renderStats() {
  const cp = el.clickPower();
  if (cp) cp.textContent = format(currentClickPower());
}

function renderCrew() {
  const node = el.crewList();
  if (!node) return;
  node.innerHTML = '';
  node.className = 'list';
  for (const type of crewTypes) {
    const cost = crewCost(type.id);
    const item = document.createElement('div');
    item.className = 'list-item';
    const details = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = `${type.name} ×${state.crew[type.id]}`;
    const subtitle = document.createElement('div');
    subtitle.className = 'item-subtitle';
    subtitle.textContent = `${type.description} • Cost: ${format(cost)}`;
    details.appendChild(title);
    details.appendChild(subtitle);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Hire';
    btn.disabled = state.credits < cost;
    btn.addEventListener('click', () => {
      if (state.credits >= cost) {
        state.credits -= cost;
        state.crew[type.id] += 1;
        if (type.id === 'snitch') updateSnitch();
        renderAll();
        saveSoon();
      }
    });
    item.appendChild(details);
    item.appendChild(btn);
    node.appendChild(item);
  }
}

function renderUpgrades() {
  const node = el.upgradeList();
  if (!node) return;
  node.innerHTML = '';
  node.className = 'list';
  for (const type of upgradeTypes) {
    const cost = upgradeCost(type.id);
    const item = document.createElement('div');
    item.className = 'list-item';
    const details = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    const lvl = state.upgrades[type.id] || 0;
    title.textContent = `${type.name} (Lv ${lvl})`;
    const subtitle = document.createElement('div');
    subtitle.className = 'item-subtitle';
    subtitle.textContent = `${type.description} • Cost: ${format(cost)}`;
    details.appendChild(title);
    details.appendChild(subtitle);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Buy';
    btn.disabled = state.credits < cost;
    btn.addEventListener('click', () => {
      if (state.credits >= cost) {
        state.credits -= cost;
        state.upgrades[type.id] = (state.upgrades[type.id] || 0) + 1;
        renderAll();
        saveSoon();
      }
    });
    item.appendChild(details);
    item.appendChild(btn);
    node.appendChild(item);
  }
}

function renderContracts() {
  const node = el.contracts();
  if (!node) return;
  node.innerHTML = '';
  node.className = 'contracts';

  if (!state.flags.contractsUnlocked) {
    const unlock = document.createElement('div');
    unlock.className = 'list-item';
    const text = document.createElement('div');
    text.innerHTML = '<div class="item-title">Contracts Locked</div><div class="item-subtitle">Reach 500 credits to unlock contracts.</div>';
    unlock.appendChild(text);
    node.appendChild(unlock);
    return;
  }

  const active = contracts.find(c => c.id === state.contracts.activeId) || null;
  for (const c of contracts) {
    const item = document.createElement('div');
    item.className = 'list-item';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = c.name;
    const subtitle = document.createElement('div');
    subtitle.className = 'item-subtitle';
    subtitle.textContent = `${c.description} • Reward: ${format(c.reward)}`;
    left.appendChild(title);
    left.appendChild(subtitle);

    const right = document.createElement('div');
    if (!active || active.id !== c.id) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Start';
      btn.disabled = !!active;
      btn.addEventListener('click', () => startContract(c));
      right.appendChild(btn);
    } else {
      const progress = Math.max(0, state.credits - state.contracts.startedCredits);
      const pct = clamp((progress / c.target) * 100, 0, 100);
      const wrapper = document.createElement('div');
      wrapper.style.width = '220px';
      wrapper.innerHTML = `<div class="progress"><span style="width:${pct}%"></span></div><div class="item-subtitle" style="margin-top:6px">${format(progress)} / ${format(c.target)}</div>`;
      right.appendChild(wrapper);

      if (progress >= c.target) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginLeft = '10px';
        btn.textContent = 'Complete';
        btn.addEventListener('click', () => completeContract(c));
        right.appendChild(btn);
      }
    }

    item.appendChild(left);
    item.appendChild(right);
    node.appendChild(item);
  }
}

function renderAction() {
  const btn = el.actionBtn();
  const cd = el.actionCooldown();
  if (!btn || !cd) return;
  const msLeft = state.cooldowns.action.readyAt - now();
  const ready = msLeft <= 0;
  btn.disabled = !ready;
  if (!ready) {
    cd.classList.remove('hidden');
    cd.textContent = `${Math.ceil(msLeft / 100) / 10}s`;
  } else {
    cd.classList.add('hidden');
    cd.textContent = '';
  }
}

function renderAll() {
  renderCredits();
  renderStats();
  renderCrew();
  renderUpgrades();
  renderContracts();
  renderAction();
}

// Contracts logic
function startContract(c) {
  if (state.contracts.activeId) return;
  state.contracts.activeId = c.id;
  state.contracts.startedCredits = state.credits;
  toast(`${c.name} started`);
  saveSoon();
  renderContracts();
}

function completeContract(c) {
  if (state.contracts.activeId !== c.id) return;
  const progress = Math.max(0, state.credits - state.contracts.startedCredits);
  if (progress < c.target) return;
  state.credits += c.reward;
  state.contracts.activeId = null;
  state.contracts.startedCredits = 0;
  toast(`${c.name} completed! +${format(c.reward)}`);
  renderAll();
  saveSoon();
}

// Action logic
function tryActionClick() {
  const msLeft = state.cooldowns.action.readyAt - now();
  if (msLeft > 0) return false;
  const gain = currentClickPower();
  state.credits += gain;
  state.cooldowns.action.readyAt = now() + currentActionCooldownMs();
  renderAll();
  return true;
}

// Passive income
let passiveId = 0;
function startPassive() {
  if (passiveId) clearInterval(passiveId);
  passiveId = setInterval(() => {
    const novice = crewTypes[0];
    const perSec = state.crew[novice.id] * novice.cps;
    if (perSec > 0) {
      state.credits += perSec;
      renderCredits();
    }
  }, 1000);
}

// Snitch auto clicker
let snitchId = 0;
function updateSnitch() {
  if (snitchId) clearInterval(snitchId);
  const count = state.crew.snitch || 0;
  if (count <= 0) return;
  const base = crewTypes[1].autoClickEveryMs;
  const interval = Math.max(500, Math.floor(base / (1 + count * 0.2)));
  snitchId = setInterval(() => {
    const ok = tryActionClick();
    if (ok) saveSoon();
  }, interval);
}

// Autosave and debounced save
let autosaveId = 0;
let saveSoonId = 0;
function startAutosave() {
  if (autosaveId) clearInterval(autosaveId);
  autosaveId = setInterval(() => save(), 30000);
}

function saveSoon() {
  if (saveSoonId) clearTimeout(saveSoonId);
  saveSoonId = setTimeout(() => save(), 1000);
}

// Event wiring
function bindControls() {
  el.actionBtn()?.addEventListener('click', () => {
    if (tryActionClick()) saveSoon();
  });

  el.saveBtn()?.addEventListener('click', () => {
    save();
    toast('Saved');
  });

  el.resetBtn()?.addEventListener('click', () => {
    if (!confirm('Reset all progress?')) return;
    localStorage.removeItem(SAVE_KEY_V2);
    location.reload();
  });

  el.exportBtn()?.addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bounty-save-v2.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Save exported');
  });

  el.importBtn()?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          Object.assign(state, data);
          renderAll();
          save();
          toast('Save imported');
        } catch {}
      };
      r.readAsText(file);
    };
    input.click();
  });

  // Spacebar to attempt action
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.code === 'Space') && !e.repeat) {
      e.preventDefault();
      if (tryActionClick()) saveSoon();
    }
  });
}

// Unlock checks
function checkUnlocks() {
  if (!state.flags.contractsUnlocked && state.credits >= 500) {
    state.flags.contractsUnlocked = true;
    toast('Contracts unlocked!');
    renderContracts();
  }
}

// Animation/refresh loop
function startRenderLoop() {
  const loop = () => {
    renderAction();
    updateLastSaved();
    checkUnlocks();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Dev menu (toggle with sequence "kori")
let devSeq = '';
let devOpen = false;
let devEl = null;

function ensureDevMenu() {
  if (devEl) return devEl;
  const menu = document.createElement('div');
  menu.style.position = 'fixed';
  menu.style.right = '20px';
  menu.style.top = '20px';
  menu.style.width = '300px';
  menu.style.background = '#202433';
  menu.style.border = '1px solid #2a2f45';
  menu.style.borderRadius = '12px';
  menu.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
  menu.style.padding = '14px';
  menu.style.zIndex = '1200';
  menu.style.display = 'none';

  menu.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-weight:700">Dev Menu</div>
      <button id="devClose" class="control-btn">×</button>
    </div>
    <div style="display:grid;gap:10px">
      <div>
        <div class="item-subtitle">Credits</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <input id="devCredits" type="number" style="flex:1;padding:8px;border-radius:8px;border:1px solid #2a2f45;background:#161a25;color:#e9e9ee" placeholder="amount" />
          <button id="devSetCredits" class="btn">Set</button>
        </div>
      </div>
      <div>
        <div class="item-subtitle">Crew</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <select id="devCrew" style="flex:1;padding:8px;border-radius:8px;border:1px solid #2a2f45;background:#161a25;color:#e9e9ee">
            <option value="novice">Novice</option>
            <option value="snitch">Snitch</option>
          </select>
          <input id="devCrewCount" type="number" style="width:90px;padding:8px;border-radius:8px;border:1px solid #2a2f45;background:#161a25;color:#e9e9ee" placeholder="#" />
          <button id="devSetCrew" class="btn">Set</button>
        </div>
      </div>
      <div>
        <div class="item-subtitle">Upgrades</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <select id="devUpgrade" style="flex:1;padding:8px;border-radius:8px;border:1px solid #2a2f45;background:#161a25;color:#e9e9ee">
            <option value="reduceCooldown">Reduce Cooldown</option>
            <option value="doubleClick">Double Click</option>
          </select>
          <input id="devUpgradeCount" type="number" style="width:90px;padding:8px;border-radius:8px;border:1px solid #2a2f45;background:#161a25;color:#e9e9ee" placeholder="#" />
          <button id="devSetUpgrade" class="btn">Set</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(menu);
  devEl = menu;

  menu.querySelector('#devClose')?.addEventListener('click', () => toggleDev(false));
  menu.querySelector('#devSetCredits')?.addEventListener('click', () => {
    const v = Number(menu.querySelector('#devCredits').value);
    if (!Number.isNaN(v)) {
      state.credits = Math.max(0, v);
      renderAll();
      saveSoon();
    }
  });
  menu.querySelector('#devSetCrew')?.addEventListener('click', () => {
    const id = menu.querySelector('#devCrew').value;
    const v = Number(menu.querySelector('#devCrewCount').value);
    if (!Number.isNaN(v)) {
      state.crew[id] = Math.max(0, Math.floor(v));
      renderAll();
      updateSnitch();
      saveSoon();
    }
  });
  menu.querySelector('#devSetUpgrade')?.addEventListener('click', () => {
    const id = menu.querySelector('#devUpgrade').value;
    const v = Number(menu.querySelector('#devUpgradeCount').value);
    if (!Number.isNaN(v)) {
      state.upgrades[id] = Math.max(0, Math.floor(v));
      renderAll();
      saveSoon();
    }
  });

  return menu;
}

function toggleDev(open) {
  ensureDevMenu();
  devOpen = open;
  devEl.style.display = open ? 'block' : 'none';
}

document.addEventListener('keydown', (e) => {
  if (e.key.length === 1) {
    devSeq += e.key.toLowerCase();
    if (devSeq.length > 4) devSeq = devSeq.slice(-4);
    if (devSeq === 'kori') {
      toggleDev(!devOpen);
      devSeq = '';
    }
  }
  if (e.key === 'Escape' && devOpen) toggleDev(false);
});

// Boot
function boot() {
  load();
  bindControls();
  startAutosave();
  startPassive();
  updateSnitch();
  renderAll();
  startRenderLoop();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});

window.addEventListener('load', boot);

// Update last-saved timer text every second even without state changes
setInterval(updateLastSaved, 1000);

