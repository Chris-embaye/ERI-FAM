/**
 * ERI-FAM v2.0 — Unified Error Handling System
 * Replaces scattered console.warn() with proper user notifications
 */

class ErrorHandler {
  constructor() {
    this.toastContainer = null;
    this.initToastContainer();
    this.errorLog = [];
  }

  initToastContainer() {
    if (document.getElementById('toastContainer')) return;
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 350px;
      font-family: Montserrat, sans-serif;
    `;
    document.body.appendChild(container);
    this.toastContainer = container;
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'error' | 'warning' | 'success' | 'info'
   * @param {number} duration - Duration in ms (0 = persistent)
   */
  toast(message, type = 'info', duration = 4000) {
    if (!this.toastContainer) this.initToastContainer();

    const toast = document.createElement('div');
    const bgColor = {
      error: '#FF5555',
      warning: '#FFB84D',
      success: '#52C77D',
      info: '#4A90E2'
    }[type] || '#4A90E2';

    const icon = {
      error: '❌',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️'
    }[type] || 'ℹ️';

    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 500;
      animation: toastSlideIn 0.3s ease-out;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    toast.innerHTML = `<span>${icon}</span><span style="flex:1">${message}</span><button style="background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:0;opacity:0.7">&times;</button>`;
    
    toast.querySelector('button').onclick = () => {
      toast.style.animation = 'toastSlideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    };

    this.toastContainer.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'toastSlideOut 0.3s ease-out';
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }

    // Add animation styles if not already present
    if (!document.getElementById('toastStyles')) {
      const style = document.createElement('style');
      style.id = 'toastStyles';
      style.textContent = `
        @keyframes toastSlideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Handle errors and show to user
   * @param {Error|string} error - The error
   * @param {string} context - Where the error occurred
   * @param {boolean} showToUser - Show toast notification
   */
  handle(error, context = 'App', showToUser = true) {
    const message = error?.message || String(error);
    const timestamp = new Date().toISOString();

    // Log to console for debugging
    console.error(`[${context}] ${message}`, error);

    // Store in log
    this.errorLog.push({
      context,
      message,
      timestamp,
      stack: error?.stack || null
    });

    // Keep only last 50 errors
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }

    // Show to user
    if (showToUser) {
      this.toast(message, 'error');
    }

    return error;
  }

  /**
   * Get formatted error report
   */
  getReport() {
    return this.errorLog.map(e => 
      `[${e.timestamp}] ${e.context}: ${e.message}`
    ).join('\n');
  }

  /**
   * Warn user (non-critical)
   */
  warn(message, context = 'App', showToUser = true) {
    console.warn(`[${context}] ${message}`);
    if (showToUser) {
      this.toast(message, 'warning', 3000);
    }
  }

  /**
   * Show success message
   */
  success(message) {
    this.toast(message, 'success', 2000);
  }

  /**
   * Show info message
   */
  info(message) {
    this.toast(message, 'info', 3000);
  }
}

// Global instance
const errors = new ErrorHandler();

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  errors.handle(event.reason, 'UnhandledPromise', true);
});

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler, errors };
}
