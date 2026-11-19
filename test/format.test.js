import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNote, splitClauses, reportToText } from '../src/format.js';

test('leaking pump note splits into fault, action, parts, and test', () => {
  const report = formatNote('pump 3 leaking at seal, replaced gasket, tested 2h, ok');
  assert.equal(report.fault, 'Pump 3 leaking at seal');
  assert.equal(report.action, 'Replaced gasket');
  assert.deepEqual(report.parts, ['gasket']);
  assert.equal(report.test, 'Tested 2h; ok');
  assert.equal(report.followUp, '');
});

test('tripped compressor note picks up the follow-up', () => {
  const report = formatNote(
    'compressor tripped on overload, reset breaker, ran 30 min, needs new filter next week',
  );
  assert.equal(report.fault, 'Compressor tripped on overload');
  assert.equal(report.action, 'Reset breaker');
  assert.deepEqual(report.parts, []);
  assert.equal(report.test, 'Ran 30 min');
  assert.equal(report.followUp, 'Needs new filter next week');
});

test('noisy motor note joins multiple fault clauses', () => {
  const report = formatNote('motor noisy, bearing worn, replaced bearing, greased, checked vibration ok');
  assert.equal(report.fault, 'Motor noisy; bearing worn');
  assert.equal(report.action, 'Replaced bearing; greased');
  assert.deepEqual(report.parts, ['bearing']);
  assert.equal(report.test, 'Checked vibration ok');
});

test('parts are stripped of articles and trailing qualifiers', () => {
  const report = formatNote('seal failed, replaced the seal on pump 3, tested, no leaks');
  assert.deepEqual(report.parts, ['seal']);
  assert.equal(report.test, 'Tested; no leaks');
});

test('two parts joined by and are listed separately', () => {
  const report = formatNote('drive slipping, replaced belt and pulley, ran 10 min');
  assert.deepEqual(report.parts, ['belt', 'pulley']);
});

test('a bare symptom becomes the fault and nothing else', () => {
  const report = formatNote('valve stuck open');
  assert.equal(report.fault, 'Valve stuck open');
  assert.equal(report.action, '');
  assert.deepEqual(report.parts, []);
});

test('an empty note yields an empty report', () => {
  const report = formatNote('');
  assert.deepEqual(report, { fault: '', action: '', parts: [], test: '', followUp: '' });
});

test('unmatched text is kept as the fault so the report is never empty', () => {
  const report = formatNote('hello world');
  assert.equal(report.fault, 'Hello world');
});

test('splitClauses handles periods, semicolons, and newlines', () => {
  assert.deepEqual(splitClauses('a; b. c\nd'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(splitClauses(''), []);
});

test('reportToText renders all five fields with placeholders for gaps', () => {
  const text = reportToText(formatNote('pump 3 leaking at seal, replaced gasket, tested 2h, ok'));
  assert.match(text, /Fault: Pump 3 leaking at seal/);
  assert.match(text, /Action taken: Replaced gasket/);
  assert.match(text, /Parts used: gasket/);
  assert.match(text, /Test result: Tested 2h; ok/);
  assert.match(text, /Follow-up: not recorded/);
});
