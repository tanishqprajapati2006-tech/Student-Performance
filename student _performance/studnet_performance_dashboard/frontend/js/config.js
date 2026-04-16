// API base URL — change this to your Railway backend URL after deploying
// For local dev: leave as empty string (uses relative /api/)
// For production: set to 'https://your-app.up.railway.app'
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://your-app.up.railway.app';  // <-- UPDATE THIS after Railway deploy
