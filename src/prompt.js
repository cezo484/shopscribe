// Prompt building and reply parsing, shared by the on-device and cloud
// paths. Both paths ask for the same JSON shape so the report rendering
// stays identical whichever path produced it.

import { emptyReport } from './format.js';

export const REPORT_FIELDS = ['fault', 'action', 'parts', 'test', 'followUp'];

export function buildPrompt(note) {
  return [
    'Turn this raw maintenance note into a structured work report.',
    'Reply with JSON only, no other text.',
    'Use these fields: "fault", "action", "parts" (an array of strings), "test", "followUp".',
    'Use an empty string for a field the note does not cover, and an empty array for parts when no parts are named.',
    'Keep each field short, one sentence at most.',
    '',
    'Note:',
    String(note || '').trim(),
  ].join('\n');
}

function asString(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(asString).filter((item) => item.length > 0);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
  }
  return [];
}

// Parse a model reply into a report. Accepts a bare JSON object or one
// wrapped in a code fence. Returns { ok: true, report } or
// { ok: false, reason } so the caller can fall through to the next path.
export function parseReport(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, reason: 'empty reply' };
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, reason: 'no JSON object in reply' };
  }
  let parsed;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { ok: false, reason: 'reply was not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'reply JSON was not an object' };
  }
  const report = emptyReport();
  report.fault = asString(parsed.fault);
  report.action = asString(parsed.action);
  report.parts = asStringArray(parsed.parts);
  report.test = asString(parsed.test);
  report.followUp = asString(parsed.followUp);
  const hasContent =
    report.fault !== '' ||
    report.action !== '' ||
    report.parts.length > 0 ||
    report.test !== '' ||
    report.followUp !== '';
  if (!hasContent) {
    return { ok: false, reason: 'reply JSON had no report fields' };
  }
  return { ok: true, report };
}
