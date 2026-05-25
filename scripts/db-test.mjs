#!/usr/bin/env node
// scripts/db-test.mjs
// Phase 2M.T1 — pgTAP runner for supabase/tests/*.sql.
//
// Iterates every .sql file (except 00_helpers.sql) and runs it via
// `psql` against the connection string in SUPABASE_DB_URL. Each test
// file is self-wrapped in BEGIN; ... ROLLBACK; so nothing mutates the
// database, even on failure.
//
// Output is parsed for pgTAP's two important lines:
//   - "1..N" plan line → expected test count
//   - "ok N - <desc>" / "not ok N - <desc>" → pass/fail
//   - "# Failed X of Y tests" → summary footer
//
// Exits non-zero if any assertion failed or if the runner couldn't
// reach psql at all. Best-effort, single-developer ergonomics — no
// retry, no parallelism, no CI niceties yet.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const testsDir = join(repoRoot, 'supabase', 'tests');

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('[db-test] Missing SUPABASE_DB_URL.');
  console.error('[db-test] Set it (e.g. in .env.test or your shell) to the form:');
  console.error('[db-test]   postgresql://postgres:<password>@<host>:5432/postgres');
  console.error('[db-test] Then re-run `npm run db:test`.');
  process.exit(2);
}

if (!existsSync(testsDir) || !statSync(testsDir).isDirectory()) {
  console.error(`[db-test] No tests directory at ${testsDir}`);
  process.exit(2);
}

// Run *.sql files in lexical order, excluding the helpers file (which
// is \i-included by each test file rather than executed standalone).
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith('.sql') && f !== '00_helpers.sql')
  .sort();

if (files.length === 0) {
  console.error('[db-test] No test files found.');
  process.exit(2);
}

const results = [];
let exitCode = 0;

for (const file of files) {
  const fullPath = join(testsDir, file);
  console.log(`\n──── ${file} ────`);

  let stdout = '';
  let psqlFailed = false;
  try {
    stdout = execFileSync(
      'psql',
      [
        DB_URL,
        '-v', 'ON_ERROR_STOP=1',
        '-X',                // skip ~/.psqlrc
        '-A',                // unaligned output → cleaner parse
        '-t',                // tuples only — drop column headers
        '-f', fullPath,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'], cwd: testsDir, encoding: 'utf8' }
    );
  } catch (err) {
    psqlFailed = true;
    stdout = err.stdout?.toString() ?? '';
    console.error(`[db-test] psql exited non-zero on ${file}`);
  }

  process.stdout.write(stdout);

  const passed = (stdout.match(/^ok \d+/gm) ?? []).length;
  const failed = (stdout.match(/^not ok \d+/gm) ?? []).length;
  const planMatch = stdout.match(/^1\.\.(\d+)/m);
  const planned = planMatch ? Number(planMatch[1]) : passed + failed;

  results.push({ file, planned, passed, failed, psqlFailed });
  if (failed > 0 || psqlFailed || passed !== planned) {
    exitCode = 1;
  }
}

// ── Summary ─────────────────────────────────────────────────────────
console.log('\n════ Summary ════');
const colWidth = Math.max(...results.map((r) => r.file.length));
for (const r of results) {
  const status = r.failed === 0 && !r.psqlFailed && r.passed === r.planned ? 'PASS' : 'FAIL';
  console.log(
    `  ${status}  ${r.file.padEnd(colWidth)}  ${r.passed}/${r.planned} passed` +
      (r.failed ? ` (${r.failed} failed)` : '') +
      (r.psqlFailed ? ' (psql error)' : '')
  );
}

const totalPassed = results.reduce((a, r) => a + r.passed, 0);
const totalPlanned = results.reduce((a, r) => a + r.planned, 0);
console.log(`\n  Total: ${totalPassed}/${totalPlanned} passed across ${results.length} file(s).`);

process.exit(exitCode);
