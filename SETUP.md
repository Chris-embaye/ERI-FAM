# ERI-FAM v2.0 — Developer Setup Guide

## Quick Start (5 minutes)

### 1. Clone & Setup
```bash
cd eri-fam
npm install
```

### 2. Configure Firebase
1. Go to https://console.firebase.google.com
2. Create a new project (or use existing)
3. Create a Web App
4. Copy the config values
5. Create `.env.local` file (or `firebase-config.local.js`):

```javascript
// firebase-config.local.js (optional, for development)
Object.assign(window, {
  FIREBASE_CONFIG: {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456",
  },
  ADMIN_EMAIL: "your@email.com"
});
```

### 3. Enable Firebase Features
In Firebase Console:
- **Firestore Database** → Create → Start in test mode
- **Storage** → Create → Start in test mode
- **Authentication** → Email/Password provider → Enable
- **Authentication** → Add a test user

### 4. Set Firestore Rules
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
  }
}
```

### 5. Run Development Server
```bash
# Using Python's built-in server
python3 -m http.server 8000

# Or using Node.js
npx http-server
```

Visit: http://localhost:8000

---

## Optional: API Keys

### Music Identification (AudD)
1. Sign up at https://audd.io
2. Get free API key
3. Add to `.env.local`:
```
VITE_AUDD_API_KEY=your_audd_key
```

### AI Translation (Gemini)
1. Go to https://aistudio.google.com/app/apikey
2. Create API key
3. Add to `.env.local`:
```
VITE_GEMINI_API_KEY=your_gemini_key
```

### YouTube Search (YouTube Data API v3)
1. Go to https://console.cloud.google.com
2. Enable "YouTube Data API v3"
3. Create API key
4. Add to `.env.local`:
```
VITE_YOUTUBE_API_KEY=your_youtube_key
```

### YouTube to MP3 Backend (Optional)
Deploy a Python backend:

```bash
pip install yt-dlp flask flask-cors
```

Create `server.py`:
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
CORS(app)

@app.route('/convert', methods=['POST'])
def convert():
    url = request.json.get('url')
    try:
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            return jsonify({'title': info['title'], 'url': url})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(port=5001)
```

Run:
```bash
python server.py
```

Add to `.env.local`:
```
VITE_YT_BACKEND_URL=http://localhost:5001
```

---

## File Structure

```
eri-fam/
├── index.html              Main app
├── app.js                  Main logic (6000+ lines)
├── styles.css              Styling
├── sw.js                   Service worker (offline support)
├── manifest.json           PWA manifest
├── firebase-config.js      Firebase configuration (env vars)
│
├── error-handler.js        ✨ NEW: Error & toast system
├── audio-context-helper.js ✨ NEW: Audio initialization helper
├── search-index.js         ✨ NEW: Fast search with fuzzy matching
├── performance.js          ✨ NEW: Utilities for optimization
│
├── admin/
│   ├── index.html
│   ├── admin.js
│   └── admin.css
├── icons/
├── CHANGELOG.md            ✨ NEW: Version history
├── UPGRADE_PLAN.md         ✨ NEW: Audit & improvements
├── SETUP.md                ✨ NEW: This file
├── .gitignore              ✨ NEW: Git ignore rules
├── .env.example            ✨ NEW: Env vars template
└── package.json
```

---

## New Modules Guide

### Using Error Handler
```javascript
// Import (already global)
// errors.handle(), errors.warn(), errors.success(), errors.info()

// Show error to user
try {
  await doSomething();
} catch (err) {
  errors.handle(err, 'MyFeature', true);
  // Shows red toast with error message
}

// Show warning
errors.warn('Sync is slow', 'Sync', true);
// Shows yellow warning toast

// Show success
errors.success('Saved successfully');
// Shows green success toast

// Log to console without showing
errors.handle(err, 'Background', false);
```

### Using Audio Context Helper
```javascript
// Safely initialize audio context
if (await audioHelper.ensureRunning()) {
  // AudioContext is ready
  const gainNode = audioHelper.createGainNode();
  const analyser = audioHelper.createAnalyser();
  // ... use nodes
}
```

### Using Search Index
```javascript
// Add tracks to index
searchIndex.addTrack({ id: 1, title: 'Song', artist: 'Artist' });

// Search (returns matching tracks)
const results = searchIndex.search('song artist', 50);

// Remove track
searchIndex.removeTrack(1);

// Get stats
console.log(searchIndex.getStats());
// { tokenCount: 1200, trackCount: 100, avgTokensPerTrack: 12 }
```

### Using Performance Utils
```javascript
// Debounce search input
const handleSearch = Performance.debounce((query) => {
  console.log('Search:', query);
}, 300);
input.addEventListener('input', (e) => handleSearch(e.target.value));

// Throttle scroll events
const handleScroll = Performance.throttle(() => {
  console.log('Scrolled');
}, 300);
window.addEventListener('scroll', handleScroll);

// Measure performance
await Performance.measure('LoadTracks', async () => {
  await loadAllTracks();
});
// Logs: [Perf] LoadTracks: 234.56ms

// Check memory (Chrome only)
const mem = Performance.getMemoryInfo();
console.log(`Using ${mem.used}MB of ${mem.limit}MB (${mem.percent}%)`);
```

---

## Deployment

### GitHub Pages
```bash
git init
git add .
git commit -m "v2.0: Security & performance improvements"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/eri-fam.git
git push -u origin main
```

Settings → Pages → Branch: main → Save

Your app: `https://YOUR_USERNAME.github.io/eri-fam/`

### Environment Variables in Production
Use your hosting platform's secrets/environment variables:
- GitHub Pages: Settings → Secrets
- Vercel: Settings → Environment Variables
- Netlify: Site Settings → Build & Deploy → Environment

---

## Troubleshooting

### AudioContext not initializing
- Make sure there's a user interaction first (click/tap)
- Check browser console for errors
- Try reloading the page

### Firebase not connecting
- Verify API key in firebase-config.js
- Check Firestore security rules
- Verify network is online
- Check browser DevTools → Network tab

### Service worker not caching
- Clear browser cache (DevTools → Application → Clear storage)
- Restart the dev server
- Check browser console for SW errors

### Search is slow
- Rebuild index: `searchIndex.rebuildFromTracks(allTracks)`
- Check Performance.getMemoryInfo() for memory leaks
- Use Performance.throttle() for frequent updates

---

## Testing Checklist

Before deploying:
- [ ] App works offline (add music, play without internet)
- [ ] Errors show as toasts, not alerts
- [ ] Search results are accurate and fast
- [ ] Mobile: AudioContext initializes on tap
- [ ] Mobile: Touch targets are at least 44x44px
- [ ] Radio stations play without error
- [ ] Settings persist after refresh
- [ ] Admin panel allows uploading tracks
- [ ] Service worker is registered (DevTools → Application)

---

## Performance Targets

- **First Load:** < 2 seconds
- **Search:** < 100ms for 1000 tracks
- **Audio Start:** < 500ms
- **Memory:** < 100MB during playback
- **CPU:** < 10% during idle playback

---

## Security Checklist

- [ ] `.gitignore` added to prevent credential leaks
- [ ] No API keys hardcoded in version control
- [ ] Firebase rules restrict writes to authenticated users
- [ ] User data is encrypted in transit (HTTPS)
- [ ] Service worker doesn't cache sensitive data
- [ ] Local storage is cleared on logout

---

## Getting Help

- **Errors?** Check browser console (F12 → Console)
- **Firebase issues?** Check Firebase console logs
- **Performance?** Use DevTools → Performance tab
- **Questions?** Check README.md or CHANGELOG.md

---

**Happy coding! 🎵**
