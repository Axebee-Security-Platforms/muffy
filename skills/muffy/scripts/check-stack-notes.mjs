#!/usr/bin/env node
// Are the stack notes in docs/stacks/ still for the version this repo uses? (references/stack-learning.md)
//   node check-stack-notes.mjs [repo-root] [framework ...]     check every note, or only the named frameworks
//   node check-stack-notes.mjs [repo-root] --guard-entries      print the notes' `Whole-suite:` commands as a JSON array of regex strings,
//                                                               ready to merge into .team/regression-commands.json
// A note's first line is `Source: <url>, version <v>, <date>`. The version is compared by major number with the one the repo's
// manifests name for that framework (package.json, pyproject.toml, requirements.txt, pubspec.yaml, go.mod, Cargo.toml, Gemfile,
// composer.json, Gradle files, .csproj). Facts only; no source file is read and no network is used.
// Output: one line per note: `fresh`, `stale`, `unchecked` (no version on one side), or `missing` (a named framework with no note).
// Exit 0 = nothing stale or missing, 1 = a note is stale or a named note is missing, 3 = bad usage.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoHelpers } from './repo-facts.mjs';

const args = process.argv.slice(2);
const guardEntries = args.includes('--guard-entries');
const bad = args.filter((a) => a.startsWith('--') && a !== '--guard-entries');
if (bad.length) { console.error('usage: check-stack-notes.mjs [repo-root] [framework ...] | --guard-entries'); process.exit(3); }
const positional = args.filter((a) => !a.startsWith('--'));
// the first argument is the repo root only when it looks like one: it holds docs/stacks/, or it is a path (".", "/x", "C:\x", "a/b").
// A framework name that is also a folder (prisma/, docker/, terraform/) stays a framework name.
const isRoot = (p) => readdirSafe(p) !== null && (existsSync(join(p, 'docs', 'stacks')) || /^\.{1,2}$|[\\/]/.test(p)) && !p.startsWith('@');
const root = positional.length && isRoot(positional[0]) ? positional[0] : '.';
const named = positional.filter((a) => a !== root);

function readdirSafe(p) { try { return readdirSync(p); } catch { return null; } }

const dir = join(root, 'docs', 'stacks');
const notes = (readdirSafe(dir) ?? []).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, ''));
const { readText, list } = repoHelpers(root);

if (guardEntries) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = [];
  for (const n of notes) {
    const m = readFileSync(join(dir, `${n}.md`), 'utf8').match(/^[-*]\s*Whole-suite:\s*`?([^`\n]+?)`?\s*$/im);
    if (m) out.push(`^${escape(m[1].trim())}$`);
  }
  console.log(JSON.stringify(out));
  process.exit(0);
}

const manifestText = () => {
  const files = ['package.json', 'pyproject.toml', 'requirements.txt', 'pubspec.yaml', 'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json', 'build.gradle', 'build.gradle.kts', 'pom.xml', ...list('.').filter((f) => /\.csproj$/.test(f))];
  return files.map((f) => readText(f) ?? '').join('\n');
};
const text = manifestText();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// name, an optional vendor suffix (composer "laravel/framework"), then separators and the word "version" only:
//   "next": "^15.0.0" · flutter_bloc: ^8.1.0 · gem 'rails', '~> 7.1.3' · tokio = { version = "1.37" } · Include="X" Version="8.0.0"
const manifestVersion = (name) => text.match(new RegExp(`(?<![\\w-])${esc(name)}(?:/[\\w.-]+)?(?![\\w-])(?:[\\s:=@~^<>"',{]|version)*v?(\\d+(?:\\.\\d+)*)`, 'i'))?.[1];
const major = (v) => String(v ?? '').match(/^\d+/)?.[0];

let problems = 0;
for (const name of named.length ? named : notes) {
  if (!notes.includes(name)) { console.log(`${name}: missing (no docs/stacks/${name}.md)`); problems++; continue; }
  const noteV = readFileSync(join(dir, `${name}.md`), 'utf8').match(/^\s*(?:[-*]\s*)?Source:[^\n]*?\bversion\s+v?(\d+(?:\.\d+)*)/im)?.[1];
  const repoV = manifestVersion(name);
  if (!noteV || !repoV) console.log(`${name}: unchecked (${!noteV ? 'the note names no version' : 'no version in the manifests'})`);
  else if (major(noteV) !== major(repoV)) { console.log(`${name}: stale (note is for ${noteV}, the repo uses ${repoV})`); problems++; }
  else console.log(`${name}: fresh (${noteV})`);
}
if (!notes.length && !named.length) console.log('no stack notes');
process.exit(problems ? 1 : 0);
