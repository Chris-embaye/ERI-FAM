// ================================================================
//  ERI-FAM — Firebase & API Configuration v2.0
//
//  SECURITY NOTE: Never commit real API keys to version control.
//  Use environment variables or a separate .env file.
//  Create a firebase-config.local.js for local development.
// ================================================================

// Default configuration — OVERRIDE these in production with env vars
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env?.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain:        import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "eri-fam.firebaseapp.com",
  databaseURL:       import.meta.env?.VITE_FIREBASE_DB_URL || "https://eri-fam-default-rtdb.firebaseio.com",
  projectId:         import.meta.env?.VITE_FIREBASE_PROJECT_ID || "eri-fam",
  storageBucket:     import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "eri-fam.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_ID || "640644486226",
  appId:             import.meta.env?.VITE_FIREBASE_APP_ID || "1:640644486226:web:9a076e9775c58763cffb8b",
  measurementId:     import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-GMYL5P3F1P"
};

// Admin email (pre-fills the login form — password is entered manually for security)
const ADMIN_EMAIL = "admin@eri-fam.app";

// OPTIONAL API Keys — Features will gracefully degrade if not provided
const AUDD_API_KEY    = import.meta.env?.VITE_AUDD_API_KEY || "";    // Music ID at https://audd.io
const GEMINI_API_KEY  = import.meta.env?.VITE_GEMINI_API_KEY || "";  // AI Translation
const YOUTUBE_API_KEY = import.meta.env?.VITE_YOUTUBE_API_KEY || ""; // YouTube search

// Cloudinary configuration (optional)
const CLOUDINARY_CLOUD  = "dcbqqqpmw";
const CLOUDINARY_PRESET = "eri-fam-music";

// YouTube backend URL (optional — deploy yt-dlp backend separately)
const YT_BACKEND_URL = import.meta.env?.VITE_YT_BACKEND_URL || "";

// Try to load local config if it exists (for development)
if (typeof window !== 'undefined' && localStorage.getItem('eri-fam-config-loaded') !== 'true') {
  import('./firebase-config.local.js').catch(() => {
    console.log('[Config] Using default Firebase configuration');
    localStorage.setItem('eri-fam-config-loaded', 'true');
  });
}
