// Firebase config handling. The app reads web/firebaseConfig.js when it
// exists and treats a missing or placeholder config as "cloud path off",
// never as an error. No real values live in this repo.

export const REQUIRED_FIREBASE_FIELDS = ['apiKey', 'authDomain', 'projectId', 'appId'];

// Check the Firebase AI Logic supported models page before a demo;
// model names change often. This is only the default.
export const DEFAULT_CLOUD_MODEL = 'gemini-2.5-flash-lite';

export function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const text = value.trim();
  if (text === '') return true;
  if (/^(YOUR_|PASTE_|REPLACE|TODO|<)/i.test(text)) return true;
  if (text.includes('YOUR_')) return true;
  return false;
}

// Returns { ok, missing }, where missing lists the fields still empty
// or holding a placeholder value.
export function validateFirebaseConfig(config) {
  if (!config || typeof config !== 'object') {
    return { ok: false, missing: [...REQUIRED_FIREBASE_FIELDS] };
  }
  const missing = REQUIRED_FIREBASE_FIELDS.filter((field) => isPlaceholder(config[field]));
  return { ok: missing.length === 0, missing };
}

// Fill in optional settings so the rest of the app can rely on them.
export function normalizeFirebaseConfig(config) {
  const out = { ...config };
  if (!out.model || typeof out.model !== 'string' || out.model.trim() === '') {
    out.model = DEFAULT_CLOUD_MODEL;
  }
  if (typeof out.appCheckSiteKey !== 'string') out.appCheckSiteKey = '';
  if (typeof out.appCheckDebug !== 'boolean') out.appCheckDebug = false;
  return out;
}
