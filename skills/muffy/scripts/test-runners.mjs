// Shared by guard-full-regression.mjs and guard-test-level.mjs: recognise a test-runner command line.
// parseSegment(seg, extra) -> null (not a test run) | { whole, kind } where
//   whole = no path, name or filter (runs everything), kind = 'unit' | 'integration' | 'e2e'.
// Known limits: runners behind wrapper scripts, `node -e`, a flag's value mistaken for a test path (fails open).

const FILTER_FLAG = /^(-t|-g|-k|-m|--grep|--filter|--testNamePattern|--test-name-pattern|--testPathPattern|--project|--shard|--changedSince|--onlyChanged|--only-changed|--findRelatedTests|--lf|--ff|--last-failed|--failed-first|--spec|--specs|--tag|--tags|--include|--files?)(=|$)/;
const RUNNERS = [
  /^(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+(?:run\s+)?|bunx\s+)?(vitest|jest|mocha|ava|playwright\s+test|cypress\s+run|karma\s+start|tap)(\s.*)?$/,
  /^(?:python3?\s+-m\s+|uv\s+run\s+|poetry\s+run\s+)?(pytest|unittest|nose2|tox)(\s.*)?$/,
  /^(go\s+test|cargo\s+test|cargo\s+nextest\s+run|dotnet\s+test|mvn\s+(?:\S+\s+)*?test|\.\/gradlew\s+test|gradle\s+test|rspec|phpunit|bundle\s+exec\s+rspec|make\s+test|mix\s+test|swift\s+test|deno\s+test|bun\s+test)(\s.*)?$/,
];
const TEST_SCRIPT = /^(test|e2e|ci|regression|verify)([:.-].*)?$/; // package-manager scripts that run tests
const WIDE_SCRIPT = /^(test|test:all|test:e2e|test:ci|test:full|test:regression|e2e|ci|regression|verify)$/;
const PM = /^(npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:.-]+)(\s.*)?$/;
const E2E = /(^|[\s/\\])(e2e|cypress|playwright)([\s/\\.:-]|$)|\.e2e\./i;
const INTEGRATION = /(^|[\s/\\])integration([\s/\\.:-]|$)|\.integration\./i;

export const kindOf = (text) => (E2E.test(text) ? 'e2e' : INTEGRATION.test(text) ? 'integration' : 'unit');

export const isScoped = (args) => {
  const toks = args.trim().split(/\s+/).filter(Boolean);
  if (/^(run|watch|test|start)$/.test(toks[0] ?? '')) toks.shift(); // runner subcommand (vitest run), not a path
  const afterDashes = toks.includes('--') ? toks.slice(toks.indexOf('--') + 1) : toks;
  return afterDashes.some((t) => FILTER_FLAG.test(t) || !t.startsWith('-')); // any path/pattern, or a filter flag
};

export function parseSegment(seg, extra = []) {
  if (extra.some((re) => re.test(seg))) return { whole: true, kind: kindOf(seg) };
  const pm = seg.match(PM);
  if (pm) {
    if (!TEST_SCRIPT.test(pm[2])) return null;
    return { whole: WIDE_SCRIPT.test(pm[2]) && !isScoped(pm[3] ?? ''), kind: kindOf(`${pm[2]} ${pm[3] ?? ''}`) };
  }
  for (const re of RUNNERS) {
    const m = seg.match(re);
    if (!m) continue;
    const args = m[2] ?? '';
    const whole = m[1] === 'go test' ? /(^|\s)\.\/\.\.\.(\s|$)/.test(args) || !isScoped(args) : !isScoped(args);
    return { whole, kind: /^(playwright|cypress)/.test(m[1]) ? 'e2e' : kindOf(args) };
  }
  return null;
}

export const splitCommand = (cmd) => cmd.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean);
