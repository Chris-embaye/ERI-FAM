// ================================================================
//  ERI-FAM — Firebase & API Configuration
//  1. Go to https://console.firebase.google.com
//  2. Create a project → Add Web App → copy config below
//  3. Enable: Firestore, Storage, Authentication (Anonymous + Email)
// ================================================================

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Admin credentials (used in admin panel)
const ADMIN_EMAIL    = "your@email.com";
const ADMIN_PASSWORD = "yourpassword";

// Music Identification — free tier at https://audd.io
const AUDD_API_KEY   = "";

// AI Translation — Gemini free at https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = "";

// YouTube backend URL (optional — deploy yt-dlp backend separately)
const YT_BACKEND_URL = "";
