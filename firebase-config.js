// ================================================================
//  ERI-FAM — Firebase & API Configuration
//  1. Go to https://console.firebase.google.com
//  2. Create a project → Add Web App → copy config below
//  3. Enable: Firestore, Storage, Authentication (Anonymous + Email)
// ================================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCcvA7TBrkdsfXVSIT-J9U-asNsIKWvX2E",
  authDomain:        "eri-fam.firebaseapp.com",
  databaseURL:       "https://eri-fam-default-rtdb.firebaseio.com",
  projectId:         "eri-fam",
  storageBucket:     "eri-fam.firebasestorage.app",
  messagingSenderId: "640644486226",
  appId:             "1:640644486226:web:9a076e9775c58763cffb8b",
  measurementId:     "G-GMYL5P3F1P"
};

// Admin email (pre-fills the login form — password is entered manually for security)
const ADMIN_EMAIL = "embayechris@gmail.com";

// Music Identification — free tier at https://audd.io
const AUDD_API_KEY   = "";

// AI Translation — Gemini free at https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = "";

// Cloudinary (free audio storage — cloudinary.com)
const CLOUDINARY_CLOUD  = "dcbqqqpmw";
const CLOUDINARY_PRESET = "eri-fam-music";

// YouTube Data API v3 — free 10,000 units/day (~100 searches)
// Get key: console.cloud.google.com → Enable "YouTube Data API v3" → Credentials → API Key
// Restrict key to: HTTP referrers → https://chris-embaye.github.io/*
const YOUTUBE_API_KEY = "";

// YouTube backend URL (optional — deploy yt-dlp backend separately)
const YT_BACKEND_URL = "";
