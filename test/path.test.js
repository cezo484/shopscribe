import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPath, nextFallback, PATH_LABELS, ON_DEVICE, CLOUD, LOCAL } from '../src/path.js';

test('available on-device model wins even when the cloud is configured', () => {
  assert.equal(selectPath({ onDevice: 'available', cloudConfigured: true }), ON_DEVICE);
});

test('available on-device model wins without any cloud config', () => {
  assert.equal(selectPath({ onDevice: 'available', cloudConfigured: false }), ON_DEVICE);
});

test('unavailable on-device model falls back to the cloud when configured', () => {
  assert.equal(selectPath({ onDevice: 'unavailable', cloudConfigured: true }), CLOUD);
});

test('nothing available falls back to the local formatter', () => {
  assert.equal(selectPath({ onDevice: 'unavailable', cloudConfigured: false }), LOCAL);
  assert.equal(selectPath({ onDevice: 'unknown', cloudConfigured: false }), LOCAL);
});

test('a model still downloading does not block the cloud path', () => {
  assert.equal(selectPath({ onDevice: 'downloading', cloudConfigured: true }), CLOUD);
  assert.equal(selectPath({ onDevice: 'downloadable', cloudConfigured: true }), CLOUD);
});

test('nextFallback walks the chain and ends after local', () => {
  assert.equal(nextFallback(ON_DEVICE), CLOUD);
  assert.equal(nextFallback(CLOUD), LOCAL);
  assert.equal(nextFallback(LOCAL), null);
});

test('every path has a label naming the platform behind it', () => {
  assert.match(PATH_LABELS[ON_DEVICE], /Gemini Nano/);
  assert.match(PATH_LABELS[CLOUD], /Firebase AI Logic/);
  assert.equal(typeof PATH_LABELS[LOCAL], 'string');
});
