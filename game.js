// game.js - Refactored Bounty Office logic
// Wrapped in an IIFE to prevent global namespace pollution
// TODO: Further modularize into separate classes/modules
(function(){
  'use strict';
  /* === Begin original inline logic extracted from index.html === */
  // Save key for localStorage
  const SAVE_KEY = "bountySaveV1";
  const BASE_HUNT_COOLDOWN_MS = 1000;
  const REDUCE_CD_MAX_COUNT = 20;
  const SINGLE_TICK_THRESHOLD = 1;
  const TICK_INTERVAL_TOLERANCE = 0.001;

  // Tick length in ms (global); configurable later
  const TICK_MS = 1000;

  // Crew, contracts, upgrades definitions (copied and trimmed)
  const crewTypes = [
    { id:"novice", name:"Novice Hunter", baseCost:20, scaling:1.15, perTick:0.5, count:0, revealed:false },
    { id:"snitch", name:"Snitch (autoclicker)", baseCost:1000, scaling:10, perTick:0, count:0, revealed:false, autoclickType:"action", baseClickInterval:1 },
  ];

  const contracts = [
    { id:"familiar-face", description:"A familiar face enters the office", details:"You meet an old friend who needs help with a bounty. Complete the contract to earn a hefty reward.", goal:1000, reward:2000 },
  ];

  const upgradeTypes = [
    { id:"reduceCooldown", name:"Reduce Cooldown", baseCost:10, scaling:1.15, description:"Reduces button click cooldown by 5%" },
    { id:"doubleClick", name:"Double Click Power", baseCost:20, scaling:2.5, description:"Multiplies click power by 2" },
  ];

  const state = {
    credits:0,
    ticks:0,
    unbanked:0,
    revealedUpgrades:{},
    buttonTypes:{ action:{ base:1, multiplier:1 } },
    cooldowns:{ action:{ baseMs:BASE_HUNT_COOLDOWN_MS, ms:BASE_HUNT_COOLDOWN_MS, readyAt:0 }, hire:{ baseMs:BASE_HUNT_COOLDOWN_MS, ms:BASE_HUNT_COOLDOWN_MS, readyAt:0 } },
    upgrades:{},
    flags:{ contractsUnlocked:false, contractsHintRemoved:false, upgradesRevealed:false },
    contractActive:false,
    contractProgress:0,
    currentContract:0,
  };

  // DOM helpers
  const $ = id => document.getElementById(id);
  const fmt0 = n => n.toLocaleString(undefined,{maximumFractionDigits:0});
  const fmt1 = n => n.toLocaleString(undefined,{minimumFractionDigits:1, maximumFractionDigits:1});

  /* Utility functions (trimmed) */
  function getCrewCost(crew){ return Math.floor(crew.baseCost * Math.pow(crew.scaling, crew.count)); }
  function getUpgradeCost(up){ const cnt = state.upgrades[up.id]||0; return Math.floor(up.baseCost*Math.pow(up.scaling,cnt)); }
  function getButtonValue(typeId){ const t=state.buttonTypes[typeId]||{base:1,multiplier:1}; return t.base*t.multiplier; }
  function getClickValue(){ return getButtonValue('action'); }
  function canClick(typeId){ const cd=state.cooldowns[typeId]||{readyAt:0}; return Date.now()>=cd.readyAt; }
  function startCooldown(typeId){ const cd=state.cooldowns[typeId]; if(!cd) return; const dur=cd.ms??BASE_HUNT_COOLDOWN_MS; cd.readyAt=Date.now()+dur; updateCooldownVisual(); }

  /* === UI update functions (condensed) === */
  function updateCreditsDisplay(){ $('creditsDisplay').textContent = fmt0(state.credits); }

  /* === Core game loop === */
  function tick(){
    state.ticks++;
    // Passive income from crew
    let earned=0;
    crewTypes.forEach(c=>{ if(c.count>0 && c.perTick){ earned += c.perTick * c.count; }});
    if(earned){ state.credits += earned; }

    updateCreditsDisplay();
  }

  let mainTimer=null;
  function startGameLoop(){ if(mainTimer) return; mainTimer = setInterval(tick, TICK_MS); }

  /* === Button handlers === */
  function onHuntClick(){ if(!canClick('action')) return; startCooldown('action'); state.credits += getClickValue(); updateCreditsDisplay(); }

  function setupEventListeners(){
    $('huntBtn').addEventListener('click', onHuntClick);
    $('manualSaveBtn').addEventListener('click', manualSave);
    $('resetBtn').addEventListener('click', resetGame);
    $('autosaveToggleBtn').addEventListener('click', toggleAutosave);
  }

  /* === Save / Load === */
  let suppressSaves=false;
  function saveState(){ if(suppressSaves) return; localStorage.setItem(SAVE_KEY, JSON.stringify({state, crewTypes})); $('lastSaved').textContent = 'Saved: ' + new Date().toLocaleTimeString(); }
  function loadState(){ try{ const data=JSON.parse(localStorage.getItem(SAVE_KEY)); if(!data) return; Object.assign(state, data.state); for(let i=0;i<crewTypes.length;i++){ Object.assign(crewTypes[i], data.crewTypes[i]); } }catch(e){ console.error('Failed to load save', e); }}
  function manualSave(){ saveState(); }
  function resetGame(){ if(!confirm('Reset game?')) return; suppressSaves=true; localStorage.removeItem(SAVE_KEY); location.reload(); }

  /* === Autosave === */
  let autosaveInterval=null;
  let autosaveOn=true;
  function startAutosave(){ autosaveInterval = setInterval(saveState, 30000); }
  function stopAutosave(){ clearInterval(autosaveInterval); autosaveInterval=null; }
  function toggleAutosave(){ autosaveOn = !autosaveOn; if(autosaveOn){ startAutosave(); this.classList.add('active'); this.textContent='Autosave ON'; } else { stopAutosave(); this.classList.remove('active'); this.textContent='Autosave OFF'; } }

  /* === Initialization === */
  function init(){
    loadState();
    updateCreditsDisplay();
    setupEventListeners();
    startGameLoop();
    startAutosave();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Placeholder: implement updateCooldownVisual etc.
  function updateCooldownVisual(){}

  /* === End of extracted logic === */
})();