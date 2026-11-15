import {
  RACKETS, DICE_STAKES, EXCHANGE_RISK, EXCHANGE_STEP_S, EXCHANGE_HISTORY,
  CIPHER_GLYPHS, CIPHER_LENGTH, CIPHER_TRIES,
} from './backroom.js';
import { fmt, duration } from './format.js';
import { h, $, setText, toggle } from './dom.js';

/** Which of the 9 pip cells are lit for each die face. */
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const W = 320, H = 110, PAD = 10;

export class BackRoomUI {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.br = game.backroom;
    this.tab = null;
    this.draft = [];
    this.rolling = false;
    this.hover = null;
  }

  init() {
    for (const r of RACKETS) {
      document.querySelector(`[data-blurb="${r.id}"]`).textContent = r.blurb;
    }
    this.buildTabs();
    this.bindDice();
    this.bindExchange();
    this.bindCipher();
    this.game.on('backroom', () => { this.dirty = true; });
    this.game.on('reset', () => { this.draft = []; this.dirty = true; });
    this.dirty = true;
  }

  get s() { return this.game.state.backroom; }

  // ── shell ─────────────────────────────────────────────────────────────

  buildTabs() {
    const bar = $('brTabs');
    for (const r of RACKETS) {
      bar.append(h('button', {
        role: 'tab', type: 'button', id: `brtab-${r.id}`, 'aria-controls': `br-${r.id}`,
        'aria-selected': 'false', tabindex: '-1', dataset: { racket: r.id }, hidden: true,
        onclick: () => this.setTab(r.id),
      }, r.name));
    }
    bar.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      const tabs = [...bar.querySelectorAll('[role="tab"]:not([hidden])')];
      const i = tabs.findIndex((t) => t.dataset.racket === this.tab);
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      this.setTab(next.dataset.racket);
      next.focus();
    });
  }

  setTab(id) {
    this.tab = id;
    for (const t of $('brTabs').children) {
      const on = t.dataset.racket === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      toggle($(`br-${t.dataset.racket}`), 'hidden', !on);
    }
    this.dirty = true;
    this.render();
  }

  /** Called by the main UI ~10×/s. */
  render() {
    const open = RACKETS.filter((r) => this.s.unlocked[r.id]);
    toggle($('backroom'), 'hidden', open.length === 0);
    if (!open.length) return;

    for (const t of $('brTabs').children) toggle(t, 'hidden', !this.s.unlocked[t.dataset.racket]);
    if (!this.tab || !this.s.unlocked[this.tab]) this.setTab(open[open.length - 1].id);

    const next = this.br.nextLocked();
    setText($('brNext'), next
      ? `Something else opens at ${fmt(next.unlockAt)} cr earned (${fmt(Math.min(100, (this.game.state.lifetime / next.unlockAt) * 100))}%).`
      : '');
    toggle($('brNext'), 'hidden', !next);
    setText($('brMeta'), `${open.length} of ${RACKETS.length} open`);

    if (this.tab === 'dice') this.renderDice();
    if (this.tab === 'exchange') this.renderExchange();
    if (this.tab === 'cipher') this.renderCipher();
    this.dirty = false;
  }

  // ── Dock Dice ─────────────────────────────────────────────────────────

  bindDice() {
    const box = $('diceStakes');
    for (const t of DICE_STAKES) {
      box.append(h('button', {
        class: 'stake', type: 'button', dataset: { stake: t.id },
        onclick: (e) => { if (!this.br.placeStake(t.id)) this.ui.shake(e.currentTarget); },
      }, h('span', { class: 'stake-label' }, t.label), h('span', { class: 'stake-amt' }, '—')));
    }
    $('diceRoll').addEventListener('click', () => this.rollDie());
    $('diceCash').addEventListener('click', () => {
      const pot = this.br.cashOut();
      if (pot) this.ui.toast(`Walked away with ${fmt(pot)} cr`, 'good');
    });
  }

  rollDie() {
    if (this.rolling || !this.br.diceActive) return;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (reduced) { this.showRoll(this.br.roll()); return; }

    // A short tumble before the real result lands.
    this.rolling = true;
    $('diceRoll').disabled = true;
    const die = $('die');
    die.classList.add('tumbling');
    let n = 0;
    const spin = setInterval(() => {
      this.paintDie(1 + Math.floor(Math.random() * 6));
      if (++n >= 6) {
        clearInterval(spin);
        die.classList.remove('tumbling');
        this.rolling = false;
        this.showRoll(this.br.roll());
      }
    }, 55);
  }

  showRoll(face) {
    this.paintDie(face);
    const die = $('die');
    die.classList.toggle('bust', face === 1);
    die.classList.remove('land');
    void die.offsetWidth;
    die.classList.add('land');
    this.lastFace = face;
    this.dirty = true;
    this.render();
  }

  paintDie(face) {
    const lit = PIPS[face] || [];
    [...$('die').children].forEach((pip, i) => pip.classList.toggle('on', lit.includes(i)));
    $('die').dataset.face = face;
  }

  renderDice() {
    const d = this.s.dice, active = this.br.diceActive;

    for (const b of $('diceStakes').children) {
      const amt = this.br.stakeAmount(b.dataset.stake);
      setText(b.lastChild, `${fmt(amt)} cr`);
      const ok = this.game.state.credits >= amt;
      b.classList.toggle('affordable', ok);
      b.setAttribute('aria-disabled', String(!ok));
    }
    toggle($('diceStakes'), 'hidden', active);
    toggle($('diceActions'), 'hidden', !active);
    if (!this.rolling) $('diceRoll').disabled = !active;
    $('diceCash').disabled = !active || d.rolls.length === 0;

    if (active) {
      setText($('dicePot'), `${fmt(this.br.dicePot)} cr`);
      setText($('diceMult'), `×${d.mult.toFixed(1)}`);
      const nextEv = (5 / 6) * (d.mult + 0.4) - d.mult;
      setText($('diceStatus'), d.rolls.length === 0
        ? `Stake of ${fmt(d.stake)} cr is on the crate. Roll.`
        : nextEv > 0 ? 'The odds still favour another roll.' : 'The odds now favour walking away.');
    } else {
      setText($('dicePot'), '—');
      setText($('diceMult'), '');
      setText($('diceStatus'), this.lastFace === 1 ? 'A one. The house takes the stake.' : 'Pick a stake to start a hand.');
    }
    $('die').classList.toggle('idle', !active && this.lastFace !== 1);

    const rolls = $('diceRolls');
    const sig = d.rolls.join();
    if (rolls.dataset.sig !== sig || !active) {
      rolls.dataset.sig = sig;
      rolls.replaceChildren(...(active ? d.rolls : []).map((r) => h('li', { class: r === 1 ? 'bust' : '' }, r)));
    }
    const net = d.won - d.lost;
    setText($('diceFoot'), `Lifetime ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} cr · best walk-away ×${d.best ? d.best.toFixed(1) : '—'}`);
  }

  // ── Exchange ──────────────────────────────────────────────────────────

  bindExchange() {
    const seg = $('exRisk');
    for (const r of EXCHANGE_RISK) {
      seg.append(h('button', {
        role: 'radio', type: 'button', dataset: { risk: r.id },
        onclick: (e) => { if (!this.br.setRisk(r.id)) this.ui.shake(seg); },
      }, `${r.label} ×${r.leverage}`));
    }
    for (const b of document.querySelectorAll('[data-buy]')) {
      b.addEventListener('click', () => { if (!this.br.buy(Number(b.dataset.buy))) this.ui.shake(b); });
    }
    $('exSell').addEventListener('click', () => this.br.sellAll());

    const wrap = $('exChartWrap');
    const move = (clientX) => {
      const r = $('exChart').getBoundingClientRect();
      const i = Math.round(((clientX - r.left) / r.width) * (EXCHANGE_HISTORY - 1));
      this.hover = Math.max(0, Math.min(EXCHANGE_HISTORY - 1, i));
      this.renderExchange();
    };
    wrap.addEventListener('pointermove', (e) => move(e.clientX));
    wrap.addEventListener('pointerdown', (e) => move(e.clientX));
    wrap.addEventListener('pointerleave', () => { this.hover = null; this.renderExchange(); });
  }

  renderExchange() {
    const e = this.s.exchange;
    const hist = e.history;
    const first = hist[0], last = hist[hist.length - 1];
    const delta = (last / first - 1) * 100;

    setText($('exIndex'), last.toFixed(1));
    setText($('exDelta'), `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}% · 3m`);
    $('exDelta').dataset.dir = delta >= 0 ? 'up' : 'down';
    setText($('exValue'), `${fmt(e.value)} cr`);
    const pnl = e.value - e.basis;
    setText($('exPnl'), e.value > 0 ? `${pnl >= 0 ? '+' : '−'}${fmt(Math.abs(pnl))}` : 'No position');
    $('exPnl').dataset.dir = e.value <= 0 ? '' : pnl >= 0 ? 'up' : 'down';

    for (const b of $('exRisk').children) {
      b.setAttribute('aria-checked', String(b.dataset.risk === e.risk));
      b.disabled = e.value > 0 && b.dataset.risk !== e.risk;
    }
    const room = this.br.exchangeCap - e.value;
    for (const b of document.querySelectorAll('[data-buy]')) b.disabled = room < 1 || this.game.state.credits < 1;
    $('exSell').disabled = e.value <= 0;
    setText($('exFoot'), `Position limit ${fmt(this.br.exchangeCap)} cr · realised ${e.realised >= 0 ? '+' : '−'}${fmt(Math.abs(e.realised))} cr`);

    // Chart: single series, one y-scale; par line for reference.
    let lo = Math.min(100, ...hist), hi = Math.max(100, ...hist);
    const span = Math.max(4, hi - lo);
    lo -= span * 0.12; hi += span * 0.12;
    const x = (i) => (i / (EXCHANGE_HISTORY - 1)) * W;
    const y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
    const pts = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    $('exLine').setAttribute('points', pts);
    $('exArea').setAttribute('d', `M0,${H} L${pts.replaceAll(' ', ' L')} L${W},${H} Z`);
    const py = y(100);
    $('exPar').setAttribute('y1', py);
    $('exPar').setAttribute('y2', py);
    $('exParLabel').style.top = `${(py / H) * 100}%`;

    const i = this.hover ?? EXCHANGE_HISTORY - 1;
    $('exDot').setAttribute('cx', x(i));
    $('exDot').setAttribute('cy', y(hist[i]));
    toggle($('exCross'), 'hidden', this.hover == null);
    $('exCross').setAttribute('x1', x(i));
    $('exCross').setAttribute('x2', x(i));
    const tip = $('exTip');
    toggle(tip, 'hidden', this.hover == null);
    if (this.hover != null) {
      const ago = (EXCHANGE_HISTORY - 1 - i) * EXCHANGE_STEP_S;
      tip.replaceChildren(h('b', {}, hist[i].toFixed(1)), h('span', {}, ago ? `${duration(ago)} ago` : 'now'));
      const pct = (x(i) / W) * 100;
      tip.style.left = `${Math.min(82, Math.max(18, pct))}%`;
    }
  }

  // ── Intercepts ────────────────────────────────────────────────────────

  bindCipher() {
    const keys = $('cipherKeys');
    CIPHER_GLYPHS.forEach((g, i) => {
      keys.append(h('button', {
        class: 'glyph-key', type: 'button', 'aria-label': `Symbol ${g}`,
        onclick: () => { if (this.draft.length < CIPHER_LENGTH) { this.draft.push(i); this.renderCipher(); } },
      }, g));
    });
    $('cipherBack').addEventListener('click', () => { this.draft.pop(); this.renderCipher(); });
    $('cipherSend').addEventListener('click', () => {
      if (this.draft.length !== CIPHER_LENGTH) { this.ui.shake($('cipherSlots')); return; }
      const res = this.br.guess(this.draft);
      this.draft = [];
      if (res?.exact === CIPHER_LENGTH) this.ui.toast('Intercept cracked', 'good');
      this.renderCipher();
    });
    $('cipherOpen').addEventListener('click', () => { this.draft = []; this.br.openIntercept(); });
  }

  renderCipher() {
    const c = this.s.cipher;
    const live = !!c.code;
    toggle($('cipherInput'), 'hidden', !live);
    toggle($('cipherIdle'), 'hidden', live);

    const slots = $('cipherSlots');
    if (slots.childElementCount !== CIPHER_LENGTH) {
      slots.replaceChildren(...Array.from({ length: CIPHER_LENGTH }, () => h('span', { class: 'slot' })));
    }
    [...slots.children].forEach((el, i) => {
      const v = this.draft[i];
      setText(el, v == null ? '' : CIPHER_GLYPHS[v]);
      el.classList.toggle('filled', v != null);
      el.classList.toggle('cursor', i === this.draft.length && live);
    });
    $('cipherSend').disabled = this.draft.length !== CIPHER_LENGTH;
    $('cipherBack').disabled = this.draft.length === 0;

    const board = $('cipherBoard');
    const sig = `${live}|${c.guesses.length}`;
    if (board.dataset.sig !== sig) {
      board.dataset.sig = sig;
      const rows = c.guesses.map((g, n) => h('li', { class: 'cipher-row' },
        h('span', { class: 'cipher-n' }, n + 1),
        h('span', { class: 'cipher-glyphs' }, ...g.guess.map((i) => h('span', { class: 'cell' }, CIPHER_GLYPHS[i]))),
        h('span', { class: 'pegs', 'aria-label': `${g.exact} exact, ${g.near} misplaced` },
          ...Array.from({ length: CIPHER_LENGTH }, (_, k) =>
            h('i', { class: k < g.exact ? 'peg exact' : k < g.exact + g.near ? 'peg near' : 'peg' }))),
      ));
      if (live) {
        for (let n = c.guesses.length; n < CIPHER_TRIES; n++) {
          rows.push(h('li', { class: `cipher-row blank${n === c.guesses.length ? ' current' : ''}` },
            h('span', { class: 'cipher-n' }, n + 1),
            h('span', { class: 'cipher-glyphs' }, ...Array.from({ length: CIPHER_LENGTH }, () => h('span', { class: 'cell' }))),
            h('span', { class: 'pegs' }),
          ));
        }
      }
      board.replaceChildren(...rows);
    }
    toggle(board, 'hidden', board.childElementCount === 0);

    if (live) {
      const tries = c.guesses.length + 1;
      setText($('brMeta'), `Worth ${fmt(this.br.cipherReward(tries))} cr if cracked now`);
    } else {
      const wait = (c.readyAt - Date.now()) / 1000;
      const ready = this.br.cipherReady;
      setText($('cipherIdleText'), ready
        ? `A fresh intercept is waiting. Cracking it on the first try is worth ${fmt(this.br.cipherReward(1))} cr.`
        : `Your informants are listening. Next intercept in ${duration(wait)}.`);
      $('cipherOpen').disabled = !ready;
    }
    setText($('cipherFoot'), `${c.solved} cracked · ${c.failed} lost · ${fmt(c.earned)} cr earned`);
  }
}
