// Game Data
import { CONFIG } from './config.js';

export const CREW_TYPES = [
  {
    id: "novice",
    name: "Novice Hunter",
    baseCost: 20,
    scaling: 1.15,
    perTick: 0.5,
    count: 0,
    revealed: false,
    description: "Basic bounty hunter"
  },
  {
    id: "snitch",
    name: "Snitch (Autoclicker)",
    baseCost: 1000,
    scaling: 10,
    perTick: 0,
    count: 0,
    revealed: false,
    autoclickType: "action",
    baseClickInterval: 1,
    description: "Automatically clicks for you"
  }
];

export const UPGRADE_TYPES = [
  {
    id: "reduceCooldown",
    name: "Reduce Cooldown",
    baseCost: 10,
    scaling: 1.15,
    description: "Reduces button click cooldown by 5%",
    maxCount: CONFIG.REDUCE_CD_MAX_COUNT
  },
  {
    id: "doubleClick",
    name: "Double Click Power",
    baseCost: 20,
    scaling: 2.5,
    description: "Multiplies click power by 2"
  }
];

export const CONTRACTS = [
  {
    id: "familiar-face",
    description: "A familiar face enters the office",
    details: "You meet an old friend who needs help with a bounty. Complete the contract to earn a hefty reward.",
    goal: 1000,
    reward: 2000
  }
];
