/**
 * Game Data Configuration
 * Contains all game constants, crew types, upgrades, and contracts
 */

export const GAME_CONFIG = {
  TICK_MS: 1000,
  BASE_HUNT_COOLDOWN_MS: 2000,
  REDUCE_CD_MAX_COUNT: 10,
  REDUCE_CD_PER_UPGRADE_PCT: 5,
  INITIAL_BANK_TARGET: 1,
  BANK_TARGET_MULTIPLIER: 1.5,
  BANK_REWARD_MULTIPLIER: 0.1,
  MAX_TOASTS: 5,
  TOAST_DURATION: 3000,
  AUTOSAVE_INTERVAL: 30000
};

export const CREW_TYPES = [
  {
    id: "novice",
    name: "Novice Hunter",
    baseCost: 20,
    scaling: 1.15,
    perTick: 0.5,
    count: 0,
    revealed: false,
    description: "A beginner bounty hunter who generates passive income",
    icon: "👤"
  },
  {
    id: "snitch",
    name: "Snitch",
    baseCost: 1000,
    scaling: 10,
    perTick: 0,
    count: 0,
    revealed: false,
    autoclickType: "action",
    baseClickInterval: 1,
    description: "Automatically clicks action buttons for you",
    icon: "🤖"
  }
];

export const UPGRADE_TYPES = [
  {
    id: "reduceCooldown",
    name: "Quick Draw",
    baseCost: 10,
    scaling: 1.15,
    description: "Reduces button cooldown by 5%",
    maxCount: GAME_CONFIG.REDUCE_CD_MAX_COUNT,
    icon: "⚡",
    effect: (gameState, count) => {
      const reduction = count * GAME_CONFIG.REDUCE_CD_PER_UPGRADE_PCT;
      const multiplier = 1 - (reduction / 100);
      
      Object.keys(gameState.state.cooldowns).forEach(type => {
        const cooldown = gameState.getCooldown(type);
        if (cooldown) {
          cooldown.ms = Math.floor(cooldown.baseMs * multiplier);
        }
      });
    }
  },
  {
    id: "doubleClick",
    name: "Double Shot",
    baseCost: 20,
    scaling: 2.5,
    description: "Doubles your click power",
    icon: "💥",
    effect: (gameState, count) => {
      const multiplier = Math.pow(2, count);
      gameState.setButtonMultiplier('action', multiplier);
    }
  }
];

export const CONTRACTS = [
  {
    id: "familiar-face",
    name: "A Familiar Face",
    description: "An old friend needs help with a bounty",
    details: "Complete this contract to earn a hefty reward and unlock new opportunities.",
    goal: 1000,
    reward: 2000,
    icon: "🤝"
  },
  {
    id: "stolen-goods",
    name: "Stolen Goods Recovery",
    description: "Retrieve valuable stolen merchandise",
    details: "A merchant's entire shipment was stolen. Track down the thieves and recover the goods.",
    goal: 2500,
    reward: 5000,
    icon: "📦"
  },
  {
    id: "dangerous-fugitive",
    name: "Dangerous Fugitive",
    description: "Capture a notorious criminal",
    details: "This one's dangerous. Bring backup and expect resistance.",
    goal: 5000,
    reward: 12000,
    icon: "⚠️"
  },
  {
    id: "corporate-espionage",
    name: "Corporate Espionage",
    description: "Investigate suspicious business activities",
    details: "A rival company is stealing trade secrets. Gather evidence discreetly.",
    goal: 10000,
    reward: 25000,
    icon: "🕵️"
  },
  {
    id: "gang-leader",
    name: "Gang Leader Takedown",
    description: "Dismantle an entire criminal organization",
    details: "Take down the leader and their entire operation. This is the big one.",
    goal: 25000,
    reward: 75000,
    icon: "👑"
  }
];

// Helper functions for game calculations
export function getCrewCost(crew) {
  return Math.floor(crew.baseCost * Math.pow(crew.scaling, crew.count));
}

export function getUpgradeCost(upgrade, currentCount) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.scaling, currentCount));
}

export function getSnitchIntervalTicks(snitch) {
  if (snitch.count <= 0) return snitch.baseClickInterval;
  return 1 / Math.pow(2, snitch.count - 1);
}

export function getSnitchIntervalMs(snitch) {
  if (snitch.count <= 0) return null;
  return getSnitchIntervalTicks(snitch) * GAME_CONFIG.TICK_MS;
}

export function formatNumber(num, decimals = 0) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatTime(ms) {
  if (ms < 1000) return ms + 'ms';
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const minutes = seconds / 60;
  return minutes.toFixed(1) + 'm';
}