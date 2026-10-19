#!/usr/bin/env node
/** Self-contained tests for the Reference Data SemVer validator. */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const validator = join(root, 'scripts/openapi/validate-semver.mjs');
const directory = mkdtempSync(join(tmpdir(), 'reference-data-semver-'));
const base = join(directory, 'base.yaml');
const candidate = join(directory, 'candidate.yaml');
const report = join(directory, 'changelog.json');

const contract = (path, version) => writeFileSync(path, `openapi: 3.1.0\ninfo:\n  title: Test API\n  version: ${version}\npaths: {}\n`);
const execute = () => spawnSync(process.execPath, [validator, '--base', base, '--candidate', candidate, '--changelog', report], { encoding: 'utf8' });
const expectExit = (result, code, name) => {
  if (result.status !== code) throw new Error(`${name}: expected exit ${code}, got ${result.status}; stderr=${result.stderr}`);
};

try {
  contract(base, '1.0.0');
  contract(candidate, '1.0.0');
  writeFileSync(report, '{}');
  expectExit(execute(), 0, 'unchanged contract');

  contract(candidate, '1.1.0');
  writeFileSync(report, JSON.stringify({ paths: { added: ['/catalogs'] } }));
  expectExit(execute(), 0, 'compatible change with MINOR increment');

  contract(candidate, '2.0.0');
  expectExit(execute(), 0, 'compatible change with MAJOR increment');

  contract(candidate, '1.0.1');
  expectExit(execute(), 1, 'compatible change with PATCH increment');

  contract(candidate, '0.9.9');
  writeFileSync(report, '{}');
  expectExit(execute(), 1, 'version decrease');

  contract(candidate, 'invalid');
  expectExit(execute(), 1, 'invalid SemVer');

  const missing = join(directory, 'missing.yaml');
  const missingResult = spawnSync(process.execPath, [validator, '--base', missing, '--candidate', candidate, '--changelog', report], { encoding: 'utf8' });
  expectExit(missingResult, 1, 'missing base contract');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('SemVer validator tests passed.');
