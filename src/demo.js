// Scripted demo. Runs the local formatter on three sample notes and
// prints the path selection table. No browser and no network needed.

import { formatNote, reportToText } from './format.js';
import { selectPath, PATH_LABELS } from './path.js';
import { SAMPLE_NOTES } from './samples.js';

function main() {
  console.log('ShopScribe demo: local formatter\n');
  for (const note of SAMPLE_NOTES) {
    console.log(`Note: ${note}`);
    console.log(reportToText(formatNote(note)));
    console.log('');
  }

  console.log('Path selection:');
  const cases = [
    { onDevice: 'available', cloudConfigured: true },
    { onDevice: 'unavailable', cloudConfigured: true },
    { onDevice: 'unavailable', cloudConfigured: false },
    { onDevice: 'downloadable', cloudConfigured: false },
  ];
  for (const entry of cases) {
    const path = selectPath(entry);
    console.log(
      `  on-device ${entry.onDevice}, cloud ${entry.cloudConfigured ? 'configured' : 'off'} -> ${PATH_LABELS[path]}`,
    );
  }
  console.log('\nFor the full app with the on-device and cloud paths:');
  console.log('  node serve.js');
  console.log('  then open http://localhost:8080');
}

main();
