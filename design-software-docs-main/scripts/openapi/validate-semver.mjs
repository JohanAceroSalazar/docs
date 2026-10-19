#!/usr/bin/env node
/** Enforce the documented OpenAPI semantic-versioning policy. */

import { readFileSync, statSync } from 'node:fs';

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const argument = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) fail(`Missing required argument ${name}.`);
  return process.argv[index + 1];
};

const readable = (path) => {
  try {
    return statSync(path).isFile() && statSync(path).size > 0;
  } catch {
    return false;
  }
};

const versionFrom = (path) => {
  if (!readable(path)) fail(`OpenAPI document does not exist or is empty: ${path}`);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  let infoIndent;
  let rawVersion;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (infoIndent === undefined) {
      if (/^\s*info:\s*(?:#.*)?$/.test(line)) infoIndent = indent;
      continue;
    }
    if (indent <= infoIndent) break;
    const match = line.match(/^\s+version:\s*(.+?)\s*(?:#.*)?$/);
    if (match) {
      rawVersion = match[1].trim().replace(/^(?:"|')|(?:"|')$/g, '');
      break;
    }
  }

  if (!rawVersion) fail(`OpenAPI document has no info.version: ${path}`);
  const match = rawVersion.match(semver);
  if (!match) fail(`info.version must use MAJOR.MINOR.PATCH without a prefix or suffix; got ${JSON.stringify(rawVersion)} in ${path}`);
  return match.slice(1).map(Number);
};

const consumerFacingChange = (path) => {
  if (!readable(path)) fail(`oasdiff changelog is missing or empty: ${path}`);
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`oasdiff changelog is not valid JSON: ${error.message}`);
  }
  return !(value === null || (Array.isArray(value) && value.length === 0) || (!Array.isArray(value) && typeof value === 'object' && Object.keys(value).length === 0));
};

const compare = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const base = versionFrom(argument('--base'));
const candidate = versionFrom(argument('--candidate'));
const changed = consumerFacingChange(argument('--changelog'));

if (compare(candidate, base) < 0) fail(`info.version cannot decrease: base=${base.join('.')}, candidate=${candidate.join('.')}`);
if (changed && compare(candidate, base) === 0) fail('A consumer-facing compatible contract change requires a version increase (MINOR or MAJOR).');
if (changed && candidate[0] === base[0] && candidate[1] === base[1]) fail('A consumer-facing compatible contract change requires a MINOR or MAJOR increment; PATCH is reserved for documentation-only changes.');

const category = changed ? 'consumer-facing compatible change' : 'documentation-only or no consumer-facing change';
console.log(`SemVer validation passed: ${category}; ${base.join('.')} -> ${candidate.join('.')}.`);
