import { CONFIG } from './config.js';
import { setNumberMode } from './format.js';

/**
 * Settings are validated field by field, so a corrupted or outdated entry
 * falls back to its default instead of breaking the page.
 */
const SCHEMA = {
  numbers:   { values: ['short', 'scientific', 'full'], default: 'short' },
  scanlines: { values: [true, false], default: true },
  motion:    { values: ['auto', 'full', 'reduced'], default: 'auto' },
  autosave:  { values: [true, false], default: true },
  hotkeys:   { values: [true, false], default: true },
};

export function loadSettings() {
  let raw = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG.SETTINGS_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
  } catch {
    try { localStorage.removeItem(CONFIG.SETTINGS_KEY); } catch { /* ignore */ }
  }
  const out = {};
  for (const [key, rule] of Object.entries(SCHEMA)) {
    out[key] = rule.values.includes(raw[key]) ? raw[key] : rule.default;
  }
  return out;
}

export function saveSettings(settings) {
  try { localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function applySettings(settings) {
  const root = document.documentElement;
  setNumberMode(settings.numbers);
  root.dataset.scanlines = settings.scanlines ? 'on' : 'off';
  const reduce = settings.motion === 'reduced'
    || (settings.motion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.motion = reduce ? 'reduced' : 'full';
}
