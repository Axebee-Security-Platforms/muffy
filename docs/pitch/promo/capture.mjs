// Render promo.html frame by frame (JPEG q95) and encode it to WebM (VP9, no audio).
// Usage: node capture.mjs [out.webm]
// Needs: Playwright (PLAYWRIGHT_DIR = folder that holds node_modules/playwright), Chrome, and an ffmpeg with libvpx-vp9 (FFMPEG).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, 'muffy-promo.webm'));
const FPS = 30, SECONDS = 32;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const req = createRequire(path.join(process.env.PLAYWRIGHT_DIR || here, 'x.js'));
const { chromium } = req('playwright');

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'promo.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
});

const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
  '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
  '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));

const total = FPS * SECONDS;
for (let f = 0; f < total; f++) {
  await page.evaluate(t => window.seek(t), f / FPS);
  const img = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 150 === 0) console.log(`frame ${f}/${total}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log('wrote', out);
