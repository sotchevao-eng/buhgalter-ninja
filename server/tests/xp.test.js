'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyXP, xpFromRun, getXPRequiredForLevel } = require('../src/xp');

describe('xp', () => {
  it('uses floor(score / 10) as the run base', () => {
    assert.equal(xpFromRun(1099, 0, 0), 109);
    assert.equal(xpFromRun(5000, 2, 1), 500 + 20 + 20);
  });

  it('levels up with the same curve as the game', () => {
    const need = getXPRequiredForLevel(1);
    const next = applyXP(need - 1, 1, 1);
    assert.equal(next.playerLevel, 2);
    assert.equal(next.xp, 0);
  });
});
