#!/usr/bin/env node
// One-command devops preflight: replaces several separate checks with a short pass/fail report.
// Usage: node devops-preflight.mjs [--nvmrc .nvmrc] [--env-file .env.staging.local --var NAME[=prefix] ...] [--health URL] [--retries 10]
//   runtime: `node -v` must equal the .nvmrc version (a smoke on another Node proves nothing)
//   env:     each --var is checked by name (and optional value prefix); values are never printed
//   health:  GET URL must return 200 (retried every 2s, default 10 tries)
// Prints one line per check plus a JSON summary line. Exit 0 = all pass, 1 = a check failed, 2 = bad usage.
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const one = (name, dflt) => all(name)[0] ?? dflt;
if (args.some((a) => a.startsWith('--') && !['--nvmrc', '--env-file', '--var', '--health', '--retries'].includes(a))) {
  console.error('usage: devops-preflight.mjs [--nvmrc F] [--env-file F --var NAME[=prefix] ...] [--health URL] [--retries N]');
  process.exit(2);
}

const results = [];
const add = (check, ok, detail) => { results.push({ check, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${check}: ${detail}`); };

// runtime
const nvmrc = one('--nvmrc', '.nvmrc');
if (existsSync(nvmrc)) {
  const want = readFileSync(nvmrc, 'utf8').trim().replace(/^v/, '');
  const have = process.version.replace(/^v/, '');
  const ok = want === have || (want.split('.').length < 3 && have.startsWith(`${want}.`));
  add('runtime', ok, `node ${have}, ${nvmrc} wants ${want}`);
} else {
  add('runtime', false, `${nvmrc} not found`);
}

// env presence by name and prefix; values stay inside this process
const vars = all('--var');
if (vars.length) {
  const envFile = one('--env-file');
  if (!envFile || !existsSync(envFile)) {
    add('env', false, `env file ${envFile ?? '(none given)'} not found`);
  } else {
    const kv = new Map();
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) kv.set(m[1], m[2].replace(/^["']|["']$/g, ''));
    }
    for (const spec of vars) {
      const [name, prefix] = spec.split('=');
      const val = kv.get(name);
      if (val === undefined || val === '') add(`env ${name}`, false, 'missing or empty');
      else if (prefix && !val.startsWith(prefix)) add(`env ${name}`, false, `present, does not start with ${prefix}`);
      else add(`env ${name}`, true, prefix ? `present, starts with ${prefix}` : 'present');
    }
  }
}

// health
const url = one('--health');
if (url) {
  const tries = Number(one('--retries', 10));
  let last = 'no response';
  let ok = false;
  for (let i = 0; i < tries && !ok; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      last = `HTTP ${res.status}`;
      ok = res.status === 200;
    } catch (e) {
      last = e.cause?.code ?? e.message;
    }
    if (!ok && i < tries - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  add('health', ok, `${url} -> ${last}`);
}

console.log(JSON.stringify({ ok: results.every((r) => r.ok), checks: results.length, failed: results.filter((r) => !r.ok).map((r) => r.check) }));
process.exit(results.every((r) => r.ok) ? 0 : 1);
