/**
 * Performance Optimizations
 * Utilities for efficient rendering and resource management
 */

export class PerformanceManager {
  constructor() {
    this.frameCallbacks = new Set();
    this.rafId = null;
    this.lastUpdateTime = 0;
    this.updateThrottle = 16; // ~60fps
    
    // DOM update batching
    this.pendingUpdates = new Map();
    this.updateScheduled = false;
  }

  // Request animation frame loop for smooth animations
  startRenderLoop() {
    const loop = (timestamp) => {
      if (timestamp - this.lastUpdateTime >= this.updateThrottle) {
        this.frameCallbacks.forEach(callback => callback(timestamp));
        this.lastUpdateTime = timestamp;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopRenderLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  addFrameCallback(callback) {
    this.frameCallbacks.add(callback);
  }

  removeFrameCallback(callback) {
    this.frameCallbacks.delete(callback);
  }

  // Batch DOM updates
  scheduleUpdate(elementId, property, value) {
    if (!this.pendingUpdates.has(elementId)) {
      this.pendingUpdates.set(elementId, new Map());
    }
    this.pendingUpdates.get(elementId).set(property, value);
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => this.flushUpdates());
    }
  }

  flushUpdates() {
    this.pendingUpdates.forEach((updates, elementId) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      
      updates.forEach((value, property) => {
        if (property === 'textContent' || property === 'innerHTML') {
          if (element[property] !== value) {
            element[property] = value;
          }
        } else if (property === 'style') {
          Object.assign(element.style, value);
        } else if (property === 'classList') {
          value.add?.forEach(cls => element.classList.add(cls));
          value.remove?.forEach(cls => element.classList.remove(cls));
          value.toggle?.forEach(([cls, force]) => element.classList.toggle(cls, force));
        } else {
          element[property] = value;
        }
      });
    });
    
    this.pendingUpdates.clear();
    this.updateScheduled = false;
  }

  // Debounce function for expensive operations
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function for rate-limiting
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Lazy load images
  lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }

  // Efficient number formatting with caching
  createNumberFormatter() {
    const cache = new Map();
    const maxCacheSize = 1000;
    
    return (num, decimals = 0) => {
      const key = `${num}_${decimals}`;
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      let formatted;
      if (num >= 1e9) {
        formatted = (num / 1e9).toFixed(2) + 'B';
      } else if (num >= 1e6) {
        formatted = (num / 1e6).toFixed(2) + 'M';
      } else if (num >= 1e3) {
        formatted = (num / 1e3).toFixed(1) + 'K';
      } else {
        formatted = num.toLocaleString(undefined, { 
          minimumFractionDigits: decimals, 
          maximumFractionDigits: decimals 
        });
      }
      
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      cache.set(key, formatted);
      return formatted;
    };
  }

  // Visibility change detection for pausing expensive operations
  setupVisibilityHandling(onHidden, onVisible) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        onHidden?.();
      } else {
        onVisible?.();
      }
    });
  }

  // Memory cleanup utility
  cleanup() {
    this.stopRenderLoop();
    this.frameCallbacks.clear();
    this.pendingUpdates.clear();
  }
}

// Singleton instance
export const performance = new PerformanceManager();