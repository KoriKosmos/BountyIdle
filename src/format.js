const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

let mode = 'short';
export function setNumberMode(m) { mode = m; }

/**
 * Formats a number for display.
 *  short:      1.24M
 *  scientific: 1.24e6
 *  full:       1,240,512
 * Values under 1,000 keep up to `decimals` fractional digits.
 */
export function fmt(n, decimals = 0) {
  if (!Number.isFinite(n)) return '∞';
  const sign = n < 0 ? '−' : '';
  n = Math.abs(n);

  if (n < 1000) {
    const d = n > 0 && n < 10 ? decimals : Math.min(decimals, 1);
    return sign + trim(n.toFixed(d));
  }
  if (mode === 'full') return sign + Math.floor(n).toLocaleString('en-US');
  if (mode === 'scientific') {
    const e = Math.floor(Math.log10(n));
    return `${sign}${(n / 10 ** e).toFixed(2)}e${e}`;
  }
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  const scaled = n / 1000 ** tier;
  const d = scaled >= 100 ? 1 : 2;
  return `${sign}${trim(scaled.toFixed(d))}${SUFFIXES[tier]}`;
}

function trim(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** 3725 → "1h 2m", 75 → "1m 15s", 9 → "9s" */
export function duration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (!Number.isFinite(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function clock(date = new Date()) {
  return date.toTimeString().slice(0, 5);
}
