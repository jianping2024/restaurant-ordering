import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getWebAppBuildInfo } from './web-app-build.ts';

describe('getWebAppBuildInfo', () => {
  it('prefers MESA_WEB_VERSION over Vercel SHA', () => {
    const prevMesa = process.env.MESA_WEB_VERSION;
    const prevVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.MESA_WEB_VERSION = '965030f-20260801T1241Z';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef0123456789';
    try {
      assert.deepEqual(getWebAppBuildInfo(), { version: '965030f-20260801T1241Z' });
    } finally {
      if (prevMesa === undefined) delete process.env.MESA_WEB_VERSION;
      else process.env.MESA_WEB_VERSION = prevMesa;
      if (prevVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = prevVercel;
    }
  });

  it('falls back to short Vercel SHA when MESA_WEB_VERSION is unset', () => {
    const prevMesa = process.env.MESA_WEB_VERSION;
    const prevVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.MESA_WEB_VERSION;
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef0123456789';
    try {
      assert.deepEqual(getWebAppBuildInfo(), { version: 'abcdef0' });
    } finally {
      if (prevMesa === undefined) delete process.env.MESA_WEB_VERSION;
      else process.env.MESA_WEB_VERSION = prevMesa;
      if (prevVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = prevVercel;
    }
  });

  it('returns empty version when no env is set', () => {
    const prevMesa = process.env.MESA_WEB_VERSION;
    const prevVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.MESA_WEB_VERSION;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      assert.deepEqual(getWebAppBuildInfo(), { version: '' });
    } finally {
      if (prevMesa === undefined) delete process.env.MESA_WEB_VERSION;
      else process.env.MESA_WEB_VERSION = prevMesa;
      if (prevVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = prevVercel;
    }
  });
});
