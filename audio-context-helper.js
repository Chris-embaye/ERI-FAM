/**
 * ERI-FAM v2.0 — Audio Context Helper
 * Handles safe AudioContext initialization and mobile compatibility
 */

class AudioContextHelper {
  constructor() {
    this.audioCtx = null;
    this.isInitialized = false;
    this.isResuming = false;
    this.resumeTimeout = null;
  }

  /**
   * Initialize or resume AudioContext
   * Safely handles mobile autoplay policy
   */
  async ensureRunning() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (this.audioCtx.state === 'running') {
        return true;
      }

      if (this.audioCtx.state === 'suspended' && !this.isResuming) {
        this.isResuming = true;

        try {
          // Set a timeout to prevent hanging
          const resumePromise = this.audioCtx.resume();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AudioContext resume timeout')), 5000)
          );

          await Promise.race([resumePromise, timeoutPromise]);
          this.isResuming = false;
          return true;
        } catch (err) {
          this.isResuming = false;
          console.warn('[AudioContext] Resume failed:', err.message);
          return false;
        }
      }

      return this.audioCtx.state === 'running';
    } catch (err) {
      console.error('[AudioContext] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Create gain node for volume control
   */
  createGainNode() {
    if (!this.audioCtx) return null;
    return this.audioCtx.createGain();
  }

  /**
   * Create analyser for visualizer
   */
  createAnalyser() {
    if (!this.audioCtx) return null;
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    return analyser;
  }

  /**
   * Create filter for EQ
   */
  createFilter(type = 'peaking', frequency = 1000, Q = 1, gain = 0) {
    if (!this.audioCtx) return null;
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    filter.gain.value = gain;
    return filter;
  }

  /**
   * Connect nodes properly
   */
  connect(source, ...destinations) {
    if (!source) return;
    destinations.forEach(dest => {
      if (dest) source.connect(dest);
    });
  }

  /**
   * Cleanup on app unload
   */
  dispose() {
    if (this.resumeTimeout) clearTimeout(this.resumeTimeout);
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.isInitialized = false;
  }

  /**
   * Get current audio context
   */
  getContext() {
    return this.audioCtx;
  }
}

const audioHelper = new AudioContextHelper();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  audioHelper.dispose();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioContextHelper, audioHelper };
}
