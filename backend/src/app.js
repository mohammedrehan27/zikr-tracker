import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import POINTS_CONFIG from './points.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const STATES = ['jamaat', 'alone', 'missed', 'qaza'];
const POINTS = POINTS_CONFIG;
const DAY = 86400000;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const isoDay = (d) => d.toISOString().slice(0, 10);
const validDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && isoDay(d) === s;
};

export function createApp(db, opts = {}) {
  const secret = opts.secret || process.env.JWT_SECRET || 'dev-only-secret-change-me';
  const now = opts.now || (() => new Date());
  const secure = process.env.NODE_ENV === 'production';
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const today = () => isoDay(now());
  const notFuture = (d) => Date.parse(d) <= Date.parse(today()) + DAY;
  const daysAgo = (d) => Math.round((Date.parse(today()) - Date.parse(d)) / DAY);
  const bad = (res, msg) => res.status(400).json({ error: msg });
  const ts = () => now().toISOString();
  const round2 = (n) => Math.round(n * 100) / 100;
  const endParam = (req) => (req.query.end === undefined ? today() : req.query.end);

  // ==================== AUTH ====================
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: opts.authLimit || 30, standardHeaders: true, legacyHeaders: false });
  const setCookie = (res, uid) =>
    res.cookie('token', jwt.sign({ uid }, secret, { expiresIn: '30d' }), {
      httpOnly: true, sameSite: 'lax', secure, maxAge: 30 * DAY,
    });
  const requireAuth = (req, res, next) => {
    try { req.uid = jwt.verify(req.cookies.token, secret).uid; next(); }
    catch { res.status(401).json({ error: 'Not logged in' }); }
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/signup', authLimiter, (req, res) => {
    const { email, password, name } = req.body || {};
    const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const n = typeof name === 'string' ? name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return bad(res, 'Enter a valid email');
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return bad(res, 'Password must be 8 to 72 characters');
    if (!n || n.length > 50) return bad(res, 'Name is required (max 50 characters)');
    const colors = ['#22b365','#1a8a4e','#2d9d5f','#3aaf70','#15784a','#0d6640','#4bc080','#28a05a'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    try {
      const r = db.prepare('INSERT INTO users (email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?)').run(e, n, bcrypt.hashSync(password, 10), color);
      const uid = Number(r.lastInsertRowid);
      // Create default preferences
      db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(uid);
      setCookie(res, uid);
      res.status(201).json({ user: { id: uid, email: e, name: n, avatar_color: color } });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
      throw err;
    }
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const { email, password } = req.body || {};
    const u = typeof email === 'string' ? db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) : null;
    const ok = bcrypt.compareSync(typeof password === 'string' ? password : '', u ? u.password_hash : DUMMY_HASH);
    if (!u || !ok) return res.status(401).json({ error: 'Wrong email or password' });
    setCookie(res, u.id);
    res.json({ user: { id: u.id, email: u.email, name: u.name, avatar_color: u.avatar_color } });
  });

  app.post('/api/auth/logout', (_req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const u = db.prepare('SELECT id, email, name, avatar_color FROM users WHERE id = ?').get(req.uid);
    if (!u) return res.status(401).json({ error: 'Not logged in' });
    res.json({ user: u });
  });

  // ==================== PROFILE ====================
  app.put('/api/profile', requireAuth, (req, res) => {
    const { name } = req.body || {};
    const n = typeof name === 'string' ? name.trim() : '';
    if (!n || n.length > 50) return bad(res, 'Name is required (max 50 characters)');
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(n, req.uid);
    const u = db.prepare('SELECT id, email, name, avatar_color FROM users WHERE id = ?').get(req.uid);
    res.json({ user: u });
  });

  app.put('/api/profile/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') return bad(res, 'Invalid request');
    if (newPassword.length < 8 || newPassword.length > 72) return bad(res, 'New password must be 8 to 72 characters');
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.uid);
    if (!u || !bcrypt.compareSync(currentPassword, u.password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.uid);
    res.json({ ok: true });
  });

  app.get('/api/preferences', requireAuth, (req, res) => {
    let prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.uid);
    if (!prefs) {
      db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(req.uid);
      prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.uid);
    }
    res.json({ preferences: prefs });
  });

  app.put('/api/preferences', requireAuth, (req, res) => {
    const allowed = ['heatmap_public','leaderboard_visible','quran_public','activity_sharing',
      'prayer_calc_method','asr_madhab','latitude','longitude','city','timezone',
      'ramadan_mode','taraweeh_rakats','notifications_enabled','reminder_before_mins','smart_fix_enabled'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (updates.length === 0) return bad(res, 'No valid fields to update');
    updates.push('updated_at = ?');
    values.push(ts());
    values.push(req.uid);
    db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(req.uid);
    db.prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.uid);
    res.json({ preferences: prefs });
  });

  app.delete('/api/account', requireAuth, (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== 'string') return bad(res, 'Password required');
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.uid);
    if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: 'Wrong password' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.uid);
    res.clearCookie('token');
    res.json({ ok: true });
  });

  // ==================== DAY VIEW ====================
  const loadDay = (uid, date) => {
    const prayers = {};
    for (const p of db.prepare('SELECT prayer, state, points, edited FROM prayer_logs WHERE user_id = ? AND log_date = ?').all(uid, date))
      prayers[p.prayer] = { state: p.state, points: p.points, edited: !!p.edited };
    const zikr = db.prepare(`
      SELECT t.id, t.name, t.slug, (l.id IS NOT NULL) AS done, COALESCE(l.points, 0) AS points FROM zikr_types t
      LEFT JOIN zikr_logs l ON l.zikr_type_id = t.id AND l.user_id = ? AND l.log_date = ?
      WHERE t.active = 1 ORDER BY t.sort, t.id`).all(uid, date).map((z) => ({ id: z.id, name: z.name, slug: z.slug, done: !!z.done, points: z.points }));
    const q = db.prepare('SELECT pages, paras FROM quran_logs WHERE user_id = ? AND log_date = ?').get(uid, date);
    const quran = q ? { pages: q.pages, paras: q.paras } : { pages: 0, paras: 0 };
    const nafl = db.prepare(`
      SELECT t.id, t.name, (l.id IS NOT NULL) AS done FROM nafl_types t
      LEFT JOIN nafl_logs l ON l.nafl_type_id = t.id AND l.user_id = ? AND l.log_date = ?
      WHERE t.active = 1 ORDER BY t.sort, t.id`).all(uid, date).map((n) => ({ id: n.id, name: n.name, done: !!n.done }));
    const ago = daysAgo(date);
    return { date, prayers, zikr, quran, nafl, daysAgo: ago, pointsOpen: ago <= POINTS.windowDays };
  };

  app.get('/api/day/:date', requireAuth, (req, res) => {
    if (!validDate(req.params.date) || !notFuture(req.params.date)) return bad(res, 'Invalid date');
    res.json(loadDay(req.uid, req.params.date));
  });

  // ==================== PRAYERS ====================
  const checkFullDayBonus = (uid, date) => {
    // Check if all 5 prayers completed (not missed) AND both zikr done
    const prayerCount = db.prepare("SELECT COUNT(*) AS c FROM prayer_logs WHERE user_id = ? AND log_date = ? AND state != 'missed'").get(uid, date).c;
    const zikrCount = db.prepare("SELECT COUNT(*) AS c FROM zikr_logs WHERE user_id = ? AND log_date = ?").get(uid, date).c;
    const totalZikrTypes = db.prepare("SELECT COUNT(*) AS c FROM zikr_types WHERE active = 1").get().c;
    if (prayerCount >= 5 && zikrCount >= totalZikrTypes) {
      // Check if bonus already awarded
      const existing = db.prepare("SELECT 1 FROM points_transactions WHERE user_id = ? AND log_date = ? AND source = 'full_day'").get(uid, date);
      if (!existing && daysAgo(date) <= POINTS.windowDays) {
        db.prepare('INSERT INTO points_transactions (user_id, source, log_date, points, reason) VALUES (?,?,?,?,?)')
          .run(uid, 'full_day', date, POINTS.fullDay, 'All 5 prayers + both Azkar completed');
      }
    }
  };

  app.put('/api/prayers', requireAuth, (req, res) => {
    const { date, prayer, state } = req.body || {};
    if (!validDate(date) || !notFuture(date)) return bad(res, 'Invalid date');
    if (!PRAYERS.includes(prayer)) return bad(res, 'Invalid prayer');
    if (!STATES.includes(state)) return bad(res, 'Invalid state');
    const ex = db.prepare('SELECT * FROM prayer_logs WHERE user_id = ? AND log_date = ? AND prayer = ?').get(req.uid, date, prayer);
    const t = ts();
    if (!ex) {
      const pts = daysAgo(date) <= POINTS.windowDays ? POINTS[state] : 0;
      db.prepare('INSERT INTO prayer_logs (user_id, log_date, prayer, state, points, marked_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(req.uid, date, prayer, state, pts, t, t);
      if (pts > 0) {
        db.prepare('INSERT INTO points_transactions (user_id, source, source_id, log_date, points, reason) VALUES (?,?,?,?,?,?)')
          .run(req.uid, 'prayer', null, date, pts, `${prayer} - ${state}`);
      }
    } else if (ex.state !== state) {
      db.prepare('UPDATE prayer_logs SET state = ?, points = 0, edited = 1, updated_at = ? WHERE id = ?').run(state, t, ex.id);
    }
    checkFullDayBonus(req.uid, date);
    try { checkBadges(req.uid); } catch(e) { console.error('Badge check:', e); }
    res.json(loadDay(req.uid, date));
  });

  // ==================== ZIKR ====================
  app.put('/api/zikr', requireAuth, (req, res) => {
    const { date, zikrId, done } = req.body || {};
    if (!validDate(date) || !notFuture(date)) return bad(res, 'Invalid date');
    if (!Number.isInteger(zikrId) || typeof done !== 'boolean') return bad(res, 'Invalid request');
    if (!db.prepare('SELECT 1 FROM zikr_types WHERE id = ? AND active = 1').get(zikrId)) return bad(res, 'Unknown zikr');
    if (done) {
      const existing = db.prepare('SELECT 1 FROM zikr_logs WHERE user_id = ? AND zikr_type_id = ? AND log_date = ?').get(req.uid, zikrId, date);
      if (!existing) {
        const pts = daysAgo(date) <= POINTS.windowDays ? POINTS.zikr : 0;
        db.prepare('INSERT OR IGNORE INTO zikr_logs (user_id, zikr_type_id, log_date, points, marked_at) VALUES (?,?,?,?,?)').run(req.uid, zikrId, date, pts, ts());
        if (pts > 0) {
          db.prepare('INSERT INTO points_transactions (user_id, source, source_id, log_date, points, reason) VALUES (?,?,?,?,?,?)')
            .run(req.uid, 'zikr', zikrId, date, pts, 'Azkar completed');
        }
      }
    } else {
      db.prepare('DELETE FROM zikr_logs WHERE user_id = ? AND zikr_type_id = ? AND log_date = ?').run(req.uid, zikrId, date);
      // Remove points transaction too
      db.prepare("DELETE FROM points_transactions WHERE user_id = ? AND source = 'zikr' AND source_id = ? AND log_date = ?").run(req.uid, zikrId, date);
    }
    checkFullDayBonus(req.uid, date);
    try { checkBadges(req.uid); } catch(e) { console.error('Badge check:', e); }
    res.json(loadDay(req.uid, date));
  });

  // ==================== HEATMAP + STREAK ====================
  app.get('/api/heatmap', requireAuth, (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 42, 1), 366);
    const end = req.query.end === undefined ? today() : req.query.end;
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const start = isoDay(new Date(Date.parse(end) - (days - 1) * DAY));
    const prayers = db.prepare('SELECT log_date AS date, prayer, state FROM prayer_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, start, end);
    const zikr = db.prepare('SELECT log_date AS date, COUNT(*) AS count FROM zikr_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date').all(req.uid, start, end);
    res.json({ start, end, prayers, zikr });
  });

  const streakOf = (dates, end) => {
    const set = new Set(dates);
    let best = 0, run = 0, prev = null;
    for (const d of dates) {
      run = prev && Date.parse(d) - Date.parse(prev) === DAY ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    }
    let cur = 0, cursor = Date.parse(end);
    if (!set.has(isoDay(new Date(cursor)))) cursor -= DAY;
    while (set.has(isoDay(new Date(cursor)))) { cur++; cursor -= DAY; }
    return { current: cur, best };
  };

  app.get('/api/streak', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const dates = db.prepare("SELECT log_date FROM prayer_logs WHERE user_id = ? AND state != 'missed' GROUP BY log_date HAVING COUNT(*) = 5 ORDER BY log_date")
      .all(req.uid).map((r) => r.log_date);
    res.json({ ...streakOf(dates, end), completeDays: dates.length });
  });

  // ==================== POINTS ====================
  app.get('/api/points', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const weekStart = isoDay(new Date(Date.parse(end) - 6 * DAY));
    const monthStart = isoDay(new Date(Date.parse(end) - 29 * DAY));

    const total = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM points_transactions WHERE user_id = ?').get(req.uid).total;
    const weekPoints = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM points_transactions WHERE user_id = ? AND log_date BETWEEN ? AND ?').get(req.uid, weekStart, end).total;
    const monthPoints = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM points_transactions WHERE user_id = ? AND log_date BETWEEN ? AND ?').get(req.uid, monthStart, end).total;
    const todayPoints = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM points_transactions WHERE user_id = ? AND log_date = ?').get(req.uid, end).total;

    // Also count from prayer_logs for backward compat
    const prayerTotal = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM prayer_logs WHERE user_id = ?').get(req.uid).total;
    const zikrTotal = db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM zikr_logs WHERE user_id = ?').get(req.uid).total;

    res.json({
      total: total || (prayerTotal + zikrTotal),
      week: weekPoints,
      month: monthPoints,
      today: todayPoints,
    });
  });

  // ==================== QURAN ====================
  app.put('/api/quran', requireAuth, (req, res) => {
    const { date, unit, amount } = req.body || {};
    if (!validDate(date) || !notFuture(date)) return bad(res, 'Invalid date');
    if (unit !== 'pages' && unit !== 'paras') return bad(res, 'Invalid unit');
    const max = unit === 'pages' ? 604 : 30;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > max) return bad(res, `Enter a number from 0 to ${max}`);
    if (unit === 'pages' && !Number.isInteger(amount)) return bad(res, 'Pages must be a whole number');
    const ex = db.prepare('SELECT pages, paras FROM quran_logs WHERE user_id = ? AND log_date = ?').get(req.uid, date) || { pages: 0, paras: 0 };
    const next = { pages: ex.pages, paras: ex.paras, [unit]: round2(amount) };
    if (next.pages === 0 && next.paras === 0) {
      db.prepare('DELETE FROM quran_logs WHERE user_id = ? AND log_date = ?').run(req.uid, date);
    } else {
      db.prepare(`INSERT INTO quran_logs (user_id, log_date, pages, paras, updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT (user_id, log_date) DO UPDATE SET pages = excluded.pages, paras = excluded.paras, updated_at = excluded.updated_at`)
        .run(req.uid, date, next.pages, next.paras, ts());
    }
    res.json(loadDay(req.uid, date));
  });

  app.get('/api/quran/summary', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const all = db.prepare('SELECT log_date AS date, pages, paras FROM quran_logs WHERE user_id = ? ORDER BY log_date').all(req.uid);
    const mapStart = isoDay(new Date(Date.parse(end) - 34 * DAY));
    const weekStart = isoDay(new Date(Date.parse(end) - 6 * DAY));
    let pages = 0, paras = 0, totalPages = 0, total = 0;
    for (const r of all) {
      total += r.paras;
      totalPages += r.pages;
      if (r.date >= weekStart && r.date <= end) { pages += r.pages; paras += r.paras; }
    }
    total = round2(total);
    res.json({
      ...streakOf(all.map((r) => r.date), end),
      week: { pages, paras: round2(paras) },
      totalParas: total, totalPages,
      khatams: Math.floor(total / 30), inProgress: round2(total % 30),
      map: all.filter((r) => r.date >= mapStart && r.date <= end).map((r) => ({ date: r.date, pages: r.pages, paras: r.paras })),
    });
  });

  // ==================== NAFL ====================
  app.put('/api/nafl', requireAuth, (req, res) => {
    const { date, naflId, done } = req.body || {};
    if (!validDate(date) || !notFuture(date)) return bad(res, 'Invalid date');
    if (!Number.isInteger(naflId) || typeof done !== 'boolean') return bad(res, 'Invalid request');
    if (!db.prepare('SELECT 1 FROM nafl_types WHERE id = ? AND active = 1').get(naflId)) return bad(res, 'Unknown nafl');
    if (done) db.prepare('INSERT OR IGNORE INTO nafl_logs (user_id, nafl_type_id, log_date, marked_at) VALUES (?,?,?,?)').run(req.uid, naflId, date, ts());
    else db.prepare('DELETE FROM nafl_logs WHERE user_id = ? AND nafl_type_id = ? AND log_date = ?').run(req.uid, naflId, date);
    res.json(loadDay(req.uid, date));
  });

  app.get('/api/nafl/summary', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const start = isoDay(new Date(Date.parse(end) - 29 * DAY));
    const types = db.prepare('SELECT id, name FROM nafl_types WHERE active = 1 ORDER BY sort, id').all().map((t) => ({ id: t.id, name: t.name }));
    const logs = db.prepare('SELECT log_date AS date, nafl_type_id AS naflId FROM nafl_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, start, end)
      .map((l) => ({ date: l.date, naflId: l.naflId }));
    const dates = db.prepare('SELECT DISTINCT log_date FROM nafl_logs WHERE user_id = ? ORDER BY log_date').all(req.uid).map((r) => r.log_date);
    res.json({ ...streakOf(dates, end), types, logs });
  });

  // ==================== ZIKR STREAK ====================
  app.get('/api/zikr/streak', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const totalTypes = db.prepare('SELECT COUNT(*) AS c FROM zikr_types WHERE active = 1').get().c;
    const dates = db.prepare(`SELECT log_date FROM zikr_logs WHERE user_id = ? GROUP BY log_date HAVING COUNT(DISTINCT zikr_type_id) = ? ORDER BY log_date`)
      .all(req.uid, totalTypes).map((r) => r.log_date);
    res.json({ ...streakOf(dates, end), completeDays: dates.length });
  });

  // ==================== FRIENDS ====================
  app.get('/api/users/search', requireAuth, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) return res.json({ users: [] });
    const users = db.prepare("SELECT id, name, avatar_color FROM users WHERE id != ? AND (name LIKE ? OR email LIKE ?) LIMIT 20")
      .all(req.uid, `%${q}%`, `%${q}%`)
      .map(u => ({ id: u.id, name: u.name, avatar_color: u.avatar_color }));
    res.json({ users });
  });

  app.post('/api/friends/request', requireAuth, (req, res) => {
    const { userId } = req.body || {};
    if (!Number.isInteger(userId) || userId === req.uid) return bad(res, 'Invalid user');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return bad(res, 'User not found');
    // Check existing friendship
    const [a, b] = req.uid < userId ? [req.uid, userId] : [userId, req.uid];
    if (db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) return bad(res, 'Already friends');
    // Check existing request
    const existing = db.prepare('SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?').get(req.uid, userId, 'pending');
    if (existing) return bad(res, 'Request already sent');
    // Check reverse request - auto accept
    const reverse = db.prepare('SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?').get(userId, req.uid, 'pending');
    if (reverse) {
      db.prepare("UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?").run(ts(), reverse.id);
      db.prepare('INSERT OR IGNORE INTO friendships (user_a, user_b) VALUES (?, ?)').run(a, b);
      return res.json({ status: 'accepted' });
    }
    db.prepare('INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?)').run(req.uid, userId);
    res.status(201).json({ status: 'pending' });
  });

  app.get('/api/friends/requests', requireAuth, (req, res) => {
    const incoming = db.prepare(`SELECT fr.id, fr.from_user_id, u.name, u.avatar_color, fr.created_at
      FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
      WHERE fr.to_user_id = ? AND fr.status = 'pending' ORDER BY fr.created_at DESC`).all(req.uid);
    const outgoing = db.prepare(`SELECT fr.id, fr.to_user_id, u.name, u.avatar_color, fr.created_at
      FROM friend_requests fr JOIN users u ON u.id = fr.to_user_id
      WHERE fr.from_user_id = ? AND fr.status = 'pending' ORDER BY fr.created_at DESC`).all(req.uid);
    res.json({ incoming, outgoing });
  });

  app.put('/api/friends/requests/:id', requireAuth, (req, res) => {
    const { action } = req.body || {};
    if (action !== 'accept' && action !== 'reject') return bad(res, 'Invalid action');
    const fr = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = ?').get(parseInt(req.params.id), req.uid, 'pending');
    if (!fr) return res.status(404).json({ error: 'Request not found' });
    db.prepare(`UPDATE friend_requests SET status = ?, updated_at = ? WHERE id = ?`).run(action === 'accept' ? 'accepted' : 'rejected', ts(), fr.id);
    if (action === 'accept') {
      const [a, b] = fr.from_user_id < fr.to_user_id ? [fr.from_user_id, fr.to_user_id] : [fr.to_user_id, fr.from_user_id];
      db.prepare('INSERT OR IGNORE INTO friendships (user_a, user_b) VALUES (?, ?)').run(a, b);
    }
    res.json({ ok: true });
  });

  app.get('/api/friends', requireAuth, (req, res) => {
    const friends = db.prepare(`
      SELECT u.id, u.name, u.avatar_color FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
      WHERE f.user_a = ? OR f.user_b = ?
      ORDER BY u.name`).all(req.uid, req.uid, req.uid);
    res.json({ friends });
  });

  app.delete('/api/friends/:userId', requireAuth, (req, res) => {
    const userId = parseInt(req.params.userId);
    const [a, b] = req.uid < userId ? [req.uid, userId] : [userId, req.uid];
    db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(a, b);
    db.prepare("DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)").run(req.uid, userId, userId, req.uid);
    res.json({ ok: true });
  });

  // ==================== LEADERBOARD ====================
  app.get('/api/leaderboard', requireAuth, (req, res) => {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const end = today();
    const start = period === 'week' ? isoDay(new Date(Date.parse(end) - 6 * DAY)) : isoDay(new Date(Date.parse(end) - 29 * DAY));

    // Get friends + self who have leaderboard visible
    const friendIds = db.prepare(`SELECT CASE WHEN user_a = ? THEN user_b ELSE user_a END AS fid FROM friendships WHERE user_a = ? OR user_b = ?`)
      .all(req.uid, req.uid, req.uid).map(r => r.fid);
    const allIds = [req.uid, ...friendIds];
    const placeholders = allIds.map(() => '?').join(',');

    const rows = db.prepare(`
      SELECT u.id, u.name, u.avatar_color,
        COALESCE((SELECT SUM(points) FROM prayer_logs WHERE user_id = u.id AND log_date BETWEEN ? AND ?), 0) +
        COALESCE((SELECT SUM(points) FROM zikr_logs WHERE user_id = u.id AND log_date BETWEEN ? AND ?), 0) AS period_points,
        COALESCE((SELECT SUM(points) FROM prayer_logs WHERE user_id = u.id), 0) +
        COALESCE((SELECT SUM(points) FROM zikr_logs WHERE user_id = u.id), 0) AS total_points
      FROM users u
      LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.id IN (${placeholders}) AND COALESCE(p.leaderboard_visible, 1) = 1
      ORDER BY period_points DESC
    `).all(start, end, start, end, ...allIds);

    res.json({
      period,
      start,
      end,
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        id: r.id,
        name: r.name,
        avatar_color: r.avatar_color,
        periodPoints: r.period_points,
        totalPoints: r.total_points,
        isMe: r.id === req.uid,
      })),
    });
  });

  // ==================== CHALLENGES ====================
  app.post('/api/challenges', requireAuth, (req, res) => {
    const { title, description, challengeType, category, targetType, targetValue, durationDays, startDate, friendIds } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) return bad(res, 'Title required');
    if (!['personal', 'friend'].includes(challengeType)) return bad(res, 'Invalid challenge type');
    if (!['namaz', 'zikr', 'quran', 'mixed'].includes(category)) return bad(res, 'Invalid category');
    if (typeof targetType !== 'string' || !targetType.trim()) return bad(res, 'Target type required');
    if (typeof targetValue !== 'number' || targetValue <= 0) return bad(res, 'Invalid target value');
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) return bad(res, 'Duration must be 1-365 days');
    const start = startDate && validDate(startDate) ? startDate : today();
    const end = isoDay(new Date(Date.parse(start) + (durationDays - 1) * DAY));

    const r = db.prepare(`INSERT INTO challenges (creator_id, title, description, challenge_type, category, target_type, target_value, duration_days, start_date, end_date)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.uid, title.trim(), description || '', challengeType, category, targetType.trim(), targetValue, durationDays, start, end);
    const challengeId = Number(r.lastInsertRowid);

    // Creator auto-joins
    db.prepare("INSERT INTO challenge_participants (challenge_id, user_id, status) VALUES (?,?,'accepted')").run(challengeId, req.uid);

    // Invite friends
    if (challengeType === 'friend' && Array.isArray(friendIds)) {
      for (const fid of friendIds) {
        if (Number.isInteger(fid) && fid !== req.uid) {
          const [a, b] = req.uid < fid ? [req.uid, fid] : [fid, req.uid];
          if (db.prepare('SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?').get(a, b)) {
            db.prepare("INSERT OR IGNORE INTO challenge_participants (challenge_id, user_id, status) VALUES (?,?,'pending')").run(challengeId, fid);
          }
        }
      }
    }

    res.status(201).json({ challengeId });
  });

  app.get('/api/challenges', requireAuth, (req, res) => {
    const filter = req.query.status || 'active';
    const challenges = db.prepare(`
      SELECT c.*, cp.status AS my_status, cp.progress AS my_progress,
        (SELECT COUNT(*) FROM challenge_participants WHERE challenge_id = c.id AND status = 'accepted') AS participant_count
      FROM challenges c
      JOIN challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = ?
      WHERE c.status = ?
      ORDER BY c.created_at DESC`).all(req.uid, filter);
    res.json({ challenges });
  });

  app.get('/api/challenges/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
    if (!challenge) return res.status(404).json({ error: 'Not found' });
    const myPart = db.prepare('SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ?').get(id, req.uid);
    if (!myPart) return res.status(403).json({ error: 'Not a participant' });
    const participants = db.prepare(`SELECT cp.*, u.name, u.avatar_color FROM challenge_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.challenge_id = ?`).all(id);
    res.json({ challenge, participants, myStatus: myPart.status, myProgress: myPart.progress });
  });

  app.put('/api/challenges/:id/respond', requireAuth, (req, res) => {
    const { action } = req.body || {};
    if (action !== 'accept' && action !== 'reject') return bad(res, 'Invalid action');
    const id = parseInt(req.params.id);
    const part = db.prepare("SELECT * FROM challenge_participants WHERE challenge_id = ? AND user_id = ? AND status = 'pending'").get(id, req.uid);
    if (!part) return res.status(404).json({ error: 'No pending invitation' });
    db.prepare('UPDATE challenge_participants SET status = ? WHERE id = ?').run(action === 'accept' ? 'accepted' : 'rejected', part.id);
    res.json({ ok: true });
  });

  // ==================== BADGES ====================
  app.get('/api/badges', requireAuth, (req, res) => {
    const allBadges = db.prepare('SELECT * FROM badges ORDER BY sort').all();
    const earned = db.prepare('SELECT badge_id, unlocked_at FROM user_badges WHERE user_id = ?').all(req.uid);
    const earnedMap = {};
    for (const e of earned) earnedMap[e.badge_id] = e.unlocked_at;
    res.json({
      badges: allBadges.map(b => ({
        ...b,
        unlocked: !!earnedMap[b.id],
        unlockedAt: earnedMap[b.id] || null,
      })),
    });
  });

  // Backend badge check (called after relevant actions)
  const checkBadges = (uid) => {
    const award = (slug) => {
      const badge = db.prepare('SELECT id FROM badges WHERE slug = ?').get(slug);
      if (badge) db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(uid, badge.id);
    };
    // First Step
    const hasPrayer = db.prepare('SELECT 1 FROM prayer_logs WHERE user_id = ? LIMIT 1').get(uid);
    if (hasPrayer) award('first-step');
    // Streaks
    const dates = db.prepare("SELECT log_date FROM prayer_logs WHERE user_id = ? AND state != 'missed' GROUP BY log_date HAVING COUNT(*) = 5 ORDER BY log_date").all(uid).map(r => r.log_date);
    const { current, best } = streakOf(dates, today());
    if (best >= 7 || current >= 7) award('consistency-7');
    if (best >= 30 || current >= 30) award('consistency-30');
    if (best >= 100 || current >= 100) award('consistency-100');
    // Fajr Champion
    const fajrJamaat = db.prepare("SELECT log_date FROM prayer_logs WHERE user_id = ? AND prayer = 'fajr' AND state = 'jamaat' ORDER BY log_date").all(uid).map(r => r.log_date);
    const fajrStreak = streakOf(fajrJamaat, today());
    if (fajrStreak.best >= 7) award('fajr-champion-7');
    if (fajrStreak.best >= 30) award('fajr-champion-30');
    // All Jamaat
    const allJamaatDates = db.prepare("SELECT log_date FROM prayer_logs WHERE user_id = ? AND state = 'jamaat' GROUP BY log_date HAVING COUNT(*) = 5 ORDER BY log_date").all(uid).map(r => r.log_date);
    const allJamaatStreak = streakOf(allJamaatDates, today());
    if (allJamaatStreak.best >= 7) award('all-jamaat-7');
    // Quran
    const totalParas = db.prepare('SELECT COALESCE(SUM(paras),0) AS t FROM quran_logs WHERE user_id = ?').get(uid).t;
    if (totalParas >= 1) award('quran-journey');
    if (totalParas >= 30) award('khatam');
    // Zikr
    const totalZikrTypes = db.prepare('SELECT COUNT(*) AS c FROM zikr_types WHERE active = 1').get().c;
    const zikrDates = db.prepare(`SELECT log_date FROM zikr_logs WHERE user_id = ? GROUP BY log_date HAVING COUNT(DISTINCT zikr_type_id) = ? ORDER BY log_date`)
      .all(uid, totalZikrTypes).map(r => r.log_date);
    const zikrStreak = streakOf(zikrDates, today());
    if (zikrStreak.best >= 7) award('zikr-habit-7');
    if (zikrStreak.best >= 30) award('zikr-habit-30');
    // Perfect Day
    const perfectDays = db.prepare(`SELECT p.log_date FROM prayer_logs p WHERE p.user_id = ? AND p.state != 'missed'
      GROUP BY p.log_date HAVING COUNT(*) = 5 AND (SELECT COUNT(*) FROM zikr_logs z WHERE z.user_id = p.user_id AND z.log_date = p.log_date) >= ?`)
      .all(uid, totalZikrTypes);
    if (perfectDays.length > 0) award('perfect-day');
    // Social
    const hasFriend = db.prepare('SELECT 1 FROM friendships WHERE user_a = ? OR user_b = ? LIMIT 1').get(uid, uid);
    if (hasFriend) award('social-butterfly');
    // Challenger
    const hasCompleted = db.prepare("SELECT 1 FROM challenge_participants WHERE user_id = ? AND status = 'completed' LIMIT 1").get(uid);
    if (hasCompleted) award('challenger');
  };

  // ==================== WEEKLY REPORT ====================
  app.get('/api/weekly-report', requireAuth, (req, res) => {
    const end = endParam(req);
    if (!validDate(end) || !notFuture(end)) return bad(res, 'Invalid date');
    const weekStart = isoDay(new Date(Date.parse(end) - 6 * DAY));
    const prevWeekStart = isoDay(new Date(Date.parse(weekStart) - 7 * DAY));
    const prevWeekEnd = isoDay(new Date(Date.parse(weekStart) - DAY));

    // This week prayers
    const prayers = db.prepare('SELECT prayer, state, points, log_date FROM prayer_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, weekStart, end);
    const prevPrayers = db.prepare('SELECT prayer, state, points FROM prayer_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, prevWeekStart, prevWeekEnd);

    const total = prayers.length;
    const jamaat = prayers.filter(p => p.state === 'jamaat').length;
    const alone = prayers.filter(p => p.state === 'alone').length;
    const qaza = prayers.filter(p => p.state === 'qaza').length;
    const missed = 35 - total; // max 35 prayers in a week

    // Prayer-wise stats
    const prayerStats = {};
    for (const p of PRAYERS) {
      const mine = prayers.filter(x => x.prayer === p);
      prayerStats[p] = {
        total: mine.length,
        jamaat: mine.filter(x => x.state === 'jamaat').length,
        alone: mine.filter(x => x.state === 'alone').length,
        missed: 7 - mine.length,
      };
    }
    // Strongest prayer
    const strongest = Object.entries(prayerStats).sort((a, b) => b[1].total - a[1].total)[0];
    const weakest = Object.entries(prayerStats).sort((a, b) => a[1].total - b[1].total)[0];

    // Zikr
    const zikr = db.prepare('SELECT log_date, COUNT(*) AS c FROM zikr_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date').all(req.uid, weekStart, end);
    const totalZikrTypes = db.prepare('SELECT COUNT(*) AS c FROM zikr_types WHERE active = 1').get().c;
    const fullZikrDays = zikr.filter(z => z.c >= totalZikrTypes).length;

    // Quran
    const quran = db.prepare('SELECT pages, paras FROM quran_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, weekStart, end);
    const qPages = quran.reduce((s, q) => s + q.pages, 0);
    const qParas = round2(quran.reduce((s, q) => s + q.paras, 0));

    // Prev week for comparison
    const prevTotal = prevPrayers.length;
    const prevJamaat = prevPrayers.filter(p => p.state === 'jamaat').length;
    const prevQuran = db.prepare('SELECT pages, paras FROM quran_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').all(req.uid, prevWeekStart, prevWeekEnd);
    const prevQPages = prevQuran.reduce((s, q) => s + q.pages, 0);

    // Nafl (private)
    const nafl = db.prepare('SELECT COUNT(*) AS c FROM nafl_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').get(req.uid, weekStart, end).c;

    // Points
    const weekPoints = prayers.reduce((s, p) => s + p.points, 0);
    const prevWeekPoints = prevPrayers.reduce((s, p) => s + p.points, 0);

    // Streak
    const streakDates = db.prepare("SELECT log_date FROM prayer_logs WHERE user_id = ? AND state != 'missed' GROUP BY log_date HAVING COUNT(*) = 5 ORDER BY log_date")
      .all(req.uid).map(r => r.log_date);
    const streak = streakOf(streakDates, end);

    // Insights
    const insights = [];
    if (jamaat > prevJamaat) insights.push(`Your Jamaat attendance improved — ${jamaat} this week vs ${prevJamaat} last week.`);
    if (total > prevTotal) insights.push(`You tracked ${total} prayers this week, up from ${prevTotal} last week.`);
    if (fullZikrDays >= 5) insights.push(`You completed both Azkar on ${fullZikrDays} days — great consistency!`);
    if (qPages > prevQPages) insights.push(`Your Quran reading increased by ${qPages - prevQPages} pages.`);
    if (strongest && strongest[1].total >= 6) insights.push(`${strongest[0].charAt(0).toUpperCase() + strongest[0].slice(1)} is your strongest prayer this week.`);
    if (weakest && weakest[1].total <= 3) insights.push(`Consider setting a small goal for ${weakest[0].charAt(0).toUpperCase() + weakest[0].slice(1)} next week.`);
    if (streak.current >= 7) insights.push(`Amazing ${streak.current}-day streak! Keep it going.`);

    res.json({
      weekStart, weekEnd: end,
      prayers: { total, jamaat, alone, qaza, missed, prayerStats },
      strongest: strongest ? strongest[0] : null,
      weakest: weakest ? weakest[0] : null,
      zikr: { fullDays: fullZikrDays, totalDays: zikr.length },
      quran: { pages: qPages, paras: qParas },
      nafl: { count: nafl },
      streak,
      points: { week: weekPoints, prevWeek: prevWeekPoints, change: weekPoints - prevWeekPoints },
      comparison: { prevTotal, prevJamaat, prevQPages },
      insights,
    });
  });

  // ==================== SMART FIX ====================
  app.get('/api/smart-fix', requireAuth, (req, res) => {
    // Check if user has smart fix enabled
    const prefs = db.prepare('SELECT smart_fix_enabled FROM user_preferences WHERE user_id = ?').get(req.uid);
    if (prefs && !prefs.smart_fix_enabled) return res.json({ suggestions: [] });

    const end = today();
    const start = isoDay(new Date(Date.parse(end) - 13 * DAY));
    const suggestions = [];

    // Fajr analysis (need at least 7 days of data)
    const fajrLogs = db.prepare("SELECT state FROM prayer_logs WHERE user_id = ? AND prayer = 'fajr' AND log_date BETWEEN ? AND ?").all(req.uid, start, end);
    if (fajrLogs.length >= 7) {
      const fajrMissed = fajrLogs.filter(p => p.state === 'missed').length;
      if (fajrMissed >= 5) {
        suggestions.push({ type: 'fajr', message: 'You\'ve missed Fajr frequently. Consider adjusting your bedtime or setting a backup alarm.', priority: 'high' });
      }
    }

    // Zikr analysis
    const totalZikrTypes = db.prepare('SELECT COUNT(*) AS c FROM zikr_types WHERE active = 1').get().c;
    const zikrDays = db.prepare('SELECT log_date, COUNT(*) AS c FROM zikr_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date').all(req.uid, start, end);
    if (zikrDays.length < 5 && fajrLogs.length >= 7) {
      suggestions.push({ type: 'zikr', message: 'You could improve your Azkar consistency. Try setting a gentle reminder after Fajr and Maghrib.', priority: 'medium' });
    }

    // Quran analysis
    const quranDays = db.prepare('SELECT COUNT(*) AS c FROM quran_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').get(req.uid, start, end).c;
    const prevStart = isoDay(new Date(Date.parse(start) - 14 * DAY));
    const prevQuranDays = db.prepare('SELECT COUNT(*) AS c FROM quran_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?').get(req.uid, prevStart, start).c;
    if (prevQuranDays > 0 && quranDays < prevQuranDays / 2) {
      suggestions.push({ type: 'quran', message: 'Your Quran reading has declined. Consider setting a smaller daily goal to rebuild the habit.', priority: 'medium' });
    }

    res.json({ suggestions });
  });

  // ==================== RAMADAN ====================
  app.put('/api/ramadan', requireAuth, (req, res) => {
    const { date, fasted, taraweeh, tahajjud, sadaqah, quranPara, notes } = req.body || {};
    if (!validDate(date) || !notFuture(date)) return bad(res, 'Invalid date');
    const t = ts();
    db.prepare(`INSERT INTO ramadan_logs (user_id, log_date, fasted, taraweeh, tahajjud, sadaqah, quran_para, notes, marked_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (user_id, log_date) DO UPDATE SET fasted=excluded.fasted, taraweeh=excluded.taraweeh, tahajjud=excluded.tahajjud,
      sadaqah=excluded.sadaqah, quran_para=excluded.quran_para, notes=excluded.notes, updated_at=excluded.updated_at`)
      .run(req.uid, date, fasted ? 1 : 0, taraweeh ? 1 : 0, tahajjud ? 1 : 0, sadaqah ? 1 : 0, quranPara || 0, notes || '', t, t);
    const day = db.prepare('SELECT * FROM ramadan_logs WHERE user_id = ? AND log_date = ?').get(req.uid, date);
    res.json({ log: day });
  });

  app.get('/api/ramadan/summary', requireAuth, (req, res) => {
    const logs = db.prepare('SELECT * FROM ramadan_logs WHERE user_id = ? ORDER BY log_date').all(req.uid);
    const totalFasted = logs.filter(l => l.fasted).length;
    const totalTaraweeh = logs.filter(l => l.taraweeh).length;
    const totalQuranPara = round2(logs.reduce((s, l) => s + l.quran_para, 0));
    res.json({
      logs,
      summary: {
        totalDays: logs.length,
        fasted: totalFasted,
        taraweeh: totalTaraweeh,
        quranPara: totalQuranPara,
        khatamProgress: round2(totalQuranPara % 30),
        khatams: Math.floor(totalQuranPara / 30),
      },
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Production: serve built frontend
  const distPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });
  return app;
}
