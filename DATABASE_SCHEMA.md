# Database schema — Бухгалтер-ниндзя 0.9.0

Источник: `server/migrations/001_init.sql`. Других миграций нет. Новых таблиц на этапе 9 не добавлялось.

Расширение: `pgcrypto` (для `gen_random_uuid()`).

## schema_migrations

| Колонка | Тип | Назначение |
| --- | --- | --- |
| id | TEXT PK | идентификатор применённой миграции |
| applied_at | TIMESTAMPTZ | когда применили |

## players

Игрок VK. Гостевой браузерный профиль в эту таблицу не пишется.

| Колонка | Тип | Назначение |
| --- | --- | --- |
| id | UUID PK | внутренний id |
| vk_user_id | BIGINT UNIQUE | id пользователя VK |
| display_name | TEXT | имя |
| avatar_url | TEXT | аватар HTTPS |
| is_leaderboard_eligible | BOOLEAN | участвует ли в рейтинге |
| created_at / updated_at / last_seen_at | TIMESTAMPTZ | служебные даты |

Индекс: `idx_players_vk_user_id`.

## player_progress

Прогресс 1:1 к игроку.

| Колонка | Тип |
| --- | --- |
| player_id | UUID PK → players |
| xp | INTEGER |
| player_level | INTEGER |
| rank | TEXT |
| high_score / best_combo / max_game_level | INTEGER |
| games_played | INTEGER |
| total_score | BIGINT |
| total_documents / total_payments / total_bonuses / total_penalties | INTEGER |
| events_completed / achievements_unlocked / daily_challenges_completed | INTEGER |
| current_streak / best_streak | INTEGER |
| last_play_date | DATE |
| updated_at | TIMESTAMPTZ |

## player_achievements

| Колонка | Тип |
| --- | --- |
| player_id | UUID → players |
| achievement_id | TEXT |
| unlocked_at | TIMESTAMPTZ |
| PK | (player_id, achievement_id) |

Индекс: `idx_player_achievements_player`.

## player_daily_challenges

| Колонка | Тип |
| --- | --- |
| player_id | UUID → players |
| date | DATE |
| challenge_id | TEXT |
| progress | INTEGER |
| completed | BOOLEAN |
| reward_claimed | BOOLEAN |
| PK | (player_id, date) |

## game_sessions

| Колонка | Тип |
| --- | --- |
| id | UUID PK |
| player_id | UUID → players |
| started_at / finished_at / created_at | TIMESTAMPTZ |
| score / level / best_combo | INTEGER |
| documents_caught / bonuses_caught / penalties_hit / payments_caught / events_completed | INTEGER |
| duration_ms | INTEGER |
| status | TEXT (`started` / `completed` / `rejected`) |
| game_version | TEXT |
| score_flag | TEXT (`normal` / `rejected` и др.) |
| reject_reason | TEXT |

Индексы: player_id, score, created_at, finished_at, составной board-индекс.

## auth_sessions

| Колонка | Тип |
| --- | --- |
| token_hash | TEXT PK |
| player_id | UUID → players |
| created_at / expires_at | TIMESTAMPTZ |

Индексы: player, expires.

Тестовыми строками рейтинга база не заполняется.
