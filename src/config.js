export const CONFIG = Object.freeze({
  VERSION: '3.0.0',
  SAVE_KEY: 'bountyIdle.save.v3',
  LEGACY_SAVE_KEY: 'bountySaveV2',
  SETTINGS_KEY: 'bountyIdle.settings.v3',

  /** Simulation step. Logic is dt-based, so this only sets granularity. */
  TICK_MS: 100,
  AUTOSAVE_MS: 30_000,

  /** Offline progress is paid in full up to this cap. */
  OFFLINE_CAP_S: 8 * 60 * 60,
  OFFLINE_MIN_S: 30,

  HUNT_BASE_VALUE: 1,
  HUNT_BASE_COOLDOWN_MS: 1000,
  HUNT_MIN_COOLDOWN_MS: 250,

  /** Contract board unlocks once you employ this many crew in total. */
  CONTRACTS_UNLOCK_CREW: 10,
  CONTRACT_OFFERS: 3,
  CONTRACT_REFRESH_MS: 4 * 60 * 1000,

  /** Each point of reputation adds this much to all income. */
  REP_BONUS: 0.02,

  LOG_LIMIT: 60,
});
