#!/usr/bin/env node
// One-command devops preflight: replaces several separate checks with a short pass/fail report.
// Usage: node devops-preflight.mjs [--nvmrc .nvmrc] [--toolchain NAME[=version] ...] [--env-file .env.staging.local --var NAME[=prefix] ...] [--health URL] [--retries 10]
//   runtime: `node -v` must equal the .nvmrc version (a smoke on another Node proves nothing). With --toolchain and no .nvmrc
//            this check is skipped: a Flutter, Swift, Kotlin or .NET repo has no .nvmrc
//   toolchain: each --toolchain NAME[=version] runs that tool's version command and must find it (and, with =version, that text
//            in its output); a missing one prints `toolchain-missing: <name> on <os>`. Names: node flutter dart xcodebuild swift dotnet java gradle android-sdk cargo go python docker
//   env:     each --var is checked by name (and optional value prefix); values are never printed
//   health:  GET URL must return 200 (retried every 2s, default 10 tries)
// Prints one line per check plus a JSON summary line. Exit 0 = all pass, 1 = a check failed, 2 = bad usage.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const one = (name, dflt) => all(name)[0] ?? dflt;
const TOOLCHAINS = {
  node: ['node', '--version'], flutter: ['flutter', '--version'], dart: ['dart', '--version'], xcodebuild: ['xcodebuild', '-version'],
  swift: ['swift', '--version'], dotnet: ['dotnet', '--version'], java: ['java', '-version'], gradle: ['gradle', '--version'],
  cargo: ['cargo', '--version'], go: ['go', 'version'], python: ['python3', '--version'], docker: ['docker', '--version'],
  'android-sdk': null, // an environment variable pointing at an existing folder, not a command
};
if (args.some((a) => a.startsWith('--') && !['--nvmrc', '--toolchain', '--env-file', '--var', '--health', '--retries'].includes(a)) || all('--toolchain').some((t) => !(t.split('=')[0] in TOOLCHAINS))) {
  console.error('usage: devops-preflight.mjs [--nvmrc F] [--toolchain NAME[=version] ...] [--env-file F --var NAME[=prefix] ...] [--health URL] [--retries N]\n  toolchain names: ' + Object.keys(TOOLCHAINS).join(' '));
  process.exit(2);
}

const results = [];
const add = (check, ok, detail) => { results.push({ check, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${check}: ${detail}`); };

// runtime
const nvmrc = one('--nvmrc', '.nvmrc');
const toolchains = all('--toolchain');
if (!existsSync(nvmrc) && toolchains.length && !args.includes('--nvmrc')) {
  // not a Node project: the toolchain checks below are the runtime check
} else if (existsSync(nvmrc)) {
  const want = readFileSync(nvmrc, 'utf8').trim().replace(/^v/, '');
  const have = process.version.replace(/^v/, '');
  const ok = want === have || (want.split('.').length < 3 && have.startsWith(`${want}.`));
  add('runtime', ok, `node ${have}, ${nvmrc} wants ${want}`);
} else {
  add('runtime', false, `${nvmrc} not found`);
}

// toolchain: the tool must exist on this host (a smoke or UI test for a target whose toolchain is absent proves nothing)
for (const spec of toolchains) {
  const [name, want] = spec.split('=');
  if (name === 'android-sdk') {
    const dir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    add(`toolchain ${name}`, Boolean(dir) && existsSync(dir), dir && existsSync(dir) ? 'ANDROID_HOME or ANDROID_SDK_ROOT is set' : `toolchain-missing: ${name} on ${platform()}`);
    continue;
  }
  const [cmd, ...cargs] = TOOLCHAINS[name];
  const r = spawnSync(cmd, cargs, { encoding: 'utf8', shell: platform() === 'win32', timeout: 20000 }); // fixed commands from the table above, never user text
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).find(Boolean) ?? '';
  if (r.error || r.status !== 0) add(`toolchain ${name}`, false, `toolchain-missing: ${name} on ${platform()}`);
  else if (want && !out.includes(want)) add(`toolchain ${name}`, false, `found "${out}", wants ${want}`);
  else add(`toolchain ${name}`, true, out);
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
