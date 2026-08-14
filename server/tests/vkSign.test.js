'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeSign, verifyLaunchParams } = require('../src/vkSign');

describe('vk launch sign', () => {
  const secret = 'test-app-secret';

  it('accepts a valid signature', () => {
    const params = {
      vk_user_id: '12345',
      vk_app_id: '111',
      vk_ts: String(Math.floor(Date.now() / 1000))
    };
    const sign = computeSign(params, secret);
    const search = '?vk_app_id=111&vk_ts=' + params.vk_ts + '&vk_user_id=12345&sign=' + sign;
    const result = verifyLaunchParams(search, secret, { appId: '111' });
    assert.equal(result.ok, true);
    assert.equal(result.vkUserId, 12345);
  });

  it('rejects a tampered user id', () => {
    const params = { vk_user_id: '12345', vk_app_id: '111' };
    const sign = computeSign(params, secret);
    const search = '?vk_user_id=99999&vk_app_id=111&sign=' + sign;
    const result = verifyLaunchParams(search, secret);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_SIGN');
  });

  it('rejects missing sign', () => {
    const result = verifyLaunchParams('?vk_user_id=1', secret);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_SIGN');
  });

  it('rejects missing secret on server', () => {
    const result = verifyLaunchParams('?vk_user_id=1&sign=abc', '');
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SERVER_MISCONFIGURED');
  });

  it('rejects launch params without vk_ts', () => {
    const params = { vk_user_id: '12345', vk_app_id: '111' };
    const sign = computeSign(params, secret);
    const search = '?vk_app_id=111&vk_user_id=12345&sign=' + sign;
    const result = verifyLaunchParams(search, secret, { appId: '111' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'STALE_LAUNCH');
  });
});
