#!/usr/bin/env node
// Run a command and keep its output out of the conversation: the full output goes to a log file, and only the
// exit code, the line count and a short digest are printed. Zero dependencies.
//
//   node run-quiet.mjs [--tail 15] [--grep 15] [--out <file>] -- <command ...>
//   node run-quiet.mjs -- npm test
//   node run-quiet.mjs --tail 30 -- git log --oneline -200
//
// Prints: `exit=<code> lines=<n> log=<path>`, then the last --tail lines (default 15), then up to --grep (default 15)
// earlier lines that look like errors (error|fail|✗|panic|exception|warn). Read the log file with a narrow Grep or
// Read offset/limit only when the digest is not enough. Exit code = the command's exit code (127 if it did not start).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) { console.error('usage: run-quiet.mjs [--tail N] [--grep N] [--out file] -- <command ...>'); process.exit(2); }
const opt = { tail: 15, grep: 15, out: '' };
for (let i = 0; i < sep; i++) {
  const k = argv[i].replace(/^--/, '');
  if (!(k in opt) || i + 1 >= sep) { console.error(`bad option: ${argv[i]}`); process.exit(2); }
  opt[k] = k === 'out' ? argv[++i] : Number(argv[++i]);
}
const cmd = argv.slice(sep + 1);
// one argument = a shell line as typed; several = argv, quoted where they hold spaces (a Windows node.exe path does)
const line = cmd.length === 1 ? cmd[0] : cmd.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(' ');
const r = spawnSync(line, { shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (r.error) { console.error(`could not run: ${r.error.message}`); process.exit(127); }

const text = `${r.stdout ?? ''}${r.stderr ? `${r.stdout ? '\n' : ''}${r.stderr}` : ''}`;
const lines = text.replace(/\r\n/g, '\n').split('\n');
if (lines.at(-1) === '') lines.pop();
let log = opt.out;
if (!log) {
  const dir = join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'muffy-run-quiet');
  mkdirSync(dir, { recursive: true });
  log = join(dir, `${Date.now()}.log`);
}
writeFileSync(log, text);

const tail = lines.slice(-opt.tail);
const head = lines.slice(0, Math.max(0, lines.length - opt.tail));
const bad = head.filter((l) => /error|fail|✗|panic|exception|warn/i.test(l)).slice(0, opt.grep);
console.log(`exit=${r.status ?? 1} lines=${lines.length} log=${log.split('\\').join('/')}`);
if (bad.length) console.log(`-- earlier matches (${bad.length}) --\n${bad.join('\n')}\n-- last ${tail.length} lines --`);
console.log(tail.join('\n'));
process.exit(r.status ?? 1);
