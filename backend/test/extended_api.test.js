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
        method,
        headers: { 'content-type': 'application/json', cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      return { status: res.status, body: await res.json() };
    };
  };
  return { server, client };
}

test('friends, social leaderboard, privacy controls', async () => {
  const { server, client } = await boot();
  const u1 = client();
  const u2 = client();
  const u3 = client();

  try {
    // 1. Sign up 3 users
    await u1('POST', '/api/auth/signup', { email: 'u1@test.com', password: 'password123', name: 'User One' });
    await u2('POST', '/api/auth/signup', { email: 'u2@test.com', password: 'password123', name: 'User Two' });
    await u3('POST', '/api/auth/signup', { email: 'u3@test.com', password: 'password123', name: 'User Three' });

    const me1 = (await u1('GET', '/api/auth/me')).body.user;
    const me2 = (await u2('GET', '/api/auth/me')).body.user;
    const me3 = (await u3('GET', '/api/auth/me')).body.user;

    // 2. Search users
    const searchRes = await u1('GET', '/api/users/search?q=User');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.users.length, 2); // Excludes self

    // 3. Send and accept friend request
    const fr = await u1('POST', '/api/friends/request', { userId: me2.id });
    assert.equal(fr.status, 201);

    const incoming = await u2('GET', '/api/friends/requests');
    assert.equal(incoming.body.incoming.length, 1);
    const reqId = incoming.body.incoming[0].id;

    const acceptRes = await u2('PUT', `/api/friends/requests/${reqId}`, { action: 'accept' });
    assert.equal(acceptRes.status, 200);

    const friends1 = await u1('GET', '/api/friends');
    assert.equal(friends1.body.friends.length, 1);
    assert.equal(friends1.body.friends[0].id, me2.id);

    // 4. Pray and test points on leaderboard
    await u1('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'jamaat' }); // 10 pts
    await u2('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'alone' });  // 4 pts

    const lb = await u1('GET', '/api/leaderboard?period=week');
    assert.equal(lb.body.leaderboard.length, 2); // u1 and u2 (u3 is not a friend)
    assert.equal(lb.body.leaderboard[0].id, me1.id);
    assert.equal(lb.body.leaderboard[0].periodPoints, 10);
    assert.equal(lb.body.leaderboard[1].id, me2.id);
    assert.equal(lb.body.leaderboard[1].periodPoints, 4);

    // 5. Test leaderboard privacy setting
    await u2('PUT', '/api/preferences', { leaderboard_visible: 0 });
    const lbAfterPrivate = await u1('GET', '/api/leaderboard?period=week');
    assert.equal(lbAfterPrivate.body.leaderboard.length, 1); // u2 hidden

    // 6. Test removing a friend
    const delFriend = await u1('DELETE', `/api/friends/${me2.id}`);
    assert.equal(delFriend.status, 200);
    const friendsAfter = await u1('GET', '/api/friends');
    assert.equal(friendsAfter.body.friends.length, 0);
  } finally {
    server.close();
  }
});

test('challenges and badges unlock flow', async () => {
  const { server, client } = await boot();
  const c = client();

  try {
    await c('POST', '/api/auth/signup', { email: 'challenger@test.com', password: 'password123', name: 'Hamza' });

    // 1. Initial badges (all locked)
    let badgesRes = await c('GET', '/api/badges');
    assert.ok(badgesRes.body.badges.length >= 10);
    const firstStep = badgesRes.body.badges.find((b) => b.slug === 'first-step');
    assert.equal(firstStep.unlocked, false);

    // 2. Mark first prayer -> triggers 'first-step' badge check
    await c('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'alone' });
    badgesRes = await c('GET', '/api/badges');
    const firstStepAfter = badgesRes.body.badges.find((b) => b.slug === 'first-step');
    assert.equal(firstStepAfter.unlocked, true);

    // 3. Create personal challenge
    const createRes = await c('POST', '/api/challenges', {
      title: '7 Days of Fajr',
      challengeType: 'personal',
      category: 'namaz',
      targetType: 'fajr_jamaat',
      targetValue: 7,
      durationDays: 7,
    });
    assert.equal(createRes.status, 201);

    const listRes = await c('GET', '/api/challenges?status=active');
    assert.equal(listRes.body.challenges.length, 1);
    assert.equal(listRes.body.challenges[0].title, '7 Days of Fajr');
    assert.equal(listRes.body.challenges[0].my_status, 'accepted');
  } finally {
    server.close();
  }
});

test('weekly report calculations, ramadan mode, and profile preferences', async () => {
  const { server, client } = await boot();
  const c = client();

  try {
    await c('POST', '/api/auth/signup', { email: 'report@test.com', password: 'password123', name: 'Zaid' });

    // 1. Log prayers across several days
    await c('PUT', '/api/prayers', { date: day(0), prayer: 'fajr', state: 'jamaat' });
    await c('PUT', '/api/prayers', { date: day(0), prayer: 'dhuhr', state: 'alone' });
    await c('PUT', '/api/quran', { date: day(0), unit: 'pages', amount: 10 });

    // 2. Weekly report
    const wr = await c('GET', `/api/weekly-report?end=${day(0)}`);
    assert.equal(wr.status, 200);
    assert.equal(wr.body.prayers.total, 2);
    assert.equal(wr.body.prayers.jamaat, 1);
    assert.equal(wr.body.prayers.alone, 1);
    assert.equal(wr.body.quran.pages, 10);
    assert.ok(Array.isArray(wr.body.insights));

    // 3. Ramadan mode logging
    const ramRes = await c('PUT', '/api/ramadan', {
      date: day(0),
      fasted: true,
      taraweeh: true,
      tahajjud: false,
      sadaqah: true,
      quranPara: 1.5,
    });
    assert.equal(ramRes.status, 200);
    assert.equal(ramRes.body.log.fasted, 1);
    assert.equal(ramRes.body.log.taraweeh, 1);

    const ramSummary = await c('GET', '/api/ramadan/summary');
    assert.equal(ramSummary.body.summary.fasted, 1);
    assert.equal(ramSummary.body.summary.taraweeh, 1);
    assert.equal(ramSummary.body.summary.quranPara, 1.5);

    // 4. Update Preferences
    const prefRes = await c('PUT', '/api/preferences', {
      prayer_calc_method: 'Karachi',
      asr_madhab: 'Hanafi',
      city: 'Istanbul',
    });
    assert.equal(prefRes.status, 200);
    assert.equal(prefRes.body.preferences.prayer_calc_method, 'Karachi');
    assert.equal(prefRes.body.preferences.asr_madhab, 'Hanafi');
    assert.equal(prefRes.body.preferences.city, 'Istanbul');

    // 5. Update Profile Name & Password
    const profRes = await c('PUT', '/api/profile', { name: 'Zaid Updated' });
    assert.equal(profRes.body.user.name, 'Zaid Updated');

    const passRes = await c('PUT', '/api/profile/password', {
      currentPassword: 'password123',
      newPassword: 'newpassword456',
    });
    assert.equal(passRes.body.ok, true);

    // Verify login with new password
    const loginNew = await client()('POST', '/api/auth/login', {
      email: 'report@test.com',
      password: 'newpassword456',
    });
    assert.equal(loginNew.status, 200);
  } finally {
    server.close();
  }
});

