// Shared by scan-repo.mjs (onboard scan) and check-baseline.mjs (baseline freshness): what counts as a manifest, which folders are not
// the project's own code, and the small file helpers. One list, so adding a language is one edit. Zero dependencies, read-only.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/* Folders that hold dependencies, build output or tool caches: never walked, never counted. Anything else a repo ignores is found
   through git (see gitIgnoredDirs). `bin` is not here on purpose: Node and Ruby projects keep real scripts in it. */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.parcel-cache', '.team', '.worktrees', '.claude',
  'venv', '.venv', '__pycache__', '.pytest_cache', '.mypy_cache', 'target', 'vendor', 'coverage', 'bower_components',
  '.dart_tool', '.gradle', 'Pods', 'DerivedData', 'obj', '.terraform',
]);

/* Manifests the scan lists, by exact name; project folders and files are matched by pattern. */
export const MANIFEST_NAMES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'composer.json', 'Gemfile', 'pubspec.yaml', 'Package.swift',
];
export const PROJECT_FILE = /\.(csproj|sln|xcodeproj|xcworkspace)$/;

/* What ages a baseline: the manifests above, their lockfiles, and infrastructure and CI files (matched on the file's own name). */
const LOCK_AND_INFRA = [
  'package-lock\\.json', 'pnpm-lock\\.yaml', 'yarn\\.lock', 'bun\\.lockb?', 'requirements.*\\.txt', 'poetry\\.lock', 'uv\\.lock', 'go\\.sum',
  'Cargo\\.lock', 'settings\\.gradle(\\.kts)?', 'gradle\\.properties', 'composer\\.lock', 'Gemfile\\.lock', 'pubspec\\.lock',
  'Package\\.resolved', 'Dockerfile.*', 'docker-compose.*\\.ya?ml', 'compose\\.ya?ml', '\\.nvmrc', '\\.node-version', '\\.python-version',
  '\\.tool-versions', 'vercel\\.json', 'fly\\.toml', 'netlify\\.toml', 'render\\.yaml', 'Procfile', 'Jenkinsfile', '\\.gitlab-ci\\.yml',
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const COVERED_FILE = new RegExp(`^(${[...MANIFEST_NAMES.map(escape), '.+\\.(csproj|sln)', ...LOCK_AND_INFRA].join('|')})$`);

/* True when any folder in the path is a skipped one (a committed node_modules/x/package.json is not the project's manifest). */
export const inSkippedDir = (relPath) => relPath.split('/').slice(0, -1).some((seg) => SKIP_DIRS.has(seg));

/* A project teaches the scripts what they do not know, in .team/stack-extensions.json:
   {"manifests": ["mix.exs"], "skipDirs": ["deps"], "platforms": ["game"]}. Names only; anything else in a value is ignored. */
export function loadExtensions(root) {
  const names = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^[\w.@/-]+$/.test(x) && !x.startsWith('/') && !x.split('/').includes('..')) : []);
  try {
    const j = JSON.parse(readFileSync(join(root, '.team', 'stack-extensions.json'), 'utf8'));
    return { manifests: names(j.manifests), skipDirs: names(j.skipDirs), platforms: names(j.platforms).map((p) => p.toLowerCase()) };
  } catch {
    return { manifests: [], skipDirs: [], platforms: [] };
  }
}

export function repoHelpers(root) {
  const has = (p) => existsSync(join(root, p));
  const readText = (p) => (has(p) ? readFileSync(join(root, p), 'utf8') : null);
  const readJson = (p) => { try { return JSON.parse(readText(p)); } catch { return null; } };
  const list = (p) => (has(p) && statSync(join(root, p)).isDirectory() ? readdirSync(join(root, p)) : []);
  // core.quotePath=false: git otherwise prints a non-ASCII path as an octal-escaped quoted string, which never matches a real folder or a cited path
  const git = (...a) => {
    try { return execFileSync('git', ['-c', 'core.quotePath=false', ...a], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim(); } catch { return null; }
  };
  return { has, readText, readJson, list, git };
}

/* Directories this repo's .gitignore (and the global and local excludes) keep out of git, as repo-relative paths without a trailing
   slash. One git call, however many folders. null when this is not a git repo, so the caller falls back to SKIP_DIRS alone. */
export function gitIgnoredDirs(root) {
  const out = repoHelpers(root).git('ls-files', '--others', '--ignored', '--exclude-standard', '--directory');
  if (out === null) return null;
  return new Set(out.split('\n').filter((l) => l.endsWith('/')).map((l) => l.slice(0, -1)));
}
