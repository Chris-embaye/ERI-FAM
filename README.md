# ERI-FAM 🎵

Eritrean Music Player — Stream, download, and listen offline.

## Features
- Offline music playback (IndexedDB)
- Background playback with lock screen controls (Media Session API)
- Cloud sync from Firebase (admin uploads → users download)
- Duplicate track detection & removal
- Equalizer with presets
- Sleep timer, shuffle, repeat
- AI Tigrinya/Arabic/English translator
- Music identification (AudD API)
- YouTube → MP3 converter (requires backend)
- PWA — installable on Android, iPhone, and desktop
- Admin panel to upload/manage tracks remotely

---

## Setup (5 steps)

### 1. Firebase
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable **Firestore**, **Storage**, **Authentication** (Email/Password)
4. Project Settings → Web App → copy config into `firebase-config.js`
5. Create an admin user: Authentication → Add User

### 2. Configure `firebase-config.js`
```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
const ADMIN_EMAIL    = "your@email.com";
const ADMIN_PASSWORD = "yourpassword";
const AUDD_API_KEY   = "";   // optional — get free at audd.io
const GEMINI_API_KEY = "";   // optional — get free at aistudio.google.com
```

### 3. Deploy to GitHub Pages
```bash
cd eri-fam
git init
git add .
git commit -m "initial ERI-FAM release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/eri-fam.git
git push -u origin main
```
Then: GitHub repo → Settings → Pages → Branch: main → Save.

Your app URL: `https://YOUR_USERNAME.github.io/eri-fam/`

### 4. Install on Phone
**Android:** Open the URL in Chrome → menu (⋮) → "Add to Home Screen"  
**iPhone:** Open in Safari → Share → "Add to Home Screen"

### 5. Admin Panel
Go to `https://YOUR_USERNAME.github.io/eri-fam/admin/`  
Sign in with the email/password you set in step 2.

---

## YouTube → MP3 Backend (optional)

Deploy a simple Python backend with yt-dlp:

```bash
pip install yt-dlp flask flask-cors
```

```python
# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp, os, tempfile

app = Flask(__name__)
CORS(app)

@app.route('/convert', methods=['POST'])
def convert():
    url = request.json.get('url')
    with tempfile.TemporaryDirectory() as tmp:
        opts = { 'format': 'bestaudio/best', 'outtmpl': f'{tmp}/%(title)s.%(ext)s',
                 'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}] }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return jsonify({ 'title': info['title'], 'downloadUrl': '...' })

app.run(port=5001)
```

Then set `YT_BACKEND_URL = "http://your-server:5001"` in `firebase-config.js`.

---

## Firebase Security Rules

**Firestore:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tracks/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /appSettings/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /notifications/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Storage:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /music/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## File Structure
```
eri-fam/
├── index.html          Main app
├── styles.css          App styles
├── app.js              App logic
├── sw.js               Service worker (offline)
├── manifest.json       PWA manifest
├── firebase-config.js  Your config (fill this in)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── admin/
    ├── index.html      Admin dashboard
    ├── admin.css       Admin styles
    └── admin.js        Admin logic
```

---

Built with ❤️ for the Eritrean community — ሓደ ህዝቢ ሓደ ልቢ 🇪🇷
