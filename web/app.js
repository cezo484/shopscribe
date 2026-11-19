// ShopScribe browser wiring: detect the on-device model, load the
// optional Firebase config, and run the fallback chain
// on-device -> cloud -> local. The report rendering is identical
// whichever path produced the report; only the badge differs.

import { formatNote, reportToText } from '../src/format.js';
import { selectPath, nextFallback, PATH_LABELS, PATH_NOTES, ON_DEVICE, CLOUD, LOCAL } from '../src/path.js';
import { validateFirebaseConfig, normalizeFirebaseConfig } from '../src/config.js';
import { buildPrompt, parseReport } from '../src/prompt.js';
import { SAMPLE_NOTES } from '../src/samples.js';

const $ = (id) => document.getElementById(id);

const state = {
  onDevice: 'unknown',
  cloudConfig: null,
  cloudModel: null,
  deviceSession: null,
  lastReport: null,
  lastPath: null,
};

// --- On-device detection -----------------------------------------------
// Current shape: the LanguageModel global (Prompt API). The window.ai
// shape dates from the 2024 previews and is checked only as a fallback.

function hasLanguageModel() {
  return typeof LanguageModel !== 'undefined' && typeof LanguageModel.availability === 'function';
}

function legacyLanguageModel() {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    return window.ai.languageModel;
  }
  return null;
}

async function detectOnDevice() {
  if (hasLanguageModel()) {
    try {
      const status = await LanguageModel.availability();
      return ['available', 'downloading', 'downloadable', 'unavailable'].includes(status)
        ? status
        : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
  const legacy = legacyLanguageModel();
  if (legacy && typeof legacy.capabilities === 'function') {
    try {
      const caps = await legacy.capabilities();
      if (caps.available === 'readily') return 'available';
      if (caps.available === 'after-download') return 'downloadable';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}

async function createDeviceSession(onProgress) {
  if (hasLanguageModel()) {
    const options = onProgress
      ? {
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => onProgress(e.loaded));
          },
        }
      : {};
    return LanguageModel.create(options);
  }
  const legacy = legacyLanguageModel();
  if (legacy && typeof legacy.create === 'function') {
    return legacy.create();
  }
  throw new Error('Prompt API is not available in this browser');
}

async function generateOnDevice(note) {
  if (!state.deviceSession) {
    state.deviceSession = await createDeviceSession();
  }
  const text = await state.deviceSession.prompt(buildPrompt(note));
  const parsed = parseReport(text);
  if (!parsed.ok) {
    throw new Error(`On-device reply could not be read (${parsed.reason})`);
  }
  return parsed.report;
}

// --- Cloud path (Firebase AI Logic) -------------------------------------

async function loadCloudConfig() {
  try {
    const module = await import('./firebaseConfig.js');
    const check = validateFirebaseConfig(module.firebaseConfig);
    if (!check.ok) {
      console.info('Firebase config incomplete, missing:', check.missing.join(', '));
      return null;
    }
    return normalizeFirebaseConfig(module.firebaseConfig);
  } catch {
    // No firebaseConfig.js file: the cloud path stays off. This is the
    // normal state for a fresh checkout.
    return null;
  }
}

async function initCloudModel() {
  if (state.cloudModel) return state.cloudModel;
  const { initializeApp } = await import('firebase/app');
  const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
  const app = initializeApp(state.cloudConfig);
  if (state.cloudConfig.appCheckSiteKey) {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
    if (state.cloudConfig.appCheckDebug) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(state.cloudConfig.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  state.cloudModel = getGenerativeModel(ai, { model: state.cloudConfig.model });
  return state.cloudModel;
}

async function generateInCloud(note) {
  const model = await initCloudModel();
  const result = await model.generateContent(buildPrompt(note));
  const parsed = parseReport(result.response.text());
  if (!parsed.ok) {
    throw new Error(`Cloud reply could not be read (${parsed.reason})`);
  }
  return parsed.report;
}

// --- Fallback chain ------------------------------------------------------

async function generateWith(path, note) {
  if (path === ON_DEVICE) return generateOnDevice(note);
  if (path === CLOUD) return generateInCloud(note);
  return formatNote(note);
}

async function runReport(note) {
  const attempts = [];
  let path = selectPath({ onDevice: state.onDevice, cloudConfigured: !!state.cloudConfig });
  while (path) {
    if (path === CLOUD && !state.cloudConfig) {
      path = nextFallback(path);
      continue;
    }
    try {
      const report = await generateWith(path, note);
      return { report, path, attempts };
    } catch (error) {
      attempts.push({ path, error: error.message || String(error) });
      if (path === ON_DEVICE && state.deviceSession) {
        try {
          state.deviceSession.destroy();
        } catch {
          // Session was already closed.
        }
        state.deviceSession = null;
      }
      path = nextFallback(path);
    }
  }
  throw new Error('No path produced a report');
}

// --- UI ------------------------------------------------------------------

const DEVICE_STATUS_TEXT = {
  available: 'Ready',
  downloading: 'Downloading model',
  downloadable: 'Model not downloaded yet',
  unavailable: 'Not available in this browser',
  unknown: 'Checking...',
};

function refreshStatus() {
  const deviceBadge = $('device-status');
  deviceBadge.textContent = DEVICE_STATUS_TEXT[state.onDevice] || 'Unknown';
  deviceBadge.dataset.tone =
    state.onDevice === 'available' ? 'good' : state.onDevice === 'unavailable' ? 'bad' : 'warn';
  $('prepare-button').hidden = !(state.onDevice === 'downloadable' || state.onDevice === 'downloading');

  const cloudBadge = $('cloud-status');
  if (state.cloudConfig) {
    cloudBadge.textContent = `Configured (model ${state.cloudConfig.model})`;
    cloudBadge.dataset.tone = 'good';
  } else {
    cloudBadge.textContent = 'No Firebase config, local formatter covers it';
    cloudBadge.dataset.tone = 'warn';
  }
}

function renderReport(report, path, attempts, elapsedMs) {
  const fields = $('report-fields');
  fields.innerHTML = '';
  const rows = [
    ['Fault', report.fault],
    ['Action taken', report.action],
    ['Parts used', report.parts && report.parts.length > 0 ? report.parts.join(', ') : ''],
    ['Test result', report.test],
    ['Follow-up', report.followUp],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value || 'Not recorded';
    if (!value) dd.classList.add('empty');
    fields.append(dt, dd);
  }
  const badge = $('path-badge');
  badge.textContent = PATH_LABELS[path];
  badge.dataset.tone = path === ON_DEVICE ? 'good' : path === CLOUD ? 'warn' : 'plain';
  $('path-note').textContent = `${PATH_NOTES[path]} Took ${elapsedMs} ms.`;
  const log = $('attempt-log');
  if (attempts.length > 0) {
    log.textContent =
      'Tried first: ' +
      attempts.map((a) => `${PATH_LABELS[a.path]} failed (${a.error})`).join('; ');
    log.hidden = false;
  } else {
    log.hidden = true;
  }
  $('report-section').hidden = false;
}

async function onWrite() {
  const note = $('note').value.trim();
  const errorEl = $('error');
  errorEl.hidden = true;
  if (!note) {
    errorEl.textContent = 'Write a note first, or pick a sample.';
    errorEl.hidden = false;
    return;
  }
  const button = $('write-button');
  button.disabled = true;
  button.textContent = 'Writing...';
  const started = Date.now();
  try {
    const { report, path, attempts } = await runReport(note);
    state.lastReport = report;
    state.lastPath = path;
    renderReport(report, path, attempts, Date.now() - started);
  } catch (error) {
    errorEl.textContent = `Could not write the report: ${error.message || error}`;
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Write report';
  }
}

async function onPrepare() {
  const button = $('prepare-button');
  button.disabled = true;
  $('download-row').hidden = false;
  try {
    const session = await createDeviceSession((loaded) => {
      $('download-progress').value = loaded;
      $('download-text').textContent = `${Math.round(loaded * 100)}%`;
    });
    state.deviceSession = session;
    state.onDevice = await detectOnDevice();
    if (state.onDevice === 'downloading' || state.onDevice === 'downloadable') {
      state.onDevice = 'available';
    }
  } catch (error) {
    const errorEl = $('error');
    errorEl.textContent = `Could not prepare the on-device model: ${error.message || error}`;
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
    $('download-row').hidden = true;
    refreshStatus();
  }
}

async function init() {
  state.onDevice = await detectOnDevice();
  state.cloudConfig = await loadCloudConfig();
  refreshStatus();

  $('write-button').addEventListener('click', onWrite);
  $('prepare-button').addEventListener('click', onPrepare);
  document.querySelectorAll('[data-sample]').forEach((button) => {
    button.addEventListener('click', () => {
      $('note').value = SAMPLE_NOTES[Number(button.dataset.sample)];
      $('note').focus();
    });
  });
  $('copy-button').addEventListener('click', async () => {
    if (!state.lastReport) return;
    const text = `${reportToText(state.lastReport)}\n\nWritten via: ${PATH_LABELS[state.lastPath]}`;
    try {
      await navigator.clipboard.writeText(text);
      $('copy-status').textContent = 'Copied.';
    } catch {
      $('copy-status').textContent = 'Copy failed. Select the report text by hand.';
    }
  });
}

init();
