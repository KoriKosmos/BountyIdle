import { CONFIG } from './config.js';
import { formatNumber } from './utils.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupDevMenuEvents(); // Moving this logic here too
    this.loadSettings();

    // Bind game callbacks
    this.game.setCallbacks(
      (gameInstance) => this.render(gameInstance),
      (msg, type) => this.showToast(msg, type)
    );

    // Initial render
    this.render(this.game);
    this.startCooldownVisualLoop();
  }

  cacheElements() {
    const ids = [
      'creditsDisplay', 'crewContainer', 'upgradesContainer', 
      'contractsSection', 'contractsContainer', 'huntBtn', 
      'huntValue', 'contractBtn', 'toastContainer',
      'devMenuPanel', 'settingsMenuPanel', 'settingsBtn',
      'closeSettingsBtn', 'fontSelect', 'crtStrengthSlider',
      'crtStrengthValue', 'crtScreen', 'crtCorners',
      'manualSaveBtn', 'autosaveToggleBtn', 'resetBtn', 'lastSaved'
    ];
    
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  render(game) {
    this.updateCredits(game);
    this.updateCrew(game);
    this.updateUpgrades(game);
    this.updateContracts(game);
    this.updateActionButtons(game);
    this.updateLastSaved(game);
  }

  // --- Specific Update Methods ---

  updateCredits(game) {
    if (this.elements.creditsDisplay) {
      this.elements.creditsDisplay.textContent = formatNumber(game.state.credits);
    }
  }

  updateCrew(game) {
    if (!this.elements.crewContainer) return;
    
    // Track which elements are active in this render cycle to remove stale ones
    const activeIds = new Set();

    for (const crew of game.crewTypes) {
       let shouldShow = crew.revealed;
       if (crew.id === 'snitch') {
         const reduceCooldownCount = game.state.upgrades.reduceCooldown || 0;
         shouldShow = crew.revealed || reduceCooldownCount >= CONFIG.REDUCE_CD_MAX_COUNT;
       } else {
         shouldShow = crew.revealed || game.state.credits >= game.getCrewCost(crew);
       }
       
       if (!shouldShow) continue;
       
       if (!crew.revealed) crew.revealed = true;

       activeIds.add(crew.id);
       
       // Check if element exists
       let section = this.elements.crewContainer.querySelector(`.crew-section[data-crew-id="${crew.id}"]`);
       
       const cost = game.getCrewCost(crew);
       const canAfford = game.state.credits >= cost;
       const canClick = game.canClick('hire');
       const disabled = !(canAfford && canClick);
       
       let description = crew.description;
       if (crew.id === 'snitch') {
         const interval = game.getSnitchIntervalTicks(crew);
         const tickText = Math.abs(interval - CONFIG.SINGLE_TICK_THRESHOLD) < CONFIG.TICK_INTERVAL_TOLERANCE ? "tick" : "ticks";
         description = `Autoclicks every ${interval.toFixed(1)} ${tickText}`;
       }

       if (!section) {
           // Create new
           section = document.createElement('div');
           section.className = 'crew-section';
           section.setAttribute('data-crew-id', crew.id);
           section.innerHTML = `
           <div class="crew-header">
             <h3 class="crew-name">${crew.name}</h3>
             <div class="crew-stats">
               <span class="crew-income-display"></span>
               <span class="crew-description-display"></span>
               <span class="crew-count-display"></span>
             </div>
           </div>
           <div class="crew-actions">
             <button class="btn purchase-btn" data-crew-id="${crew.id}" data-cooldown="hire">
               Hire ${crew.name}
             </button>
             <div class="crew-cost">
               <span class="text-secondary crew-cost-display"></span>
             </div>
           </div>
           `;
           this.elements.crewContainer.appendChild(section);
       }

       // Update Content
       const incomeDisplay = section.querySelector('.crew-income-display');
       if (incomeDisplay) {
            incomeDisplay.textContent = crew.perTick > 0 ? `+${(crew.count * crew.perTick).toFixed(1)} credits/tick` : '';
            incomeDisplay.style.display = crew.perTick > 0 ? '' : 'none';
       }
       
       const descDisplay = section.querySelector('.crew-description-display');
       if (descDisplay) descDisplay.textContent = description;
       
       const countDisplay = section.querySelector('.crew-count-display');
       if (countDisplay) countDisplay.textContent = `Hired: ${crew.count}`;
       
       const costDisplay = section.querySelector('.crew-cost-display');
       if (costDisplay) costDisplay.textContent = `Cost: ${cost}`;

       // Update Button State
       const btn = section.querySelector('button');
       if (btn) {
           if (disabled) btn.setAttribute('disabled', '');
           else btn.removeAttribute('disabled');
           
           if (!canAfford) btn.setAttribute('data-cost-blocked', 'true');
           else btn.removeAttribute('data-cost-blocked');
       }
    }

    // Remove stale elements
    const existing = this.elements.crewContainer.querySelectorAll('.crew-section');
    existing.forEach(el => {
        if (!activeIds.has(el.getAttribute('data-crew-id'))) {
            el.remove();
        }
    });

  }

  updateUpgrades(game) {
    if (!this.elements.upgradesContainer) return;
    
    const activeIds = new Set();

    for (const upgrade of game.upgradeTypes) {
      const count = game.state.upgrades[upgrade.id] || 0;
      const alreadyRevealed = game.state.revealedUpgrades[upgrade.id];
      const shouldShow = alreadyRevealed || count > 0 || game.state.credits >= upgrade.baseCost;

      if (!shouldShow) continue;

      if (!alreadyRevealed) {
        game.state.revealedUpgrades[upgrade.id] = true; 
      }
      
      activeIds.add(upgrade.id);

      let section = this.elements.upgradesContainer.querySelector(`.upgrade-section[data-upgrade-id="${upgrade.id}"]`);

      const cost = game.getUpgradeCost(upgrade);
      const canAfford = game.state.credits >= cost;
      const isMaxed = upgrade.maxCount && count >= upgrade.maxCount;
      const disabled = !canAfford || isMaxed;

      let extra = "";
      if (upgrade.id === 'reduceCooldown') {
        const net = Math.min(100, 5 * count);
        extra = ` <span class="text-accent">• Net: ${net}%</span>`;
      }
      
      if (!section) {
          section = document.createElement('div');
          section.className = 'upgrade-section';
          section.setAttribute('data-upgrade-id', upgrade.id);
          section.innerHTML = `
          <div class="upgrade-header">
            <span class="upgrade-name-display"></span>
            <span class="upgrade-cost-display"></span>
          </div>
          <div class="upgrade-description-display"></div>
          <button class="btn purchase-btn" data-upgrade-id="${upgrade.id}">
          </button>
          `;
          this.elements.upgradesContainer.appendChild(section);
      }
      
      // Update Classes
      if (isMaxed) section.classList.add('maxed');
      else section.classList.remove('maxed');

      // Update Texts
      const nameDisplay = section.querySelector('.upgrade-name-display');
      if (nameDisplay) nameDisplay.textContent = isMaxed ? `${upgrade.name} (Max)` : upgrade.name;
      
      const costDisplay = section.querySelector('.upgrade-cost-display');
      if (costDisplay) costDisplay.textContent = isMaxed ? '' : `Cost: ${cost}`;
      
      const descDisplay = section.querySelector('.upgrade-description-display');
      if (descDisplay) descDisplay.innerHTML = `${upgrade.description}${extra}`;
      
      // Update Button
      const btn = section.querySelector('button');
      if (btn) {
           btn.textContent = isMaxed ? 'Maxed' : 'Purchase';
           if (disabled) btn.setAttribute('disabled', '');
           else btn.removeAttribute('disabled');

           if (!canAfford && !isMaxed) btn.setAttribute('data-cost-blocked', 'true');
           else btn.removeAttribute('data-cost-blocked');
      }
    }
    
    // Cleanup
    const existing = this.elements.upgradesContainer.querySelectorAll('.upgrade-section');
    existing.forEach(el => {
        if (!activeIds.has(el.getAttribute('data-upgrade-id'))) {
            el.remove();
        }
    });
  }

  updateContracts(game) {
    const section = this.elements.contractsSection;
    const container = this.elements.contractsContainer;
    if (!section || !container) return;

    if (!game.state.flags.contractsUnlocked && game.crewTypes.some(c => c.count >= 10)) {
      game.state.flags.contractsUnlocked = true;
      this.showToast("Contracts unlocked!");
    }

    if (!game.state.flags.contractsUnlocked) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    
    // Warning text logic
    const warningElement = section.querySelector('.warning-text');
    if (warningElement && game.state.flags.contractsHintRemoved) {
      warningElement.style.display = 'none';
    }

    const contract = game.contracts[game.state.currentContract];
    if (!contract) return;

    if (!game.state.contractActive) {
      // Inactive State
      if (!container.querySelector('.contract-inactive-view')) {
          container.innerHTML = `
            <div class="contract-progress contract-inactive-view">
              <p class="contract-desc-display"></p>
              <button class="btn btn-contract" id="takeContractBtn">Take Contract</button>
            </div>
          `;
      }
      
      const desc = container.querySelector('.contract-desc-display');
      if (desc) desc.textContent = contract.description;
      
      // Re-attach event listener if we wiped the container (simplified approach: 
      // since the button ID is constant and event delegation is used in setupEventListeners, we don't need to re-bind)
      
    } else {
      // Active State
      let activeView = container.querySelector('.contract-active-view');
      if (!activeView) {
          container.innerHTML = `
            <div class="contract-progress contract-active-view">
              <p class="contract-details-display"></p>
              <div>
                 Progress: <strong id="contractProgressNum"></strong> 
                 <span class="contract-goal-display"></span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
            </div>
          `;
          activeView = container.querySelector('.contract-active-view');
      }

      const progressPercent = Math.min(100, (game.state.contractProgress / contract.goal) * 100);
      
      const details = activeView.querySelector('.contract-details-display');
      if (details) details.textContent = contract.details;
      
      const progressNum = activeView.querySelector('#contractProgressNum');
      if (progressNum) progressNum.textContent = formatNumber(game.state.contractProgress);
      
      const goalDisplay = activeView.querySelector('.contract-goal-display');
      if (goalDisplay) goalDisplay.textContent = `/ ${formatNumber(contract.goal)}`;
      
      const fill = activeView.querySelector('.progress-fill');
      if (fill) fill.style.width = `${progressPercent}%`;
    }
  }

  updateActionButtons(game) {
    if (this.elements.huntValue) {
      this.elements.huntValue.textContent = `+${formatNumber(game.getClickValue())} credit`;
    }

    const contractBtn = this.elements.contractBtn;
    if (contractBtn) {
      if (game.state.contractActive) {
        contractBtn.classList.remove("hidden");
      } else {
        contractBtn.classList.add("hidden");
      }
    }
  }

  updateLastSaved(game) {
      if (this.elements.lastSaved) {
          const sec = Math.floor((Date.now() - game.lastSaveTime) / 1000);
          if (sec < 5) this.elements.lastSaved.textContent = "Last saved just now";
          else this.elements.lastSaved.textContent = `Last saved ${sec}s ago`;
      }
  }

  // --- Visual Effects ---

  startCooldownVisualLoop() {
    const loop = () => {
      this.updateCooldownVisual();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateCooldownVisual() {
     const now = Date.now();
     const buttons = document.querySelectorAll('button[data-cooldown]');
     
     for (const btn of buttons) {
       const type = btn.getAttribute('data-cooldown') || 'action';
       const cd = this.game.state.cooldowns[type];
       if (!cd) continue;

       const total = cd.ms != null ? cd.ms : CONFIG.BASE_COOLDOWN_MS;
       const readyAt = cd.readyAt || 0;

       if (total === 0 || now >= readyAt) {
         btn.style.setProperty('--cooldown-width', '0%');
         // Only enable if not blocked by cost
         if (!btn.hasAttribute('data-cost-blocked')) {
            btn.disabled = false;
         }
       } else {
         const elapsed = Math.max(0, total - (readyAt - now));
         const pct = Math.max(0, Math.min(1, elapsed / total));
         btn.style.setProperty('--cooldown-width', (pct * 100).toFixed(1) + '%');
         btn.disabled = true;
       }
     }


  }

  showToast(message, type = "info") {
    const container = this.elements.toastContainer;
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Remove after delay
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, CONFIG.TOAST_DURATION_MS);

    // Limit max toasts
    while (container.children.length > CONFIG.MAX_TOASTS) {
        container.removeChild(container.firstChild);
    }
  }

  // --- Events ---

  setupEventListeners() {
      if (this.elements.huntBtn) {
          this.elements.huntBtn.addEventListener('click', () => this.game.clickAction());
      }
      
      if (this.elements.contractBtn) {
           this.elements.contractBtn.addEventListener('click', () => this.game.advanceContract());
      }

      // Delegate
      document.addEventListener('click', (e) => {
          const target = e.target;
          if (target.hasAttribute('data-crew-id')) {
              this.game.hireCrew(target.getAttribute('data-crew-id'));
          }
          if (target.hasAttribute('data-upgrade-id')) {
              this.game.purchaseUpgrade(target.getAttribute('data-upgrade-id'));
          }
          if (target.id === 'takeContractBtn') {
              this.game.takeContract();
          }
      });

      // Save Controls
      if (this.elements.manualSaveBtn) {
          this.elements.manualSaveBtn.addEventListener('click', () => {
              this.game.save();
              this.updateLastSaved(this.game);
              this.showToast("Game manually saved!", "manual-save");
          });
      }
      
      if (this.elements.autosaveToggleBtn) {
          this.elements.autosaveToggleBtn.addEventListener('click', () => {
              this.game.autosaveEnabled = !this.game.autosaveEnabled;
              this.elements.autosaveToggleBtn.textContent = this.game.autosaveEnabled ? "Autosave ON" : "Autosave OFF";
              this.elements.autosaveToggleBtn.classList.toggle("btn-active", this.game.autosaveEnabled);
              
              if (this.game.autosaveEnabled) this.game.startAutosave();
              else if (this.game.autosaveId) clearInterval(this.game.autosaveId);
          });
      }
      
      if (this.elements.resetBtn) {
           let resetPressCount = 0;
           this.elements.resetBtn.addEventListener('click', () => {
               resetPressCount++;
               if (resetPressCount < 3) {
                   this.elements.resetBtn.textContent = `Reset Save (${3 - resetPressCount} more)`;
                   setTimeout(() => {
                       resetPressCount = 0;
                       this.elements.resetBtn.textContent = "Reset Save";
                   }, 2000);
                   return;
               }
               this.game.resetSave();
           });
      }
  }

  // --- Settings (Simplified for this file) ---
  
  loadSettings() {
      // Just reproducing the basics to keep parity
      const settings = JSON.parse(localStorage.getItem("bountyIdle_settings") || "{}");
      if (settings.fontMode) document.body.classList.add(`font-${settings.fontMode}`);
      if (settings.crtStrength !== undefined) {
          document.documentElement.style.setProperty("--crt-strength", settings.crtStrength);
          this.updateCrtWarping(settings.crtStrength);
      }
  }

  updateCrtWarping(strength) {
      if (!this.elements.crtScreen || !this.elements.crtCorners) return;
      const intensity = strength / 100;
      const screenRotation = 0.3 + (intensity * 0.4);
      const screenPerspective = 1500 + (intensity * 500);
      this.elements.crtScreen.style.transform = `perspective(${screenPerspective}px) rotateX(${screenRotation}deg)`;
      
      const cornerRotationX = 0.5 + (intensity * 0.5);
      const cornerRotationY = 0.3 + (intensity * 0.4);
      const cornerPerspective = 800 + (intensity * 400);
      
      this.elements.crtCorners.style.transform = `perspective(${cornerPerspective}px) rotateX(${cornerRotationX}deg) rotateY(${cornerRotationY}deg)`;
  }
  
  setupSettingsEvents() {
      // Placeholder for full settings impl if needed, 
      // but for refactor we focus on functionality.
      // Assuming existing HTML structure remains.
      if (this.elements.settingsBtn) {
          this.elements.settingsBtn.addEventListener('click', () => {
              this.elements.settingsMenuPanel.classList.remove('hidden');
          });
      }
      if (this.elements.closeSettingsBtn) {
          this.elements.closeSettingsBtn.addEventListener('click', () => {
              this.elements.settingsMenuPanel.classList.add('hidden');
          });
      }
  }
  
  // --- Dev Menu Placeholder ---
  setupDevMenuEvents() {
      // Minimal dev menu support
       document.addEventListener('keydown', (e) => {
           if (e.ctrlKey && e.shiftKey && e.key === 'D') {
               if (this.elements.devMenuPanel) this.elements.devMenuPanel.classList.remove('hidden');
           }
       });
       const closeDev = document.getElementById('closeDevMenuBtn');
       if (closeDev) {
           closeDev.addEventListener('click', () => {
               if (this.elements.devMenuPanel) this.elements.devMenuPanel.classList.add('hidden');
           });
       }
       // Dev buttons
       const devBtns = document.querySelectorAll('.btn-dev-action');
       devBtns.forEach(btn => {
           btn.addEventListener('click', () => {
               const action = btn.getAttribute('data-dev-action');
               if (action === 'addCredits') {
                   this.game.state.credits += 1000;
                   this.game.notifyUI();
               }
           });
       });
  }
}
