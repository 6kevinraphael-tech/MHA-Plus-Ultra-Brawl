#!/usr/bin/env node
/** Verify every game asset path resolves to a file on disk. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHARACTER_IMAGE_ASSETS } from '../src/data/characterImages.js';
import { UI_ASSETS } from '../src/data/uiAssets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATIC = [
  ...UI_ASSETS,
  ['bg-ua-entrance', '/assets/backgrounds/ua-entrance.png'],
  ['bg-ua-campus', '/assets/backgrounds/ua-campus.png'],
  ['bg-city-streets', '/assets/backgrounds/city-streets.png'],
  ['bg-dojo', '/assets/backgrounds/dojo.png'],
  ['bg-ground-beta', '/assets/backgrounds/ground-beta.png'],
  ['bg-forest-camp', '/assets/backgrounds/forest-camp.png'],
  ['mha-roster', '/assets/mha-roster.png'],
  ...CHARACTER_IMAGE_ASSETS,
];

const missing = [];
for (const [key, url] of STATIC) {
  const file = path.join(root, 'public', url);
  if (!fs.existsSync(file)) missing.push({ key, file });
}

if (missing.length) {
  console.error(`Missing ${missing.length} asset(s):`);
  for (const m of missing) console.error(`  ${m.key} → ${m.file}`);
  process.exit(1);
}

console.log(`OK — ${STATIC.length} assets verified.`);
