import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getPrintAgentDownloadUrls,
  getPrintAgentVersion,
  PRINT_AGENT_DOWNLOAD_API_PATHS,
} from './print-agent-download.ts';

test('getPrintAgentVersion returns semver from VERSION file', () => {
  const version = getPrintAgentVersion();
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('getPrintAgentDownloadUrls uses relative same-origin paths', () => {
  const prev = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
  process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO = 'jianping2024/restaurant-ordering';
  try {
    const urls = getPrintAgentDownloadUrls();
    assert.ok(urls);
    assert.equal(urls.setupAmd64, PRINT_AGENT_DOWNLOAD_API_PATHS.setupAmd64);
    assert.equal(urls.zipAmd64, PRINT_AGENT_DOWNLOAD_API_PATHS.portableAmd64);
    assert.match(urls.setupAmd64, /^\//);
    assert.doesNotMatch(urls.setupAmd64, /^https?:\/\//);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
    else process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO = prev;
  }
});

test('getPrintAgentDownloadUrls is null without GitHub repo (on-prem hide)', () => {
  const prev = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
  delete process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
  try {
    assert.equal(getPrintAgentDownloadUrls(), null);
    process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO = '';
    assert.equal(getPrintAgentDownloadUrls(), null);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
    else process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO = prev;
  }
});
