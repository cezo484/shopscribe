import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseReport, REPORT_FIELDS } from '../src/prompt.js';

const NOTE = 'pump 3 leaking at seal, replaced gasket, tested 2h, ok';

test('the prompt includes the note and the JSON field list', () => {
  const prompt = buildPrompt(NOTE);
  assert.match(prompt, /pump 3 leaking at seal/);
  assert.match(prompt, /JSON only/);
  for (const field of REPORT_FIELDS) {
    assert.ok(prompt.includes(`"${field}"`), `prompt should name the ${field} field`);
  }
});

test('a bare JSON object parses into a report', () => {
  const parsed = parseReport(
    '{"fault": "Pump 3 leaking at seal", "action": "Replaced gasket", "parts": ["gasket"], "test": "Tested 2h, ok", "followUp": ""}',
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.report.fault, 'Pump 3 leaking at seal');
  assert.deepEqual(parsed.report.parts, ['gasket']);
  assert.equal(parsed.report.followUp, '');
});

test('a JSON object inside a code fence parses', () => {
  const parsed = parseReport('```json\n{"fault": "Seal failed", "action": "", "parts": [], "test": "", "followUp": ""}\n```');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.report.fault, 'Seal failed');
});

test('surrounding prose does not break parsing', () => {
  const parsed = parseReport('Here is your report:\n{"fault": "Belt worn", "action": "Replaced belt", "parts": ["belt"], "test": "", "followUp": ""}\nHope that helps.');
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.report.parts, ['belt']);
});

test('parts given as a string are split on commas', () => {
  const parsed = parseReport('{"fault": "x", "action": "y", "parts": "belt, pulley", "test": "", "followUp": ""}');
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.report.parts, ['belt', 'pulley']);
});

test('an empty reply fails with a reason', () => {
  const parsed = parseReport('');
  assert.equal(parsed.ok, false);
  assert.equal(typeof parsed.reason, 'string');
});

test('a reply with no JSON fails with a reason', () => {
  const parsed = parseReport('I cannot help with that.');
  assert.equal(parsed.ok, false);
  assert.match(parsed.reason, /no JSON object/);
});

test('a reply with every field empty fails', () => {
  const parsed = parseReport('{"fault": "", "action": "", "parts": [], "test": "", "followUp": ""}');
  assert.equal(parsed.ok, false);
  assert.match(parsed.reason, /no report fields/);
});

test('missing fields default to empty instead of failing', () => {
  const parsed = parseReport('{"fault": "Seal failed"}');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.report.action, '');
  assert.deepEqual(parsed.report.parts, []);
});
