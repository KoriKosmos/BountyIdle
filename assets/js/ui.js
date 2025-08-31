/**
 * UI Manager
 * Handles all UI updates, animations, and user interactions
 */

import { formatTime, getCrewCost, getUpgradeCost } from './gameData.js';
import { performance } from './performance.js';

export class UIManager {
  constructor(gameEngine) {
    this.game = gameEngine;
    this.elements = {};
    this.toastCounter = 0;
    this.activeToasts = new Map();
    
    // Performance optimizations
    this.this.formatNumber = performance.createNumberFormatter();
    this.updateUI = performance.throttle(this._updateUI.bind(this), 100);
    
    // Bind callbacks
    this.game.onUpdate = () => this.updateUI();
    this.game.onToast = (message, type) => this.showToast(message, type);
    this.game.onCooldownUpdate = (type, progress, ready) => this.updateCooldown(type, progress, ready);
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.updateUI();
    this.initializeAnimations();
  }

  cacheElements() {
    // Main elements
    this.elements.credits = document.getElementById('credits');
    this.elements.creditsPerTick = document.getElementById('creditsPerTick');
    this.elements.lastSaved = document.getElementById('lastSaved');
    
    // Buttons
    this.elements.huntBtn = document.getElementById('huntBtn');
    this.elements.hireBtn = document.getElementById('hireBtn');
    this.elements.snitchHireBtn = document.getElementById('snitchHireBtn');
    this.elements.contractClickBtn = document.getElementById('contractClickBtn');
    this.elements.takeContractBtn = document.getElementById('takeContractBtn');
    this.elements.manualSaveBtn = document.getElementById('manualSaveBtn');
    this.elements.autosaveToggleBtn = document.getElementById('autosaveToggleBtn');
    this.elements.resetBtn = document.getElementById('resetBtn');
    
    // Sections
    this.elements.crewSection = document.getElementById('crewSection');
    this.elements.contractsSection = document.getElementById('contractsSection');
    this.elements.upgradesSection = document.getElementById('upgradesSection');
    this.elements.bankingSection = document.getElementById('bankingSection');
    
    // Crew elements
    this.elements.noviceCount = document.getElementById('noviceCount');
    this.elements.noviceCost = document.getElementById('noviceCost');
    this.elements.snitchCount = document.getElementById('snitchCount');
    this.elements.snitchCost = document.getElementById('snitchCost');
    this.elements.snitchCard = document.getElementById('snitchCard');
    
    // Contract elements
    this.elements.contractTitle = document.getElementById('contractTitle');
    this.elements.contractDescription = document.getElementById('contractDescription');
    this.elements.contractProgress = document.getElementById('contractProgress');
    this.elements.contractProgressBar = document.getElementById('contractProgressBar');
    this.elements.contractReward = document.getElementById('contractReward');
    this.elements.activeContract = document.getElementById('activeContract');
    this.elements.availableContract = document.getElementById('availableContract');
    
    // Banking elements
    this.elements.unbanked = document.getElementById('unbanked');
    this.elements.bankTarget = document.getElementById('bankTarget');
    this.elements.bankProgress = document.getElementById('bankProgress');
    this.elements.bankReward = document.getElementById('bankReward');
    
    // Upgrades container
    this.elements.upgradesGrid = document.getElementById('upgradesGrid');
    
    // Toast container
    this.elements.toastContainer = document.getElementById('toastContainer');
  }

  bindEvents() {
    // Main action button
    this.elements.huntBtn?.addEventListener('click', () => {
      this.game.performAction('action');
    });
    
    // Hire buttons
    this.elements.hireBtn?.addEventListener('click', () => {
      this.game.hireCrew('novice');
    });
    
    this.elements.snitchHireBtn?.addEventListener('click', () => {
      this.game.hireCrew('snitch');
    });
    
    // Contract buttons
    this.elements.contractClickBtn?.addEventListener('click', () => {
      this.game.performAction('action');
    });
    
    this.elements.takeContractBtn?.addEventListener('click', () => {
      this.game.takeContract();
      this.updateUI();
    });
    
    // Save buttons
    this.elements.manualSaveBtn?.addEventListener('click', () => {
      this.game.gameState.save();
      this.showToast('Game saved!', 'success');
    });
    
    this.elements.autosaveToggleBtn?.addEventListener('click', () => {
      const enabled = this.game.gameState.toggleAutosave();
      this.elements.autosaveToggleBtn.textContent = enabled ? 'Autosave ON' : 'Autosave OFF';
      this.elements.autosaveToggleBtn.classList.toggle('disabled', !enabled);
    });
    
    // Reset button with confirmation
    let resetPressCount = 0;
    this.elements.resetBtn?.addEventListener('click', () => {
      resetPressCount++;
      if (resetPressCount < 3) {
        this.elements.resetBtn.textContent = `Reset (${3 - resetPressCount} more)`;
        this.elements.resetBtn.classList.add('danger');
        setTimeout(() => {
          resetPressCount = 0;
          this.elements.resetBtn.textContent = 'Reset Game';
          this.elements.resetBtn.classList.remove('danger');
        }, 2000);
      } else {
        if (confirm('Are you sure you want to reset all progress?')) {
          this.game.reset();
          resetPressCount = 0;
          this.elements.resetBtn.textContent = 'Reset Game';
          this.elements.resetBtn.classList.remove('danger');
        }
      }
    });
    
    // Upgrade purchases (delegated)
    this.elements.upgradesGrid?.addEventListener('click', (e) => {
      const upgradeCard = e.target.closest('.upgrade-card');
      if (!upgradeCard) return;
      
      const upgradeId = upgradeCard.dataset.upgradeId;
      if (upgradeId) {
        this.game.purchaseUpgrade(upgradeId);
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.key.toLowerCase()) {
        case ' ':
        case 'h':
          e.preventDefault();
          this.game.performAction('action');
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.game.gameState.save();
            this.showToast('Game saved!', 'success');
          }
          break;
      }
    });
    
    // Update last saved time
    setInterval(() => this.updateLastSaved(), 1000);
  }

  _updateUI() {
    // Update credits
    if (this.elements.credits) {
      this.elements.credits.textContent = this.this.formatNumber(this.game.gameState.credits);
    }
    
    // Update credits per tick
    if (this.elements.creditsPerTick) {
      const perTick = this.game.crew.reduce((sum, c) => sum + (c.perTick * c.count), 0);
      this.elements.creditsPerTick.textContent = perTick > 0 ? `+${this.this.formatNumber(perTick, 1)}/tick` : '';
    }
    
    // Update crew section
    this.updateCrewSection();
    
    // Update contracts section
    this.updateContractsSection();
    
    // Update upgrades section
    this.updateUpgradesSection();
    
    // Update banking section
    this.updateBankingSection();
    
    // Check for unlocks
    this.checkUnlocks();
  }

  updateCrewSection() {
    const novice = this.game.crew.find(c => c.id === 'novice');
    const snitch = this.game.crew.find(c => c.id === 'snitch');
    
    if (novice) {
      if (this.elements.noviceCount) {
        this.elements.noviceCount.textContent = novice.count;
      }
      if (this.elements.noviceCost) {
        const cost = getCrewCost(novice);
        this.elements.noviceCost.textContent = this.formatNumber(cost);
        this.elements.hireBtn?.classList.toggle('disabled', this.game.gameState.credits < cost);
      }
    }
    
    if (snitch) {
      // Show snitch card if revealed
      if (snitch.revealed && this.elements.snitchCard) {
        this.elements.snitchCard.style.display = 'block';
      }
      
      if (this.elements.snitchCount) {
        this.elements.snitchCount.textContent = snitch.count;
      }
      if (this.elements.snitchCost) {
        const cost = getCrewCost(snitch);
        this.elements.snitchCost.textContent = this.formatNumber(cost);
        this.elements.snitchHireBtn?.classList.toggle('disabled', this.game.gameState.credits < cost);
      }
    }
  }

  updateContractsSection() {
    const contract = this.game.getCurrentContract();
    if (!contract) return;
    
    if (this.game.gameState.contractActive) {
      // Show active contract
      if (this.elements.activeContract) {
        this.elements.activeContract.style.display = 'block';
      }
      if (this.elements.availableContract) {
        this.elements.availableContract.style.display = 'none';
      }
      
      // Update progress
      const progress = this.game.gameState.contractProgress;
      const progressPct = (progress / contract.goal) * 100;
      
      if (this.elements.contractProgress) {
        this.elements.contractProgress.textContent = `${this.formatNumber(progress)} / ${this.formatNumber(contract.goal)}`;
      }
      if (this.elements.contractProgressBar) {
        this.elements.contractProgressBar.style.width = `${progressPct}%`;
      }
    } else {
      // Show available contract
      if (this.elements.activeContract) {
        this.elements.activeContract.style.display = 'none';
      }
      if (this.elements.availableContract) {
        this.elements.availableContract.style.display = 'block';
      }
      
      if (this.elements.contractTitle) {
        this.elements.contractTitle.textContent = contract.name;
      }
      if (this.elements.contractDescription) {
        this.elements.contractDescription.textContent = contract.details;
      }
      if (this.elements.contractReward) {
        this.elements.contractReward.textContent = this.formatNumber(contract.reward);
      }
    }
  }

  updateUpgradesSection() {
    if (!this.elements.upgradesGrid) return;
    
    // Clear existing upgrades
    this.elements.upgradesGrid.innerHTML = '';
    
    // Add upgrade cards
    this.game.upgrades.forEach(upgrade => {
      const count = this.game.gameState.getUpgradeCount(upgrade.id);
      const cost = getUpgradeCost(upgrade, count);
      const canAfford = this.game.gameState.credits >= cost;
      const isMaxed = upgrade.maxCount && count >= upgrade.maxCount;
      
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.dataset.upgradeId = upgrade.id;
      
      if (!canAfford || isMaxed) {
        card.classList.add('disabled');
      }
      
      card.innerHTML = `
        <div class="upgrade-icon">${upgrade.icon}</div>
        <div class="upgrade-info">
          <h4>${upgrade.name}</h4>
          <p>${upgrade.description}</p>
          <div class="upgrade-status">
            ${isMaxed ? '<span class="maxed">MAXED</span>' : `
              <span class="upgrade-count">Owned: ${count}</span>
              <span class="upgrade-cost">${this.formatNumber(cost)} credits</span>
            `}
          </div>
        </div>
      `;
      
      this.elements.upgradesGrid.appendChild(card);
    });
  }

  updateBankingSection() {
    const bankTarget = this.game.calculateBankTarget();
    const unbanked = this.game.gameState.state.unbanked;
    const progress = (unbanked / bankTarget) * 100;
    const reward = Math.floor(unbanked * 0.1);
    
    if (this.elements.unbanked) {
      this.elements.unbanked.textContent = this.formatNumber(unbanked, 1);
    }
    if (this.elements.bankTarget) {
      this.elements.bankTarget.textContent = this.formatNumber(bankTarget, 1);
    }
    if (this.elements.bankProgress) {
      this.elements.bankProgress.style.width = `${Math.min(100, progress)}%`;
    }
    if (this.elements.bankReward) {
      this.elements.bankReward.textContent = `+${this.formatNumber(reward)}`;
    }
  }

  updateCooldown(type, progress, ready) {
    const buttons = document.querySelectorAll(`[data-cooldown-type="${type}"]`);
    buttons.forEach(btn => {
      btn.style.setProperty('--cooldown-progress', `${progress * 100}%`);
      btn.disabled = !ready;
      
      // Also check affordability for hire buttons
      if (type === 'hire' && ready) {
        const crewId = btn.dataset.crewId;
        if (crewId) {
          const crew = this.game.crew.find(c => c.id === crewId);
          if (crew) {
            const cost = getCrewCost(crew);
            btn.disabled = this.game.gameState.credits < cost;
          }
        }
      }
    });
  }

  updateLastSaved() {
    if (!this.elements.lastSaved) return;
    
    const seconds = this.game.gameState.getTimeSinceLastSave();
    if (seconds === 0) {
      this.elements.lastSaved.textContent = 'Just saved';
    } else if (seconds < 60) {
      this.elements.lastSaved.textContent = `${seconds}s ago`;
    } else {
      const minutes = Math.floor(seconds / 60);
      this.elements.lastSaved.textContent = `${minutes}m ago`;
    }
  }

  checkUnlocks() {
    // Check contracts unlock
    if (this.game.shouldRevealContracts()) {
      this.game.unlockContracts();
      if (this.elements.contractsSection) {
        this.elements.contractsSection.style.display = 'block';
        this.elements.contractsSection.classList.add('section-reveal');
      }
      this.showToast('Contracts unlocked! New opportunities await!', 'success');
    }
    
    // Check upgrades unlock
    if (this.game.shouldRevealUpgrades()) {
      this.game.unlockUpgrades();
      if (this.elements.upgradesSection) {
        this.elements.upgradesSection.style.display = 'block';
        this.elements.upgradesSection.classList.add('section-reveal');
      }
      this.showToast('Upgrades unlocked! Enhance your abilities!', 'success');
    }
    
    // Check snitch reveal
    const snitch = this.game.crew.find(c => c.id === 'snitch');
    if (snitch && !snitch.revealed && this.game.gameState.credits >= 500) {
      snitch.revealed = true;
      this.game.saveCrew();
      if (this.elements.snitchCard) {
        this.elements.snitchCard.style.display = 'block';
        this.elements.snitchCard.classList.add('card-reveal');
      }
    }
  }

  showToast(message, type = 'info') {
    if (!this.elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const toastId = ++this.toastCounter;
    toast.dataset.toastId = toastId;
    
    this.elements.toastContainer.appendChild(toast);
    this.activeToasts.set(toastId, toast);
    
    // Limit number of toasts
    if (this.activeToasts.size > 5) {
      const oldestId = Math.min(...this.activeToasts.keys());
      const oldestToast = this.activeToasts.get(oldestId);
      if (oldestToast) {
        oldestToast.remove();
        this.activeToasts.delete(oldestId);
      }
    }
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
        this.activeToasts.delete(toastId);
      }, 300);
    }, 3000);
  }

  initializeAnimations() {
    // Add subtle animations to interactive elements
    document.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
      btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
      btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
    });
    
    // Parallax effect on scroll
    let ticking = false;
    function updateParallax() {
      const scrolled = window.pageYOffset;
      const parallax = document.querySelector('.parallax-bg');
      if (parallax) {
        parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
      ticking = false;
    }
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    });
  }
}