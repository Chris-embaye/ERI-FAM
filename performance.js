/**
 * ERI-FAM v2.0 — Performance Optimization Module
 * Debouncing, throttling, lazy loading, and memory management
 */

class Performance {
  /**
   * Debounce function — delay execution until events stop
   */
  static debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function — execute at most once per interval
   */
  static throttle(func, interval = 300) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= interval) {
        lastCall = now;
        func.apply(this, args);
      }
    };
  }

  /**
   * Request idle callback with fallback
   */
  static onIdle(callback, timeout = 5000) {
    if ('requestIdleCallback' in window) {
      return requestIdleCallback(callback, { timeout });
    } else {
      return setTimeout(callback, timeout);
    }
  }

  /**
   * Lazy load images
   */
  static lazyLoadImages() {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      }, { rootMargin: '50px' });

      document.querySelectorAll('img[data-src]').forEach(img => {
        observer.observe(img);
      });
    }
  }

  /**
   * Measure performance of an operation
   */
  static async measure(label, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (err) {
      const duration = performance.now() - start;
      console.error(`[Perf] ${label} FAILED after ${duration.toFixed(2)}ms:`, err);
      throw err;
    }
  }

  /**
   * Check memory usage (Chrome only)
   */
  static getMemoryInfo() {
    if (performance.memory) {
      return {
        used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
        percent: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1)
      };
    }
    return null;
  }

  /**
   * Batch DOM updates to prevent reflow
   */
  static batchUpdate(updates) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  /**
   * Virtual scrolling helper
   */
  static createVirtualScroller(container, items, itemHeight, renderItem) {
    let scrollTop = 0;
    const visibleCount = Math.ceil(container.clientHeight / itemHeight);

    container.addEventListener('scroll', Performance.throttle(() => {
      scrollTop = container.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight));
      const endIndex = Math.min(items.length, startIndex + visibleCount + 5);

      const fragment = document.createDocumentFragment();
      for (let i = startIndex; i < endIndex; i++) {
        const item = items[i];
        const el = renderItem(item, i);
        el.style.transform = `translateY(${i * itemHeight}px)`;
        fragment.appendChild(el);
      }

      container.innerHTML = '';
      container.appendChild(fragment);
    }));
  }

  /**
   * Preload resources
   */
  static preloadResources(urls = []) {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      if (url.endsWith('.js')) link.as = 'script';
      if (url.endsWith('.css')) link.as = 'style';
      if (url.endsWith('.mp3') || url.endsWith('.wav')) link.as = 'audio';
      document.head.appendChild(link);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Performance };
}
