import { DatabaseSync } from 'node:sqlite';

export function openDb(file = process.env.DB_FILE || 'zikr.db') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    -- ===================== USERS =====================
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#22b365',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ===================== USER PREFERENCES =====================
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      -- Privacy
      heatmap_public INTEGER NOT NULL DEFAULT 0,
      leaderboard_visible INTEGER NOT NULL DEFAULT 1,
      quran_public INTEGER NOT NULL DEFAULT 0,
      activity_sharing INTEGER NOT NULL DEFAULT 0,
      -- Prayer times
      prayer_calc_method TEXT NOT NULL DEFAULT 'MWL',
      asr_madhab TEXT NOT NULL DEFAULT 'Standard',
      latitude REAL,
      longitude REAL,
      city TEXT,
      timezone TEXT,
      -- Ramadan
      ramadan_mode INTEGER NOT NULL DEFAULT 0,
      taraweeh_rakats INTEGER NOT NULL DEFAULT 20,
      -- Notifications
      notifications_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_before_mins INTEGER NOT NULL DEFAULT 15,
      -- Smart fix
      smart_fix_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ===================== PRAYER LOGS =====================
    CREATE TABLE IF NOT EXISTS prayer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      prayer TEXT NOT NULL CHECK (prayer IN ('fajr','dhuhr','asr','maghrib','isha')),
      state TEXT NOT NULL CHECK (state IN ('jamaat','alone','missed','qaza')),
      points INTEGER NOT NULL DEFAULT 0,
      edited INTEGER NOT NULL DEFAULT 0,
      marked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, log_date, prayer)
    );
    CREATE INDEX IF NOT EXISTS idx_prayer_user_date ON prayer_logs (user_id, log_date);

    -- ===================== ZIKR =====================
    CREATE TABLE IF NOT EXISTS zikr_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS zikr_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      zikr_type_id INTEGER NOT NULL REFERENCES zikr_types(id),
      log_date TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      marked_at TEXT NOT NULL,
      UNIQUE (user_id, log_date, zikr_type_id)
    );
    CREATE INDEX IF NOT EXISTS idx_zikr_user_date ON zikr_logs (user_id, log_date);

    -- ===================== QURAN =====================
    CREATE TABLE IF NOT EXISTS quran_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      pages INTEGER NOT NULL DEFAULT 0 CHECK (pages >= 0),
      paras REAL NOT NULL DEFAULT 0 CHECK (paras >= 0),
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, log_date)
    );

    -- ===================== NAFL =====================
    CREATE TABLE IF NOT EXISTS nafl_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS nafl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nafl_type_id INTEGER NOT NULL REFERENCES nafl_types(id),
      log_date TEXT NOT NULL,
      marked_at TEXT NOT NULL,
      UNIQUE (user_id, log_date, nafl_type_id)
    );
    CREATE INDEX IF NOT EXISTS idx_nafl_user_date ON nafl_logs (user_id, log_date);

    -- ===================== POINTS TRANSACTIONS =====================
    CREATE TABLE IF NOT EXISTS points_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      source_id INTEGER,
      log_date TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pts_user_date ON points_transactions (user_id, log_date);

    -- ===================== FRIENDS =====================
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (from_user_id, to_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_fr_to ON friend_requests (to_user_id, status);

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_a, user_b),
      CHECK (user_a < user_b)
    );

    -- ===================== CHALLENGES =====================
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      challenge_type TEXT NOT NULL CHECK (challenge_type IN ('personal','friend')),
      category TEXT NOT NULL CHECK (category IN ('namaz','zikr','quran','mixed')),
      target_type TEXT NOT NULL,
      target_value REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS challenge_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
      progress REAL NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (challenge_id, user_id)
    );

    -- ===================== BADGES =====================
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🏆',
      category TEXT NOT NULL DEFAULT 'general',
      rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
      sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badges(id),
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, badge_id)
    );

    -- ===================== WEEKLY REPORTS =====================
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      report_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, week_start)
    );

    -- ===================== RAMADAN =====================
    CREATE TABLE IF NOT EXISTS ramadan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      fasted INTEGER NOT NULL DEFAULT 0,
      taraweeh INTEGER NOT NULL DEFAULT 0,
      tahajjud INTEGER NOT NULL DEFAULT 0,
      sadaqah INTEGER NOT NULL DEFAULT 0,
      quran_para REAL NOT NULL DEFAULT 0,
      notes TEXT,
      marked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, log_date)
    );
  `);

  // Auto-migration: ensure existing databases have the new avatar_color column in users
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    const hasAvatarColor = userCols.some(col => col.name === 'avatar_color');
    if (!hasAvatarColor) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#22b365'");
    }
  } catch (err) {
    console.error("Migration error (avatar_color):", err);
  }

  // Auto-migration: ensure points column in zikr_logs
  try {
    const zikrCols = db.prepare("PRAGMA table_info(zikr_logs)").all();
    const hasPoints = zikrCols.some(col => col.name === 'points');
    if (!hasPoints) {
      db.exec("ALTER TABLE zikr_logs ADD COLUMN points INTEGER NOT NULL DEFAULT 0");
    }
  } catch (err) {
    console.error("Migration error (zikr_logs points):", err);
  }

  // ---------- Seed data ----------
  const seed = db.prepare('INSERT OR IGNORE INTO zikr_types (slug, name, sort) VALUES (?, ?, ?)');
  seed.run('morning-azkar', 'Morning Azkar', 1);
  seed.run('evening-azkar', 'Evening Azkar', 2);

  const naflSeed = db.prepare('INSERT OR IGNORE INTO nafl_types (slug, name, sort) VALUES (?, ?, ?)');
  [['duha', 'Duha'], ['tahajjud', 'Tahajjud'], ['witr', 'Witr'], ['sunnah-rawatib', 'Sunnah Rawatib'], ['ishraq', 'Ishraq']]
    .forEach(([slug, name], i) => naflSeed.run(slug, name, i + 1));

  // Seed badges
  const badgeSeed = db.prepare('INSERT OR IGNORE INTO badges (slug, name, description, icon, category, rarity, sort) VALUES (?,?,?,?,?,?,?)');
  const badgeData = [
    ['first-step', 'First Step', 'Record your first prayer', '🌱', 'general', 'common', 1],
    ['consistency-7', 'Consistency', '7-day prayer tracking streak', '🔥', 'streak', 'uncommon', 2],
    ['consistency-30', 'Dedicated', '30-day prayer tracking streak', '💪', 'streak', 'rare', 3],
    ['consistency-100', 'Unstoppable', '100-day prayer tracking streak', '⭐', 'streak', 'epic', 4],
    ['fajr-champion-7', 'Fajr Champion', 'Fajr in Jamaat for 7 days', '🌅', 'prayer', 'uncommon', 5],
    ['fajr-champion-30', 'Fajr Hero', 'Fajr in Jamaat for 30 days', '🏆', 'prayer', 'rare', 6],
    ['all-jamaat-7', 'Full Jamaat Week', 'All 5 prayers in Jamaat for 7 days', '🕌', 'prayer', 'rare', 7],
    ['quran-journey', 'Quran Journey', 'Complete your first para', '📖', 'quran', 'common', 8],
    ['khatam', 'Khatam', 'Complete 30 paras', '✨', 'quran', 'legendary', 9],
    ['zikr-habit-7', 'Zikr Habit', '7 days of both morning and evening Azkar', '📿', 'zikr', 'uncommon', 10],
    ['zikr-habit-30', 'Zikr Master', '30 days of both morning and evening Azkar', '🌟', 'zikr', 'rare', 11],
    ['ramadan-spirit', 'Ramadan Spirit', 'Complete Ramadan goals', '🌙', 'ramadan', 'epic', 12],
    ['social-butterfly', 'Social Butterfly', 'Add your first friend', '🤝', 'social', 'common', 13],
    ['challenger', 'Challenger', 'Complete your first challenge', '🎯', 'challenge', 'common', 14],
    ['perfect-day', 'Perfect Day', 'All 5 prayers + both Azkar in one day', '💎', 'general', 'uncommon', 15],
  ];
  badgeData.forEach(b => badgeSeed.run(...b));

  return db;
}
