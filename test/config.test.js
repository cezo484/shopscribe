import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlaceholder,
  validateFirebaseConfig,
  normalizeFirebaseConfig,
  REQUIRED_FIREBASE_FIELDS,
  DEFAULT_CLOUD_MODEL,
} from '../src/config.js';

const COMPLETE = {
  apiKey: 'AIzaSyExampleKey123',
  authDomain: 'shopscribe-demo.firebaseapp.com',
  projectId: 'shopscribe-demo',
  appId: '1:1234567890:web:abcdef123456',
};

test('a complete config validates', () => {
  const check = validateFirebaseConfig(COMPLETE);
  assert.equal(check.ok, true);
  assert.deepEqual(check.missing, []);
});

test('placeholder values count as missing', () => {
  const check = validateFirebaseConfig({ ...COMPLETE, apiKey: 'YOUR_API_KEY', projectId: '' });
  assert.equal(check.ok, false);
  assert.deepEqual(check.missing, ['apiKey', 'projectId']);
});

test('a missing config object lists every required field', () => {
  const check = validateFirebaseConfig(null);
  assert.equal(check.ok, false);
  assert.deepEqual(check.missing, [...REQUIRED_FIREBASE_FIELDS]);
  assert.deepEqual(validateFirebaseConfig(undefined).missing, [...REQUIRED_FIREBASE_FIELDS]);
});

test('isPlaceholder catches empty, YOUR_, and angle-bracket values', () => {
  assert.equal(isPlaceholder(''), true);
  assert.equal(isPlaceholder('   '), true);
  assert.equal(isPlaceholder('YOUR_API_KEY'), true);
  assert.equal(isPlaceholder('<paste key here>'), true);
  assert.equal(isPlaceholder(null), true);
  assert.equal(isPlaceholder(42), true);
  assert.equal(isPlaceholder('AIzaSyExampleKey123'), false);
});

test('normalize fills the default cloud model and App Check settings', () => {
  const out = normalizeFirebaseConfig(COMPLETE);
  assert.equal(out.model, DEFAULT_CLOUD_MODEL);
  assert.equal(out.appCheckSiteKey, '');
  assert.equal(out.appCheckDebug, false);
});

test('normalize keeps a model the user set', () => {
  const out = normalizeFirebaseConfig({ ...COMPLETE, model: 'gemini-2.5-flash' });
  assert.equal(out.model, 'gemini-2.5-flash');
});

test('normalize does not mutate the input object', () => {
  const input = { ...COMPLETE };
  normalizeFirebaseConfig(input);
  assert.equal('model' in input, false);
});
