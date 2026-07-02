#!/usr/bin/env node
/**
 * Download the three soundtrack MP3s into public/assets/music/
 * Requires yt-dlp + ffmpeg on your PATH.
 *
 *   npm run music:fetch
 */
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_MUSIC } from '../src/data/gameMusic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/assets/music');

function hasYtDlp() {
  return spawnSync('yt-dlp', ['--version'], { stdio: 'ignore' }).status === 0;
}

if (!hasYtDlp()) {
  console.error('yt-dlp not found. Install it first:');
  console.error('  brew install yt-dlp');
  console.error('  or: pip install yt-dlp');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const track of GAME_MUSIC) {
  const target = join(outDir, `${track.key}.mp3`);
  const url = `https://www.youtube.com/watch?v=${track.youtube}`;
  console.log(`→ ${track.title} (${track.key}.mp3)`);
  execSync(
    `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${target}" "${url}"`,
    { stdio: 'inherit', cwd: root },
  );
}

console.log('\nDone. Tracks saved to public/assets/music/');
