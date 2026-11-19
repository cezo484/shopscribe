// Path selection for the hybrid design. The app tries the on-device
// model first, then the cloud path, then the local formatter. These
// functions are pure so the order can be tested without a browser.

export const ON_DEVICE = 'on-device';
export const CLOUD = 'cloud';
export const LOCAL = 'local';

export const PATH_LABELS = {
  [ON_DEVICE]: 'On-device (Gemini Nano)',
  [CLOUD]: 'Cloud (Firebase AI Logic)',
  [LOCAL]: 'Local formatter',
};

export const PATH_NOTES = {
  [ON_DEVICE]: 'Written on this device. The note never left the browser.',
  [CLOUD]: 'Written in the cloud. The on-device model was not available.',
  [LOCAL]: 'Formatted on this page with no model. Both model paths were unavailable.',
};

// onDevice is the LanguageModel availability string: 'available',
// 'downloading', 'downloadable', 'unavailable', or 'unknown'.
// cloudConfigured is true when a complete Firebase config was loaded.
export function selectPath({ onDevice, cloudConfigured }) {
  if (onDevice === 'available') return ON_DEVICE;
  if (cloudConfigured) return CLOUD;
  return LOCAL;
}

// The next path to try when the current one fails. Returns null after local.
export function nextFallback(path) {
  if (path === ON_DEVICE) return CLOUD;
  if (path === CLOUD) return LOCAL;
  return null;
}
