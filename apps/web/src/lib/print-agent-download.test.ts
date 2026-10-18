import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getPrintAgentDownloadUrls,
  getPrintAgentVersion,
  PRINT_AGENT_DOWNLOAD_API_PATHS,
  PRINT_AGENT_GITHUB_ASSETS,
} from './print-agent-download.ts';

test('getPrintAgentVersion does not read legacy print-agent VERSION file', () => {
  const prev = process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION;
  delete process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION;
  try {
    assert.equal(getPrintAgentVersion(), '');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION;
    else process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION = prev;
  }
});

test('getPrintAgentVersion returns env pin when set', () => {
  const prev = process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION;
  process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION = '0.5.35';
  try {
    assert.equal(getPrintAgentVersion(), '0.5.35');
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION;
    else process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION = prev;
  }
});

test('GitHub assets are Farvoo Fiscal Agent amd64 only', () => {
  assert.equal(PRINT_AGENT_GITHUB_ASSETS.setupAmd64, 'FarvooFiscalAgent-Setup-amd64.exe');
  assert.equal(PRINT_AGENT_GITHUB_ASSETS.portableAmd64, 'FarvooFiscalAgent-windows-amd64.zip');
  assert.equal('setupArm64' in PRINT_AGENT_GITHUB_ASSETS, false);
});

test('getPrintAgentDownloadUrls uses relative same-origin paths', () => {
  const prev = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO;
  process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO = 'jianping2024/farvoo-fatura';
  try {
    const urls = getPrintAgentDownloadUrls();
    assert.ok(urls);
    assert.equal(urls.setupAmd64, PRINT_AGENT_DOWNLOAD_API_PATHS.setupAmd64);
    assert.equal(urls.zipAmd64, PRINT_AGENT_DOWNLOAD_API_PATHS.portableAmd64);
    assert.match(urls.setupAmd64, /^\//);
    assert.doesNotMatch(urls.setupAmd64, /^https?:\/\//);
    assert.match(urls.releasesPage, /farvoo-fatura/);
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
