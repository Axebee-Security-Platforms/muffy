// Shared reading of contract/ownership.md (references/steps.md step 5): one owner per row, FE, BE or devops.
// Used by check-artifacts.mjs (the table itself) and check-ownership.mjs (the branches against it).

const OWNERS = { fe: 'FE', 'frontend-dev': 'FE', be: 'BE', 'backend-dev': 'BE', devops: 'devops', ops: 'devops' };

// `| src/auth/** | BE |` rows; the header and separator rows are skipped. Backticks around a pattern are allowed.
export function parseOwnership(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => /^\|/.test(l) && !/^\|[\s:-]+\|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, '')))
    .filter(([pattern, owner]) => pattern && owner && !/^(file|path|pattern)s?$/i.test(pattern))
    .map(([pattern, owner]) => ({ pattern: pattern.replace(/\\/g, '/').replace(/^\.\//, ''), raw: owner, owner: OWNERS[owner.toLowerCase()] ?? null }));
}

// A glob with no wildcard also matches everything under it as a folder (`src/auth` covers `src/auth/x.ts`).
export function globRe(pattern) {
  const p = pattern.replace(/\/$/, '');
  const body = p.replace(/[.+^${}()|[\]]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0001/g, '(?:.*/)?').replace(/\u0000/g, '.*');
  return new RegExp(/[*?]/.test(p) ? `^${body}$` : `^${body}(/.*)?$`);
}

const sample = (pattern) => pattern.replace(/\/$/, '').replace(/\*\*/g, 'x/y').replace(/[*?]/g, 'x');

export function ownershipErrors(rows) {
  const errors = [];
  for (const r of rows) if (!r.owner) errors.push(`contract/ownership.md: "${r.pattern}" has owner "${r.raw}"; use exactly one of FE, BE, devops (a file both edit is a seam in the wrong place)`);
  const owned = rows.filter((r) => r.owner);
  for (let i = 0; i < owned.length; i++) {
    for (const b of owned.slice(i + 1)) {
      const a = owned[i];
      if (a.owner !== b.owner && (globRe(a.pattern).test(sample(b.pattern)) || globRe(b.pattern).test(sample(a.pattern)))) {
        errors.push(`contract/ownership.md: "${a.pattern}" (${a.owner}) and "${b.pattern}" (${b.owner}) overlap; narrow one so every file has one owner`);
      }
    }
  }
  return errors;
}

export const ownersOf = (rows, file) => [...new Set(rows.filter((r) => r.owner && globRe(r.pattern).test(file)).map((r) => r.owner))];
