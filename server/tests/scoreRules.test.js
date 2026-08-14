'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateFinish, uniqueBestByPlayer } = require('../src/scoreRules');

function session(overrides) {
  return Object.assign({
    status: 'started',
    started_at: new Date(Date.now() - 20000).toISOString()
  }, overrides);
}

function okPayload(overrides) {
  return Object.assign({
    score: 240,
    level: 3,
    bestCombo: 6,
    documentsCaught: 8,
    bonusesCaught: 1,
    penaltiesHit: 0,
    paymentsCaught: 2,
    eventsCompleted: 0,
    durationMs: 20000
  }, overrides);
}

describe('score validation', () => {
  it('accepts a realistic result', () => {
    const result = validateFinish(okPayload(), session());
    assert.equal(result.ok, true);
    assert.equal(result.status, 'completed');
    assert.equal(result.scoreFlag, 'normal');
  });

  it('rejects a negative score', () => {
    const result = validateFinish(okPayload({ score: -10 }), session());
    assert.equal(result.ok, false);
    assert.equal(result.status, 'rejected');
  });

  it('rejects an impossible score for duration', () => {
    const result = validateFinish(okPayload({
      score: 999999,
      level: 10000,
      durationMs: 9000
    }), session({ started_at: new Date(Date.now() - 9000).toISOString() }));
    assert.equal(result.ok, false);
    assert.equal(result.status, 'rejected');
  });

  it('rejects a zero-duration session', () => {
    const result = validateFinish(okPayload({
      score: 0,
      level: 1,
      durationMs: 0,
      documentsCaught: 0,
      bonusesCaught: 0,
      paymentsCaught: 0
    }), session({ started_at: new Date().toISOString() }));
    assert.equal(result.ok, false);
  });

  it('rejects a level that does not match score', () => {
    const result = validateFinish(okPayload({ score: 240, level: 20 }), session());
    assert.equal(result.ok, false);
  });

  it('is idempotent when the session already finished', () => {
    const result = validateFinish(okPayload(), session({
      status: 'completed',
      score_flag: 'normal'
    }));
    assert.equal(result.ok, true);
    assert.equal(result.idempotent, true);
    assert.equal(result.status, 'completed');
  });
});

describe('leaderboard uniqueness', () => {
  it('keeps one best row per player', () => {
    const rows = uniqueBestByPlayer([
      { playerId: 'a', score: 100, bestCombo: 2, finishedAt: '2026-01-01T10:00:00Z' },
      { playerId: 'a', score: 180, bestCombo: 4, finishedAt: '2026-01-01T11:00:00Z' },
      { playerId: 'a', score: 150, bestCombo: 9, finishedAt: '2026-01-01T12:00:00Z' },
      { playerId: 'b', score: 180, bestCombo: 3, finishedAt: '2026-01-01T09:00:00Z' }
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.playerId === 'a').length, 1);
    assert.equal(rows[0].playerId, 'a');
    assert.equal(rows[0].score, 180);
    assert.equal(rows[1].playerId, 'b');
  });

  it('breaks ties by combo then earlier finish', () => {
    const rows = uniqueBestByPlayer([
      { playerId: 'a', score: 100, bestCombo: 5, finishedAt: '2026-01-01T12:00:00Z' },
      { playerId: 'b', score: 100, bestCombo: 5, finishedAt: '2026-01-01T10:00:00Z' }
    ]);
    assert.equal(rows[0].playerId, 'b');
  });
});
