import { CONFIG } from './config.js';
import { CREW, ALL_UPGRADES, CONTRACT_TIERS } from './data.js';
import { fmt, duration, clock } from './format.js';
import { loadSettings, saveSettings, applySettings } from './settings.js';
import { h, $, setText, toggle } from './dom.js';

const TIER_BY_ID = Object.fromEntries(CONTRACT_TIERS.map((t) => [t.id, t]));
const TEXT_HZ = 10;

const HUNT_COPY = [
  { at: 0,      kicker: 'Petty bounty',   title: 'Run down a skip' },
  { at: 50,     kicker: 'Small fry',      title: 'Collar a fare-dodger' },
  { at: 1e3,    kicker: 'Local warrant',  title: 'Shake down the docks' },
  { at: 5e4,    kicker: 'Ring warrant',   title: 'Raid a smuggler’s berth' },
  { at: 2e6,    kicker: 'Sector warrant', title: 'Board a runner mid-burn' },
  { at: 1e8,    kicker: 'Guild mandate',  title: 'Close the net' },
];

export class UI {
  constructor(game) {
    this.game = game;
    this.settings = loadSettings();
    this.buyAmount = 1;
    this.tab = 'crew';
    this.crewRows = new Map();
    this.upgradeSig = '';
    this.lastText = 0;
    this.lastAutoFloat = 0;
  }

  init() {
    applySettings(this.settings);
    this.game.setAutosave(this.settings.autosave);

    this.buildCrew();
    this.bindDesk();
    this.bindTabs();
    this.bindStatus();
    this.bindSettings();
    this.bindHotkeys();

    const g = this.game;
    g.on('log', (e) => this.addLog(e));
    g.on('change', () => this.structureDirty = true);
    g.on('offers', () => this.renderBoard());
    g.on('hunt', (e) => this.onHunt(e));
    g.on('purchase', (e) => this.onPurchase(e));
    g.on('contract-complete', (e) => this.toast(`Contract closed · +${fmt(e.reward)} cr`, 'good'));
    g.on('unlock', () => this.toast('Contract board unlocked', 'good'));
    g.on('offline', (e) => this.showOffline(e));
    g.on('saved', () => this.renderSaved());
    g.on('reset', () => { this.structureDirty = true; this.renderBoard(); });

    setText($('version'), `v${CONFIG.VERSION}`);
    // First paint happens on the first frame, after the game has loaded.
    this.structureDirty = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  // ── frame loop ────────────────────────────────────────────────────────

  frame(t) {
    this.renderCharge();
    if (this.structureDirty) {
      this.structureDirty = false;
      this.renderStructure();
      this.renderText();
    } else if (t - this.lastText > 1000 / TEXT_HZ) {
      this.lastText = t;
      this.renderText();
    }
    requestAnimationFrame((n) => this.frame(n));
  }

  renderStructure() {
    this.renderCrewVisibility();
    this.renderUpgrades();
    this.renderBoard();
  }

  renderText() {
    const g = this.game, s = g.state, d = g.derived;

    setText($('credits'), fmt(Math.floor(s.credits)));
    setText($('rate'), fmt(d.income, 1));
    toggle($('repReadout'), 'hidden', s.rep === 0);
    setText($('rep'), fmt(s.rep));
    setText($('repBonus'), `+${fmt((d.repBonus - 1) * 100, 0)}%`);
    document.title = `${fmt(Math.floor(s.credits))} cr · Bounty Office`;

    this.renderDesk();
    this.renderCrew();
    this.renderUpgradeAffordability();
    this.renderActiveContract();
    this.renderBoardMeta();
    if (this.tab === 'ledger') this.renderLedger();
    this.renderSaved();
  }

  // ── desk ──────────────────────────────────────────────────────────────

  bindDesk() {
    $('huntBtn').addEventListener('click', () => this.game.hunt());
    $('abandonBtn').addEventListener('click', () => {
      const btn = $('abandonBtn');
      if (btn.dataset.armed) {
        this.game.abandonContract();
      } else {
        btn.dataset.armed = '1';
        btn.textContent = 'Drop it?';
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Drop'; }, 2500);
      }
    });
  }

  renderCharge() {
    const g = this.game;
    const charge = g.huntCharge;
    $('huntCharge').style.transform = `scaleX(${charge})`;
    toggle($('huntBtn'), 'data-cooling', charge < 1);
  }

  renderDesk() {
    const g = this.game, s = g.state, d = g.derived;
    const contract = s.contract.active;
    const copy = HUNT_COPY.filter((c) => s.lifetime >= c.at).pop();

    setText($('huntKicker'), contract ? 'On contract' : copy.kicker);
    setText($('huntTitle'), contract ? `Chase ${contract.name.split(' ')[0]}` : copy.title);
    setText($('huntValue'), fmt(g.huntValue, 1));
    setText($('huntMeta'), contract ? 'Hunts feed the contract' : '');

    setText($('factCooldown'), `${(d.cooldownMs / 1000).toFixed(2)}s`);
    setText($('factAuto'), d.autoHuntMs ? `Every ${(d.autoHuntMs / 1000).toFixed(2)}s` : 'Not on payroll');
    setText($('factHunts'), fmt(s.stats.hunts + s.stats.autoHunts));
  }

  onHunt({ value, auto }) {
    const now = performance.now();
    if (auto) {
      if (now - this.lastAutoFloat < 220) return;
      this.lastAutoFloat = now;
    } else {
      const btn = $('huntBtn');
      btn.classList.remove('pulse');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('pulse');
    }
    const layer = $('floaters');
    const el = h('span', { class: `floater${auto ? ' auto' : ''}` }, `+${fmt(value, 1)}`);
    el.style.left = `${18 + Math.random() * 64}%`;
    layer.append(el);
    el.addEventListener('animationend', () => el.remove());
    if (layer.childElementCount > 14) layer.firstElementChild.remove();
  }

  // ── crew ──────────────────────────────────────────────────────────────

  buildCrew() {
    const list = $('crewList');
    for (const c of CREW) {
      const refs = {};
      const row = h('li', { class: 'crew', hidden: true },
        refs.btn = h('button', { class: 'crew-btn', type: 'button', onclick: () => this.hire(c.id) },
          h('span', { class: 'crew-info' },
            h('span', { class: 'crew-line' },
              h('span', { class: 'crew-name' }, c.name),
              refs.owned = h('span', { class: 'crew-owned' }, '0'),
            ),
            h('span', { class: 'crew-blurb' }, c.blurb),
            refs.yield = h('span', { class: 'crew-yield' }),
          ),
          h('span', { class: 'crew-buy' },
            refs.cost = h('span', { class: 'crew-cost' }),
            refs.qty = h('span', { class: 'crew-qty' }),
          ),
        ),
      );
      const teaser = h('li', { class: 'crew crew-locked', hidden: true },
        h('span', { class: 'crew-info' },
          h('span', { class: 'crew-name' }, 'Unknown applicant'),
          refs.lockHint = h('span', { class: 'crew-blurb' }),
        ),
      );
      list.append(row, teaser);
      this.crewRows.set(c.id, { row, teaser, ...refs });
    }

    $('buyAmount').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-amount]');
      if (!b) return;
      this.buyAmount = b.dataset.amount === 'max' ? 'max' : Number(b.dataset.amount);
      for (const x of $('buyAmount').children) x.setAttribute('aria-checked', String(x === b));
      this.renderCrew();
    });
  }

  hire(id) {
    const n = this.game.hire(id, this.buyAmount);
    if (!n) this.shake(this.crewRows.get(id).btn);
  }

  renderCrewVisibility() {
    const s = this.game.state;
    let teaserShown = false;
    for (const c of CREW) {
      const r = this.crewRows.get(c.id);
      const visible = s.seen.crew[c.id] || s.crew[c.id] > 0;
      toggle(r.row, 'hidden', !visible);
      const showTeaser = !visible && !teaserShown;
      toggle(r.teaser, 'hidden', !showTeaser);
      if (showTeaser) {
        teaserShown = true;
        setText(r.lockHint, `Shows up once you’ve earned ${fmt(Math.ceil(c.cost * 0.6))} cr in total.`);
      }
    }
  }

  renderCrew() {
    const g = this.game, s = g.state, d = g.derived;
    setText($('crewCount'), fmt(g.crewTotal));
    for (const c of CREW) {
      const r = this.crewRows.get(c.id);
      if (r.row.hidden) continue;
      const owned = s.crew[c.id];
      const n = this.buyAmount === 'max' ? Math.max(1, g.maxAffordable(c.id)) : this.buyAmount;
      const cost = g.crewCost(c.id, n);
      const affordable = s.credits >= cost;
      const each = d.crewRates[c.id];
      const total = each * owned;
      const share = d.income > 0 ? (total / d.income) * 100 : 0;

      setText(r.owned, fmt(owned));
      setText(r.cost, `${fmt(cost)} cr`);
      setText(r.qty, `Hire ×${fmt(n)}`);
      setText(r.yield, owned
        ? `${fmt(each, 2)}/s each · ${fmt(total, 1)}/s · ${share.toFixed(0)}% of income`
        : `${fmt(each, 2)}/s each`);
      r.btn.classList.toggle('affordable', affordable);
      r.btn.setAttribute('aria-disabled', String(!affordable));
      toggle(r.row, 'data-mult', d.crewMult[c.id] > 1);
    }
  }

  // ── upgrades ──────────────────────────────────────────────────────────

  availableUpgrades() {
    const g = this.game, s = g.state;
    return ALL_UPGRADES
      .filter((u) => s.seen.upgrades[u.id] && !g.upgradeMaxed(u) && g.meetsReq(u))
      .sort((a, b) => g.upgradeCost(a) - g.upgradeCost(b));
  }

  renderUpgrades() {
    const g = this.game;
    const list = this.availableUpgrades();
    const owned = ALL_UPGRADES.filter((u) => g.upgradeMaxed(u));
    const sig = list.map((u) => `${u.id}:${g.upgradeLevel(u.id)}`).join() + '|' + owned.length;
    if (sig === this.upgradeSig) return;
    this.upgradeSig = sig;

    const wrap = $('upgradeList');
    wrap.replaceChildren(...list.map((u) => this.upgradeCard(u)));
    toggle($('upgradeEmpty'), 'hidden', list.length > 0);

    toggle($('ownedWrap'), 'hidden', owned.length === 0);
    setText($('ownedCount'), owned.length);
    $('ownedList').replaceChildren(...owned.map((u) =>
      h('li', {}, h('b', {}, u.name), h('span', {}, u.desc))));
  }

  upgradeCard(u) {
    const g = this.game;
    const lvl = g.upgradeLevel(u.id);
    const pips = u.kind === 'repeat'
      ? h('span', { class: 'pips', 'aria-label': `Level ${lvl} of ${u.max}` },
          ...Array.from({ length: u.max }, (_, i) => h('i', { class: i < lvl ? 'on' : '' })))
      : h('span', { class: 'once' }, 'One-off');
    return h('button', {
      class: 'upgrade', type: 'button', dataset: { id: u.id, group: u.group.toLowerCase() },
      onclick: (e) => { if (!g.buyUpgrade(u.id)) this.shake(e.currentTarget); },
    },
      h('span', { class: 'up-top' },
        h('span', { class: 'up-group' }, u.group),
        h('span', { class: 'up-cost' }, `${fmt(g.upgradeCost(u))} cr`),
      ),
      h('span', { class: 'up-name' }, u.name),
      h('span', { class: 'up-desc' }, u.desc),
      pips,
    );
  }

  renderUpgradeAffordability() {
    const g = this.game, credits = g.state.credits;
    let any = false;
    for (const card of $('upgradeList').children) {
      const u = ALL_UPGRADES.find((x) => x.id === card.dataset.id);
      const ok = credits >= g.upgradeCost(u);
      card.classList.toggle('affordable', ok);
      card.setAttribute('aria-disabled', String(!ok));
      any ||= ok;
    }
    toggle($('upgradeDot'), 'hidden', !any || this.tab === 'upgrades');
  }

  // ── contracts ─────────────────────────────────────────────────────────

  renderBoard() {
    const g = this.game, c = g.state.contract;
    $('board').classList.toggle('is-locked', !c.unlocked);
    toggle($('boardLocked'), 'hidden', c.unlocked);
    toggle($('activeContract'), 'hidden', !c.active);
    toggle($('offers'), 'hidden', !c.unlocked);

    if (c.active) {
      const t = TIER_BY_ID[c.active.tier];
      setText($('activeTier'), t.label);
      $('activeTier').dataset.tier = t.id;
      setText($('activeName'), c.active.alias ? `${c.active.name} “${c.active.alias}”` : c.active.name);
      setText($('activeCrime'), c.active.crime);
    }

    $('offers').replaceChildren(...c.offers.map((o) => this.offerCard(o, !!c.active)));
  }

  offerCard(o, busy) {
    const t = TIER_BY_ID[o.tier];
    const g = this.game;
    return h('li', { class: 'offer', dataset: { tier: o.tier } },
      h('div', { class: 'offer-id' },
        h('div', { class: 'offer-head' },
          h('span', { class: 'offer-wanted' }, 'Wanted'),
          h('span', { class: 'tag', dataset: { tier: o.tier } }, t.label),
        ),
        h('h3', { class: 'offer-name' }, o.name),
        o.alias ? h('p', { class: 'offer-alias' }, `a.k.a. ${o.alias}`) : null,
        h('p', { class: 'offer-crime' }, o.crime),
      ),
      h('div', { class: 'offer-side' },
        h('p', { class: 'offer-reward' }, fmt(o.reward * g.derived.contractMult), h('small', {}, 'cr')),
        h('p', { class: 'offer-sub' },
          h('span', {}, `+${o.rep} rep`),
          h('span', { dataset: { eta: o.id } }, '—'),
        ),
        h('button', {
          class: 'btn primary', type: 'button', disabled: busy,
          title: busy ? 'Finish your current contract first' : null,
          onclick: () => g.takeContract(o.id),
        }, 'Take the job'),
      ),
    );
  }

  renderActiveContract() {
    const g = this.game, a = g.state.contract.active;
    if (!a) return;
    const pct = Math.min(1, a.progress / a.goal);
    $('activeBar').style.transform = `scaleX(${pct})`;
    setText($('activeProgress'), fmt(Math.floor(a.progress)));
    setText($('activeGoal'), fmt(a.goal));
    const eta = (a.goal - a.progress) / g.power;
    setText($('activeEta'), `~${duration(eta)} left`);
  }

  renderBoardMeta() {
    const g = this.game, c = g.state.contract;
    if (!c.unlocked) {
      const n = g.crewTotal, need = CONFIG.CONTRACTS_UNLOCK_CREW;
      $('boardLockedBar').style.transform = `scaleX(${Math.min(1, n / need)})`;
      setText($('boardLockedCount'), `${n} / ${need} crew`);
      setText($('boardMeta'), 'Locked');
      return;
    }
    const left = (c.refreshedAt + CONFIG.CONTRACT_REFRESH_MS - Date.now()) / 1000;
    setText($('boardMeta'), c.active ? `${g.state.stats.contracts} closed` : `New postings in ${duration(left)}`);
    for (const o of c.offers) {
      const el = document.querySelector(`[data-eta="${o.id}"]`);
      if (el) setText(el, `~${duration(o.goal / g.power)}`);
    }
  }

  // ── ledger ────────────────────────────────────────────────────────────

  renderLedger() {
    const g = this.game, s = g.state, d = g.derived;
    const rows = [
      ['Credits earned, all time', `${fmt(s.lifetime)} cr`],
      ['Best income', `${fmt(s.stats.bestRate, 1)} /s`],
      ['Each hunt pays', `${fmt(g.huntValue, 1)} cr`],
      ['Hunts by hand', fmt(s.stats.hunts)],
      ['Hunts by snitch', fmt(s.stats.autoHunts)],
      ['Crew on payroll', fmt(g.crewTotal)],
      ['Contracts closed', fmt(s.stats.contracts)],
      ['Reputation', `${fmt(s.rep)} (+${fmt((d.repBonus - 1) * 100)}% income)`],
      ['Contract payout bonus', `×${d.contractMult.toFixed(2)}`],
      ['Time at the desk', duration(s.stats.playMs / 1000)],
      ['Office opened', new Date(s.stats.startedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })],
    ];
    const el = $('ledger');
    if (el.childElementCount !== rows.length) {
      el.replaceChildren(...rows.map(() => h('div', {}, h('dt'), h('dd'))));
    }
    rows.forEach(([k, v], i) => {
      const row = el.children[i];
      setText(row.children[0], k);
      setText(row.children[1], v);
    });
  }

  // ── tabs ──────────────────────────────────────────────────────────────

  bindTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.setTab(tab.dataset.tab));
      tab.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        const next = tabs[(i + dir + tabs.length) % tabs.length];
        this.setTab(next.dataset.tab);
        next.focus();
      });
    });
  }

  setTab(name) {
    this.tab = name;
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const on = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      toggle($(tab.getAttribute('aria-controls')), 'hidden', !on);
    }
    this.renderText();
  }

  // ── log & toasts ──────────────────────────────────────────────────────

  addLog({ text, tone, at }) {
    const log = $('log');
    this.lastHire = null;
    log.prepend(h('li', { class: `log-item ${tone}` }, h('time', {}, clock(at)), h('span', {}, text)));
    while (log.childElementCount > CONFIG.LOG_LIMIT) log.lastElementChild.remove();
  }

  onPurchase(e) {
    if (e.kind === 'crew') {
      const c = CREW.find((x) => x.id === e.id);
      const last = this.lastHire;
      const now = Date.now();
      if (last && last.id === e.id && now - last.at < 8000 && last.el.isConnected) {
        // Fold rapid repeat hires into one log line.
        last.n += e.n;
        last.at = now;
        setText(last.el.lastChild, `Hired ${last.n} × ${c.name}.`);
      } else {
        this.addLog({ text: `Hired ${e.n > 1 ? `${e.n} × ` : ''}${c.name}.`, tone: 'info', at: new Date() });
        this.lastHire = { id: e.id, n: e.n, at: now, el: $('log').firstElementChild };
      }
      const r = this.crewRows.get(e.id);
      r.btn.classList.remove('flash');
      void r.btn.offsetWidth;
      r.btn.classList.add('flash');
    }
    this.renderText();
  }

  toast(text, tone = 'info') {
    const box = $('toasts');
    const el = h('div', { class: `toast ${tone}`, role: 'status' }, text);
    box.append(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, 3200);
    while (box.childElementCount > 3) box.firstElementChild.remove();
  }

  shake(el) {
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
  }

  showOffline(e) {
    setText($('offlineText'), `You were away for ${duration(e.away)}. The crew kept working.`);
    setText($('offlineAmount'), fmt(e.total));
    const notes = [];
    if (e.contractClosed) notes.push(`They closed the contract on ${e.contractClosed}.`);
    else if (this.game.state.contract.active) notes.push('Their output went to your open contract.');
    if (e.capped) notes.push(`Only the first ${duration(CONFIG.OFFLINE_CAP_S)} count.`);
    setText($('offlineNote'), notes.join(' '));
    $('offlineDialog').showModal();
    this.game.log(`Back after ${duration(e.away)}. Crew brought in ${fmt(e.total)} cr.`, 'good');
  }

  // ── status bar ────────────────────────────────────────────────────────

  bindStatus() {
    $('autosaveBtn').addEventListener('click', () => this.setSetting('autosave', !this.settings.autosave));
    $('saveNowBtn').addEventListener('click', () => {
      if (this.game.save()) this.toast('Saved', 'info');
    });
    this.renderAutosave();
  }

  renderAutosave() {
    const on = this.settings.autosave;
    $('autosaveBtn').setAttribute('aria-pressed', String(on));
    setText($('autosaveLabel'), on ? 'Autosave on' : 'Autosave off');
  }

  renderSaved() {
    const sec = Math.floor((Date.now() - this.game.lastSavedAt) / 1000);
    setText($('savedAgo'), sec < 5 ? 'Saved just now' : `Saved ${duration(sec)} ago`);
  }

  // ── settings ──────────────────────────────────────────────────────────

  setSetting(key, value) {
    this.settings[key] = value;
    saveSettings(this.settings);
    applySettings(this.settings);
    if (key === 'autosave') {
      this.game.setAutosave(value);
      this.renderAutosave();
    }
    this.syncSettingsForm();
    this.upgradeSig = '';
    this.structureDirty = true;
    this.renderBoard();
  }

  syncSettingsForm() {
    for (const seg of document.querySelectorAll('.seg[data-setting]')) {
      for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.value === this.settings[seg.dataset.setting]));
    }
    for (const box of document.querySelectorAll('input[data-setting]')) box.checked = !!this.settings[box.dataset.setting];
  }

  bindSettings() {
    const dlg = $('settingsDialog');
    $('settingsBtn').addEventListener('click', () => { this.syncSettingsForm(); dlg.showModal(); });

    for (const seg of document.querySelectorAll('.seg[data-setting]')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-value]');
        if (b) this.setSetting(seg.dataset.setting, b.dataset.value);
      });
    }
    for (const box of document.querySelectorAll('input[data-setting]')) {
      box.addEventListener('change', () => this.setSetting(box.dataset.setting, box.checked));
    }
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applySettings(this.settings));

    // Click on the backdrop closes any dialog.
    for (const d of document.querySelectorAll('dialog')) {
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    }

    // Export / import share one dialog.
    const saveDlg = $('saveDialog'), field = $('saveField'), err = $('saveError');
    let mode = 'export';
    $('exportBtn').addEventListener('click', () => {
      mode = 'export';
      setText($('saveTitle'), 'Export save');
      setText($('saveText'), 'Keep this somewhere safe. Paste it into Import to restore your office on any device.');
      setText($('saveConfirm'), 'Copy');
      setText(err, '');
      field.value = this.game.exportSave();
      field.readOnly = true;
      saveDlg.showModal();
      field.select();
    });
    $('importBtn').addEventListener('click', () => {
      mode = 'import';
      setText($('saveTitle'), 'Import save');
      setText($('saveText'), 'Paste a save string. This replaces your current office.');
      setText($('saveConfirm'), 'Import');
      setText(err, '');
      field.value = '';
      field.readOnly = false;
      saveDlg.showModal();
      field.focus();
    });
    $('saveCancel').addEventListener('click', () => saveDlg.close());
    $('saveConfirm').addEventListener('click', async () => {
      if (mode === 'export') {
        try {
          await navigator.clipboard.writeText(field.value);
          setText($('saveConfirm'), 'Copied');
        } catch {
          field.select();
          setText(err, 'Couldn’t reach the clipboard. The text is selected; copy it by hand.');
        }
        return;
      }
      try {
        this.game.importSave(field.value);
        saveDlg.close();
        dlg.close();
        this.toast('Save imported', 'good');
      } catch (e) {
        setText(err, 'That doesn’t look like a Bounty Office save.');
      }
    });

    const resetDlg = $('resetDialog'), resetField = $('resetField'), resetConfirm = $('resetConfirm');
    $('resetBtn').addEventListener('click', () => {
      resetField.value = '';
      resetConfirm.disabled = true;
      resetDlg.showModal();
      resetField.focus();
    });
    resetField.addEventListener('input', () => {
      resetConfirm.disabled = resetField.value.trim().toUpperCase() !== 'WIPE';
    });
    resetConfirm.addEventListener('click', () => this.game.hardReset());
  }

  bindHotkeys() {
    const isTyping = (t) => t.closest('input, textarea, select, [contenteditable]');
    const anyDialog = () => document.querySelector('dialog[open]');
    const isHuntKey = (e) => e.code === 'Space' || e.key === 'h' || e.key === 'H';

    document.addEventListener('keydown', (e) => {
      if (!this.settings.hotkeys || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || anyDialog()) return;
      if (isHuntKey(e)) {
        // Space on a focused button would also click it; we handle it here.
        e.preventDefault();
        if (!e.repeat) this.game.hunt();
        return;
      }
      const tab = { 1: 'crew', 2: 'upgrades', 3: 'ledger' }[e.key];
      if (tab) this.setTab(tab);
    });
    document.addEventListener('keyup', (e) => {
      if (this.settings.hotkeys && e.code === 'Space' && !isTyping(e.target) && !anyDialog()) e.preventDefault();
    });
  }
}
