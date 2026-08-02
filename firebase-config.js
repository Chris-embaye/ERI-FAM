// ================================================================
//  ERI-FAM — Firebase & API Configuration v2.0
//
//  SECURITY NOTE: Never commit real API keys to version control.
//  Use environment variables or a separate .env file.
//  Create a firebase-config.local.js for local development.
// ================================================================

// Get env var helper (works in both module and script contexts)
const getEnv = (key) => {
  try {
    // Try window.ENV first (set via script or build process)
    if (typeof window !== 'undefined' && window.ENV?.[key]) return window.ENV[key];
  } catch (e) {}
  return null;
};

// Firebase WEB config — these values are public by design (like a website URL).
// Real security lives in Firestore/Storage RULES, never in hiding this config.
const FIREBASE_CONFIG = {
  apiKey:            getEnv('VITE_FIREBASE_API_KEY') || "AIzaSyCcvA7TBrkdsfXVSIT-J9U-asNsIKWvX2E",
  authDomain:        getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "eri-fam.firebaseapp.com",
  databaseURL:       getEnv('VITE_FIREBASE_DB_URL') || "https://eri-fam-default-rtdb.firebaseio.com",
  projectId:         getEnv('VITE_FIREBASE_PROJECT_ID') || "eri-fam",
  storageBucket:     getEnv('VITE_FIREBASE_STORAGE_BUCKET') || "eri-fam.firebasestorage.app",
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_ID') || "640644486226",
  appId:             getEnv('VITE_FIREBASE_APP_ID') || "1:640644486226:web:9a076e9775c58763cffb8b",
  measurementId:     getEnv('VITE_FIREBASE_MEASUREMENT_ID') || "G-GMYL5P3F1P"
};

// Admin email (pre-fills the login form — password is entered manually for security)
const ADMIN_EMAIL = "embayechris@gmail.com";

// OPTIONAL API Keys — Features will gracefully degrade if not provided
const AUDD_API_KEY    = getEnv('VITE_AUDD_API_KEY') || "";    // Music ID at https://audd.io
const GEMINI_API_KEY  = getEnv('VITE_GEMINI_API_KEY') || "";  // AI Translation
const YOUTUBE_API_KEY = getEnv('VITE_YOUTUBE_API_KEY') || ""; // YouTube search

// Cloudinary configuration (optional)
const CLOUDINARY_CLOUD  = "dcbqqqpmw";
const CLOUDINARY_PRESET = "eri-fam-music";

// YouTube backend URL (optional — deploy yt-dlp backend separately)
const YT_BACKEND_URL = getEnv('VITE_YT_BACKEND_URL') || "";

// Expose globally for use in other scripts
if (typeof window !== 'undefined') {
  window.FIREBASE_CONFIG = FIREBASE_CONFIG;
  window.ADMIN_EMAIL = ADMIN_EMAIL;
  window.AUDD_API_KEY = AUDD_API_KEY;
  window.GEMINI_API_KEY = GEMINI_API_KEY;
  window.YOUTUBE_API_KEY = YOUTUBE_API_KEY;
  window.CLOUDINARY_CLOUD = CLOUDINARY_CLOUD;
  window.CLOUDINARY_PRESET = CLOUDINARY_PRESET;
  window.YT_BACKEND_URL = YT_BACKEND_URL;
}

// Try to load local config if it exists (for development)
if (typeof window !== 'undefined' && localStorage.getItem('eri-fam-config-loaded') !== 'true') {
  import('./firebase-config.local.js').catch(() => {
    console.log('[Config] Using default Firebase configuration');
    localStorage.setItem('eri-fam-config-loaded', 'true');
  });
}
