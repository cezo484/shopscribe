// Local rule-based formatter. Turns a raw shop note into a structured
// work report without calling any model. Used when neither the on-device
// model nor the cloud path is available, and as the last resort when a
// model reply cannot be parsed.

const FOLLOW_UP =
  /\b(needs?|need to|order|schedule|monitor|watch|recheck|follow[- ]?up|next (week|visit|time|month)|plan to|should|come back|keep an eye)\b/i;

const TEST =
  /\b(test(ed|ing)?|ran|run|checked|verified|verify|measured|measure|pressure|passed|pass|ok|working (now|fine|again)|no (more )?(leaks?|noise|fault)|holds?|trial)\b/i;

const ACTION =
  /\b(replaced|repaired|fixed|cleaned|tightened|adjusted|installed|removed|fitted|changed|greased|lubricated|lubed|welded|calibrated|reset|rebuilt|swapped|unblocked|bled|flushed|torqued|sealed|repacked|serviced|overhauled|painted|aligned)\b/i;

const FAULT =
  /\b(leak(ing|s|ed)?|broken|failed|failure|fault(y)?|noise|noisy|vibrat\w*|overheat\w*|tripped|not working|worn|cracked|crack|jammed|jam|loose|smell|smoke|error|alarm|stuck|dead|burnt|burned|short circuit|seized|clogged|blocked|rusty|corroded)\b/i;

// "replaced the seal on pump 3" -> "seal"
const PART_VERB =
  /\b(?:replaced|installed|fitted|changed|swapped|repacked)\b\s+(?:the\s+|a\s+|an\s+|new\s+)?(.+)$/i;

const STOP_WORDS = new Set(['the', 'a', 'an', 'new', 'and', 'on', 'for', 'with', 'using']);

export function emptyReport() {
  return { fault: '', action: '', parts: [], test: '', followUp: '' };
}

function cleanClause(clause) {
  return clause
    .replace(/[.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Split a note into short clauses, keeping their order.
export function splitClauses(note) {
  return String(note || '')
    .split(/[.;\n]+/)
    .flatMap((sentence) => sentence.split(/,\s+/))
    .map(cleanClause)
    .filter((clause) => clause.length > 0);
}

function classify(clause) {
  if (FOLLOW_UP.test(clause)) return 'followUp';
  if (TEST.test(clause)) return 'test';
  if (ACTION.test(clause)) return 'action';
  if (FAULT.test(clause)) return 'fault';
  return null;
}

function extractParts(clause) {
  const match = PART_VERB.exec(clause);
  if (!match) return [];
  const phrase = match[1]
    .split(/\s+(?:on|for|with|using)\s+/i)[0]
    .replace(/[.;]+$/g, '')
    .trim();
  return phrase
    .split(/\s+and\s+/i)
    .map((part) =>
      part
        .split(/\s+/)
        .filter((word) => !STOP_WORDS.has(word.toLowerCase()))
        .join(' ')
        .trim()
        .toLowerCase(),
    )
    .filter((part) => part.length > 0);
}

export function formatNote(note) {
  const report = emptyReport();
  const clauses = splitClauses(note);
  const buckets = { fault: [], action: [], test: [], followUp: [] };
  let sawUnclassified = false;

  for (const clause of clauses) {
    const field = classify(clause);
    if (field === 'action') {
      for (const part of extractParts(clause)) {
        if (!report.parts.includes(part)) report.parts.push(part);
      }
    }
    if (field) {
      buckets[field].push(clause);
      continue;
    }
    // An unclassified clause at the start of a note is usually the symptom.
    // Later ones read as extra work done.
    if (!sawUnclassified && buckets.fault.length === 0 && buckets.action.length === 0) {
      buckets.fault.push(clause);
    } else {
      buckets.action.push(clause);
    }
    sawUnclassified = true;
  }

  for (const field of Object.keys(buckets)) {
    report[field] = capitalize(buckets[field].join('; '));
  }

  // Nothing matched anywhere: keep the whole note as the fault so the
  // report is never empty.
  if (!report.fault && !report.action && !report.test && !report.followUp) {
    report.fault = capitalize(String(note || '').replace(/\s+/g, ' ').trim());
  }

  return report;
}

// Plain-text version of a report, used by the copy button and the demo.
export function reportToText(report) {
  const lines = [
    `Fault: ${report.fault || 'not recorded'}`,
    `Action taken: ${report.action || 'not recorded'}`,
    `Parts used: ${report.parts && report.parts.length > 0 ? report.parts.join(', ') : 'none recorded'}`,
    `Test result: ${report.test || 'not recorded'}`,
    `Follow-up: ${report.followUp || 'not recorded'}`,
  ];
  return lines.join('\n');
}
