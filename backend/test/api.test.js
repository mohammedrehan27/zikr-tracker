import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const day = (offset) => new Date(NOW.getTime() + offset * 86400000).toISOString().slice(0, 10);

async function boot() {
  const app = createApp(openDb(':memory:'), { now: () => NOW, authLimit: 1000 });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://localhost:${server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (method, path, body) => {
      const res = await fetch(base + path, {
        method, headers: { 'content-type': 'application/json', cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      return { status: res.status, body: await res.json() };
    };
  };
  return { server, client };
}

test('auth, prayers, points, streak, zikr, isolation', async () => {
  const { server, client } = await boot();
  const a = client(), b = client(), anon = client();
  try {
    // validation + signup
    assert.equal((await a('POST', '/api/auth/signup', { email: 'bad', password: 'password1', name: 'A' })).status, 400);
    assert.equal((await a('POST', '/api/auth/signup', { email: 'a@x.com', password: 'short', name: 'A' })).status, 400);
    assert.equal((await a('POST', '/api/auth/signup', { email: 'a@x.com', password: 'password1', name: 'Ali' })).status, 201);
    assert.equal((await anon('POST', '/api/auth/signup', { email: 'A@X.com', password: 'password1', name: 'Dup' })).status, 409);
    assert.equal((await anon('POST', '/api/auth/login', { email: 'a@x.com', password: 'wrongpass1' })).status, 401);
    assert.equal((await anon('GET', '/api/day/' + day(0))).status, 401);
    assert.equal((await anon('POST', '/api/auth/login', { email: 'a@x.com', password: 'password1' })).status, 200);
    assert.equal((await anon('GET', '/api/auth/me')).body.user.name, 'Ali');

    // prayers: points rules
    let r = await a('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'jamaat' });
    assert.equal(r.body.prayers.fajr.points, 10);
    r = await a('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'jamaat' }); // same again: no change
    assert.equal(r.body.prayers.fajr.points, 10);
    r = await a('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'alone' }); // edit
    assert.deepEqual(r.body.prayers.fajr, { state: 'alone', points: 0, edited: true });
    r = await a('PUT', '/api/prayers', { date: day(-5), prayer: 'asr', state: 'alone' }); // too old
    assert.equal(r.body.prayers.asr.points, 0);
    assert.equal(r.body.pointsOpen, false);
    r = await a('PUT', '/api/prayers', { date: day(-3), prayer: 'asr', state: 'alone' }); // last day in window
    assert.equal(r.body.prayers.asr.points, 4);
    assert.equal((await a('PUT', '/api/prayers', { date: day(3), prayer: 'asr', state: 'alone' })).status, 400);
    assert.equal((await a('PUT', '/api/prayers', { date: '2026-13-45', prayer: 'asr', state: 'alone' })).status, 400);
    assert.equal((await a('PUT', '/api/prayers', { date: day(0), prayer: 'witr', state: 'alone' })).status, 400);
    assert.equal((await a('PUT', '/api/prayers', { date: day(0), prayer: 'asr', state: 'x' })).status, 400);

    // streak: yesterday and day before complete, today incomplete -> 2
    for (const d of [day(-1), day(-2)])
      for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) await a('PUT', '/api/prayers', { date: d, prayer: p, state: 'jamaat' });
    assert.equal((await a('GET', '/api/streak')).body.current, 2);
    await a('PUT', '/api/prayers', { date: day(-1), prayer: 'isha', state: 'missed' });
    const s = (await a('GET', '/api/streak')).body;
    assert.equal(s.current, 0);
    assert.equal(s.best, 1);

    // zikr toggle is idempotent
    const types = (await a('GET', '/api/day/' + day(0))).body.zikr;
    assert.equal(types.length, 2);
    await a('PUT', '/api/zikr', { date: day(0), zikrId: types[0].id, done: true });
    r = await a('PUT', '/api/zikr', { date: day(0), zikrId: types[0].id, done: true });
    assert.equal(r.body.zikr[0].done, true);
    r = await a('PUT', '/api/zikr', { date: day(0), zikrId: types[0].id, done: false });
    assert.equal(r.body.zikr[0].done, false);
    assert.equal((await a('PUT', '/api/zikr', { date: day(0), zikrId: 999, done: true })).status, 400);

    // heatmap
    const h = (await a('GET', '/api/heatmap?days=7')).body;
    assert.ok(h.prayers.length >= 10);

    // isolation between users
    await b('POST', '/api/auth/signup', { email: 'b@x.com', password: 'password1', name: 'Bilal' });
    assert.deepEqual((await b('GET', '/api/day/' + day(0))).body.prayers, {});
    assert.equal((await b('GET', '/api/streak')).body.current, 0);
  } finally { server.close(); }
});

test('quran (pages and paras kept separate) and nafl', async () => {
  const { server, client } = await boot();
  const a = client(), b = client();
  try {
    await a('POST', '/api/auth/signup', { email: 'q@x.com', password: 'password1', name: 'Q' });
    await b('POST', '/api/auth/signup', { email: 'r@x.com', password: 'password1', name: 'R' });
    const put = (c, date, unit, amount) => c('PUT', '/api/quran', { date, unit, amount });

    // validation
    assert.equal((await put(a, day(0), 'pages', 3.5)).status, 400);
    assert.equal((await put(a, day(0), 'pages', 605)).status, 400);
    assert.equal((await put(a, day(0), 'paras', 31)).status, 400);
    assert.equal((await put(a, day(0), 'paras', -1)).status, 400);
    assert.equal((await put(a, day(0), 'paras', '2')).status, 400);
    assert.equal((await put(a, day(0), 'verses', 2)).status, 400);
    assert.equal((await put(a, day(5), 'pages', 2)).status, 400);

    // pages and paras are stored independently, no conversion
    let r = await put(a, day(0), 'pages', 5);
    assert.deepEqual(r.body.quran, { pages: 5, paras: 0 });
    r = await put(a, day(0), 'paras', 1.25);
    assert.deepEqual(r.body.quran, { pages: 5, paras: 1.25 });
    r = await put(a, day(0), 'pages', 7); // saving again replaces, not adds
    assert.deepEqual(r.body.quran, { pages: 7, paras: 1.25 });

    // streak counts any day with pages or paras; khatam counts paras only
    await put(a, day(-1), 'pages', 2);
    await put(a, day(-2), 'paras', 2);
    await put(a, day(-4), 'paras', 0.5);
    let s = (await a('GET', '/api/quran/summary')).body;
    assert.equal(s.current, 3);
    assert.equal(s.best, 3);
    assert.deepEqual(s.week, { pages: 9, paras: 3.75 });
    assert.equal(s.totalParas, 3.75);
    assert.equal(s.inProgress, 3.75);
    assert.equal(s.khatams, 0);
    assert.equal(s.map.length, 4);

    // setting both units to 0 removes the day
    await put(a, day(-1), 'pages', 0);
    s = (await a('GET', '/api/quran/summary')).body;
    assert.equal(s.current, 1);
    assert.equal(s.map.length, 3);

    // khatam wraps after 30 paras
    await put(a, day(-10), 'paras', 30);
    s = (await a('GET', '/api/quran/summary')).body;
    assert.equal(s.khatams, 1);
    assert.equal(s.inProgress, 3.75);

    // private to each user
    assert.equal((await b('GET', '/api/quran/summary')).body.totalParas, 0);
    assert.deepEqual((await b('GET', '/api/day/' + day(0))).body.quran, { pages: 0, paras: 0 });

    // nafl
    const types = (await a('GET', '/api/day/' + day(0))).body.nafl;
    assert.equal(types.length, 5);
    await a('PUT', '/api/nafl', { date: day(0), naflId: types[0].id, done: true });
    r = await a('PUT', '/api/nafl', { date: day(0), naflId: types[0].id, done: true }); // idempotent
    assert.equal(r.body.nafl.filter((n) => n.done).length, 1);
    await a('PUT', '/api/nafl', { date: day(-1), naflId: types[2].id, done: true });
    const ns = (await a('GET', '/api/nafl/summary')).body;
    assert.equal(ns.current, 2);
    assert.equal(ns.logs.length, 2);
    r = await a('PUT', '/api/nafl', { date: day(0), naflId: types[0].id, done: false });
    assert.equal(r.body.nafl[0].done, false);
    assert.equal((await a('PUT', '/api/nafl', { date: day(0), naflId: 999, done: true })).status, 400);
    assert.equal((await b('GET', '/api/nafl/summary')).body.logs.length, 0);
    assert.equal((await client()('GET', '/api/quran/summary')).status, 401);
  } finally { server.close(); }
});
