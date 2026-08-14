/**
 * Рейтинг: LOCAL MODE без API, ONLINE MODE через backend.
 * Глобальная таблица только для подтверждённых VK-пользователей
 * с серверной сессией. Офлайн-результат остаётся личным рекордом.
 */
(function (global) {
  'use strict';

  function playerName() {
    const profile = global.playerProfile || {};
    const name = String(profile.firstName || '').trim();
    return name || 'Гость';
  }

  function buildEntry(score, extra) {
    extra = extra || {};
    const rank = extra.rank || (typeof getRank === 'function' ? getRank(score) : { title: '' });
    return {
      playerId: (global.playerProfile && global.playerProfile.id) || null,
      playerName: playerName(),
      score: Number(score) || 0,
      level: Number(extra.level) || 1,
      bestCombo: Number(extra.combo || extra.bestCombo) || 0,
      rank: rank.title || '',
      timestamp: new Date().toISOString()
    };
  }

  function localBoard(notice) {
    const records = StorageService.getRecords();
    return {
      mode: 'local',
      online: false,
      period: LeaderboardService.period,
      notice: notice || 'Личный локальный рекорд. Общий рейтинг доступен после входа через VK и подключения сервера.',
      personal: {
        highScore: records.highScore,
        maxCombo: records.maxCombo,
        maxLevel: records.maxLevel,
        gamesPlayed: records.gamesPlayed
      },
      rows: [],
      me: null
    };
  }

  const LeaderboardService = {
    mode: 'local',
    period: 'today',

    setPeriod: function (period) {
      if (period === 'today' || period === 'week' || period === 'all') {
        this.period = period;
      }
      return this.period;
    },

    submitScore: function (score, extra) {
      extra = extra || {};
      StorageService.saveHighScore(score);
      if (extra.combo) StorageService.saveMaxCombo(extra.combo);
      if (extra.bestCombo) StorageService.saveMaxCombo(extra.bestCombo);
      if (extra.level) StorageService.saveMaxLevel(extra.level);

      const localResult = {
        ok: true,
        local: true,
        entry: buildEntry(score, extra)
      };

      if (extra.sessionId && global.SyncService && SyncService.isOnline()) {
        return SyncService.finishSession(extra.sessionId, {
          score: score,
          level: extra.level,
          bestCombo: extra.combo || extra.bestCombo,
          documentsCaught: extra.documentsCaught,
          documentsCollected: extra.documentsCollected,
          bonusesCaught: extra.bonusesCaught,
          penaltiesHit: extra.penaltiesHit,
          paymentsCaught: extra.paymentsCaught,
          eventsCompleted: extra.eventsCompleted,
          durationMs: extra.duration || extra.durationMs,
          lostLifeThisRun: extra.lostLifeThisRun,
          gameVersion: global.APP_VERSION
        }).then(function (remote) {
          if (remote && remote.ok && remote.public) {
            LeaderboardService.mode = 'online';
            return { ok: true, local: false, public: true, entry: localResult.entry, remote: remote };
          }
          return {
            ok: true,
            local: true,
            public: false,
            notice: (remote && remote.error) || 'Результат сохранён локально и не попал в общий рейтинг.',
            entry: localResult.entry,
            remote: remote
          };
        });
      }

      return Promise.resolve(localResult);
    },

    getLeaderboard: function (period) {
      const used = period || this.period || 'all';
      this.period = used;
      const records = StorageService.getRecords();

      if (!ApiClient.isConfigured() || !SyncService || !SyncService.isOnline() || (FEATURES && FEATURES.onlineLeaderboard === false)) {
        this.mode = 'local';
        const cached = StorageService.loadLeaderboardCache(used);
        if (cached && cached.rows && cached.rows.length) {
          cached.stale = true;
          cached.personal = {
            highScore: records.highScore,
            maxCombo: records.maxCombo,
            maxLevel: records.maxLevel,
            gamesPlayed: records.gamesPlayed
          };
          return Promise.resolve(cached);
        }
        return Promise.resolve(localBoard());
      }

      this.mode = 'online';
      return ApiClient.get('/api/v1/leaderboard?period=' + encodeURIComponent(used)).then(function (data) {
        const board = {
          mode: 'online',
          online: true,
          period: data.period || used,
          timezone: data.timezone,
          notice: '',
          personal: {
            highScore: records.highScore,
            maxCombo: records.maxCombo,
            maxLevel: records.maxLevel,
            gamesPlayed: records.gamesPlayed
          },
          rows: data.rows || [],
          me: data.me || null
        };
        StorageService.saveLeaderboardCache(used, board);
        return board;
      }).catch(function (err) {
        const cached = StorageService.loadLeaderboardCache(used);
        if (cached) {
          cached.stale = true;
          cached.notice = (err && err.friendly) || 'Показана сохранённая таблица. Сервер недоступен.';
          return cached;
        }
        return localBoard((err && err.friendly) || 'Не удалось загрузить общий рейтинг.');
      });
    },

    getPlayerPosition: function (period) {
      const used = period || this.period || 'all';
      if (!ApiClient.isConfigured() || !SyncService || !SyncService.isOnline() || (FEATURES && FEATURES.onlineLeaderboard === false)) {
        const records = StorageService.getRecords();
        return Promise.resolve({
          mode: 'local',
          position: null,
          score: records.highScore
        });
      }
      return ApiClient.get('/api/v1/leaderboard/me?period=' + encodeURIComponent(used)).then(function (data) {
        return {
          mode: 'online',
          position: data.position,
          score: data.score,
          bestCombo: data.bestCombo
        };
      }).catch(function () {
        const records = StorageService.getRecords();
        return { mode: 'local', position: null, score: records.highScore };
      });
    }
  };

  global.LeaderboardService = LeaderboardService;
  global.submitScore = function (score, extra) {
    return LeaderboardService.submitScore(score, extra);
  };
  global.getLeaderboard = function (period) {
    return LeaderboardService.getLeaderboard(period);
  };
})(window);
