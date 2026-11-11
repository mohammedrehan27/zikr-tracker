async function request(method, path, body) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  me: () => request('GET', '/auth/me'),
  signup: (b) => request('POST', '/auth/signup', b),
  login: (b) => request('POST', '/auth/login', b),
  logout: () => request('POST', '/auth/logout'),

  // Profile & Settings
  updateProfile: (b) => request('PUT', '/profile', b),
  updatePassword: (b) => request('PUT', '/profile/password', b),
  preferences: () => request('GET', '/preferences'),
  updatePreferences: (b) => request('PUT', '/preferences', b),
  deleteAccount: (b) => request('DELETE', '/account', b),

  // Core tracking
  day: (date) => request('GET', `/day/${date}`),
  setPrayer: (date, prayer, state) => request('PUT', '/prayers', { date, prayer, state }),
  setZikr: (date, zikrId, done) => request('PUT', '/zikr', { date, zikrId, done }),
  heatmap: (days, end) => request('GET', `/heatmap?days=${days}&end=${end}`),
  streak: (end) => request('GET', `/streak?end=${end}`),
  zikrStreak: (end) => request('GET', `/zikr/streak?end=${end}`),
  points: (end) => request('GET', `/points?end=${end}`),

  // Quran
  setQuran: (date, unit, amount) => request('PUT', '/quran', { date, unit, amount }),
  quranSummary: (end) => request('GET', `/quran/summary?end=${end}`),

  // Nafl
  setNafl: (date, naflId, done) => request('PUT', '/nafl', { date, naflId, done }),
  naflSummary: (end) => request('GET', `/nafl/summary?end=${end}`),

  // Social
  searchUsers: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
  sendFriendRequest: (userId) => request('POST', '/friends/request', { userId }),
  friendRequests: () => request('GET', '/friends/requests'),
  respondFriendRequest: (id, action) => request('PUT', `/friends/requests/${id}`, { action }),
  friends: () => request('GET', '/friends'),
  removeFriend: (userId) => request('DELETE', `/friends/${userId}`),
  leaderboard: (period) => request('GET', `/leaderboard?period=${period || 'week'}`),

  // Challenges
  createChallenge: (b) => request('POST', '/challenges', b),
  challenges: (status) => request('GET', `/challenges?status=${status || 'active'}`),
  challenge: (id) => request('GET', `/challenges/${id}`),
  respondChallenge: (id, action) => request('PUT', `/challenges/${id}/respond`, { action }),

  // Badges & Analytics
  badges: () => request('GET', '/badges'),
  weeklyReport: (end) => request('GET', `/weekly-report?end=${end}`),
  smartFix: () => request('GET', '/smart-fix'),

  // Ramadan
  setRamadan: (b) => request('PUT', '/ramadan', b),
  ramadanSummary: () => request('GET', '/ramadan/summary'),
};

// Date utilities (local calendar date as YYYY-MM-DD, matching wall clock)
export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromISO = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
