#!/usr/bin/env node
/** Verify the fixed oasdiff gate with isolated temporary OpenAPI documents. */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const oasdiff = process.argv[2] ?? 'oasdiff';
const directory = mkdtempSync(join(tmpdir(), 'reference-data-oasdiff-'));
const base = join(directory, 'base.yaml');
const compatible = join(directory, 'compatible.yaml');
const removedEndpoint = join(directory, 'removed-endpoint.yaml');
const requiredParameter = join(directory, 'required-parameter.yaml');
const removedResponseProperty = join(directory, 'removed-response-property.yaml');

const run = (candidate) => spawnSync(oasdiff, ['breaking', '--fail-on', 'ERR', '--', base, candidate], { encoding: 'utf8' });
const requireExit = (result, expected, name) => {
  if (result.error) throw new Error(`${name}: could not execute ${oasdiff}: ${result.error.message}`);
  if (result.status !== expected) throw new Error(`${name}: expected exit ${expected}, got ${result.status}; stderr=${result.stderr}`);
};

try {
  writeFileSync(base, `openapi: 3.1.0\ninfo: {title: Test API, version: 1.0.0}\npaths:\n  /catalogs:\n    get:\n      responses:\n        '200':\n          description: OK\n          content:\n            application/json:\n              schema:\n                type: object\n                required: [id]\n                properties:\n                  id: {type: string}\n`);
  copyFileSync(base, compatible);
  writeFileSync(compatible, `${readFileSync(compatible, 'utf8')}  /parameters:\n    get:\n      responses:\n        '200': {description: OK}\n`);
  writeFileSync(removedEndpoint, `openapi: 3.1.0\ninfo: {title: Test API, version: 2.0.0}\npaths: {}\n`);
  writeFileSync(requiredParameter, `openapi: 3.1.0\ninfo: {title: Test API, version: 2.0.0}\npaths:\n  /catalogs:\n    get:\n      parameters:\n        - name: page\n          in: query\n          required: true\n          schema: {type: integer}\n      responses:\n        '200': {description: OK}\n`);
  writeFileSync(removedResponseProperty, `openapi: 3.1.0\ninfo: {title: Test API, version: 2.0.0}\npaths:\n  /catalogs:\n    get:\n      responses:\n        '200':\n          description: OK\n          content:\n            application/json:\n              schema:\n                type: object\n                properties: {}\n`);

  requireExit(run(compatible), 0, 'compatible addition');
  requireExit(run(removedEndpoint), 1, 'endpoint removal despite MAJOR increment');
  requireExit(run(requiredParameter), 1, 'new required request parameter');
  requireExit(run(removedResponseProperty), 1, 'removed required response property');
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('oasdiff gate tests passed.');
