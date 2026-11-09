#!/usr/bin/env node
// PreToolUse guard: blocks reading the contents of .env* files (references/hooks-enforcement.md §6).
// Hook JSON arrives on stdin. Exit 2 = block (stderr is shown to the agent), 0 = allow.
// Inline code (`node -e`, `python -c`, `pwsh -Command`, a heredoc on stdin, …) that names .env or dotenv is blocked.
// Known limits: a script file that reads .env, inline code that builds the path (`'.e'+'nv'`), and .NET calls are not caught.
import { readFileSync } from 'node:fs';
import { guardOff } from './plugin-gate.mjs';

if (guardOff()) process.exit(0); // plugin install without MUFFY_GUARD=1: the project did not opt in

const SAFE = /\.env\.(example|template|sample)$/i;
const isEnvPath = (p) => typeof p === 'string' && /(^|[\\/])\.env(\.[^\\/]*)?$/i.test(p) && !SAFE.test(p);
const isEnvGlob = (g) => typeof g === 'string' && /\.env/i.test(g) && !/\.env\.(example|template|sample)/i.test(g);
const NAME_CHECK = /[A-Z][A-Z0-9_]*=/; // a search for `NAME=` checks presence, not the value
const PRINTER = /(^|[\s;&|(])(cat|head|tail|less|more|type|bat|nl|tac|strings|xxd|od|printenv|env|source|gc|Get-Content|sed|awk|cp|copy)(\s|$)/i;
const GREP = /(^|[\s;&|(])(grep|egrep|fgrep|rg)(\s|$)/;
const PS_SEARCH = /(^|[\s;&|(])(Select-String|sls)(\s|$)/i;
const FINDSTR = /(^|[\s;&|(])findstr(\s|$)/i;
// grep/rg are quiet only with -q, -c, -l (or long forms): they never print matching lines
const GREP_QUIET = /(^|\s)-[A-Za-z]*[qcl][A-Za-z]*(?=\s|$)|--quiet|--count|--files-with-matches/;
const PS_QUIET = /\s-(Quiet|List|Count)\b/i;
const MENTIONS_ENV = /(^|[\s'"=\\/(])\.env(\.[\w.-]+)?(?=$|[\s'"|;&)`,])/;
// an interpreter running code given on the command line or on stdin, not a script file
const INLINE_CODE = /(^|[\s;&|(])((node|bun|deno)(\.exe)?\s+(\S+\s+)*?(-e|-p|--eval|--print|eval|-)(\s|$)|(python[\d.]*|py|perl|ruby)(\.exe)?\s+(\S+\s+)*?(-[A-Za-z]*[ceE]|-)(\s|$)|php(\.exe)?\s+(\S+\s+)*?-r(\s|$)|(pwsh|powershell)(\.exe)?\s+(\S+\s+)*?-(c|command|e|encodedcommand)(\s|$)|(node|bun|deno|python[\d.]*|py|perl|ruby|php)(\.exe)?\s*<)/i;
const DOTENV = /dotenv|load_dotenv|Dotenv::load|--env-file/i;

const block = (why) => {
  console.error(`[muffy] blocked: ${why}. Check variables by name and prefix only (references/hooks-enforcement.md §6).`);
  process.exit(2);
};

const raw = readFileSync(0, 'utf8');
let input;
try {
  input = JSON.parse(raw);
} catch {
  // unparseable payload: fail closed if it mentions .env, otherwise nothing to guard
  if (/\.env/i.test(raw)) block('unparseable hook payload mentions .env');
  process.exit(0);
}

const tool = input.tool_name ?? '';
const args = input.tool_input ?? {};

if (tool === 'Read' && isEnvPath(args.file_path)) block('Read on an .env file');

// Grep tool: only files_with_matches (the default) or count can run on .env; content mode prints values
if (tool === 'Grep' && (isEnvPath(args.path) || isEnvGlob(args.glob))) {
  if (args.output_mode === 'content') block('Grep content mode over .env prints values');
}

if (tool === 'Bash' || tool === 'PowerShell') {
  const cmd = String(args.command ?? '');
  const touchesEnv = MENTIONS_ENV.test(cmd) && !/\.env\.(example|template|sample)\b/i.test(cmd);
  const redirected = /<\s*\S*\.env/.test(cmd);
  const printsValue = /\$(\{|env:)?\w*(KEY|TOKEN|SECRET|PASSWORD)/i.test(cmd) && /(^|[\s;&|(])(echo|printf|Write-Output)(\s|$)/i.test(cmd);
  if (touchesEnv && (PRINTER.test(cmd) || redirected)) block('command prints an .env file');
  if (touchesEnv && FINDSTR.test(cmd)) block('findstr over .env prints matching lines');
  if (touchesEnv && GREP.test(cmd) && !(NAME_CHECK.test(cmd) && GREP_QUIET.test(cmd))) block('grep over .env needs a NAME= pattern and -q, -c or -l');
  if (touchesEnv && PS_SEARCH.test(cmd) && !(NAME_CHECK.test(cmd) && PS_QUIET.test(cmd))) block('Select-String over .env needs a NAME= pattern and -Quiet, -List or -Count');
  if (printsValue) block('command echoes a secret variable');
  if (INLINE_CODE.test(cmd) && (touchesEnv || DOTENV.test(cmd))) block('inline code (node -e, python -c, …) that loads .env can print its values; run the project script that needs it instead');
}

process.exit(0);
