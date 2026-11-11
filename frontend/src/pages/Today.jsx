import { useCallback, useEffect, useState } from 'react';
import { api, toISO, fromISO, addDays } from '../api.js';
import { PRAYERS, PRAYER_NAMES, PRAYER_ARABIC, STATES, HADITHS } from '../consts.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Lock,
  ArrowRight,
  Award,
  Sun,
  Moon,
} from 'lucide-react';

function ProgressRing({ done, total = 5 }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const pct = Math.min(done / total, 1);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} className="ring-bg" />
      <circle
        cx="36"
        cy="36"
        r={r}
        className="ring-fg"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" className="ring-text">
        {done}/{total}
      </text>
    </svg>
  );
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Tahajjud Mubarak';
  if (h < 12) return 'Sabah al-Khayr';
  if (h < 17) return 'Masa al-Khayr';
  return 'Assalamu Alaikum';
};

export default function Today({ user, go, onUnauthorized, addToast }) {
  const todayStr = toISO(new Date());
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState(null);
  const [streak, setStreak] = useState(null);
  const [points, setPoints] = useState(null);
  const [smartFix, setSmartFix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fail = useCallback(
    (err) => {
      if (err.status === 401) onUnauthorized();
      else setError(err.message);
    },
    [onUnauthorized]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, s, p, sf] = await Promise.all([
        api.day(date),
        api.streak(date),
        api.points(date),
        api.smartFix().catch(() => ({ suggestions: [] })),
      ]);
      setData(d);
      setStreak(s);
      setPoints(p);
      setSmartFix(sf.suggestions || []);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [date, fail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const act = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      setData(updated);
      // Reload points and streak
      const [s, p] = await Promise.all([api.streak(date), api.points(date)]);
      setStreak(s);
      setPoints(p);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const d = fromISO(date);
  const pretty = d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const isToday = date === todayStr;
  const prayed = data
    ? PRAYERS.filter((p) => data.prayers[p] && data.prayers[p].state !== 'missed').length
    : 0;
  const pts = data
    ? Object.values(data.prayers).reduce((s, p) => s + p.points, 0) +
      data.zikr.reduce((s, z) => s + (z.points || 0), 0)
    : 0;

  const hadith = HADITHS[Math.floor(Date.parse(date) / 86400000) % HADITHS.length];
  const q = data?.quran;

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16">
        <div>
          <div className="page-greeting">{getGreeting()}, {user.name}</div>
          <h1 className="page-title">{isToday ? 'Today' : pretty}</h1>
          {isToday && <div className="page-date">{pretty}</div>}
        </div>
        <div className="date-nav">
          <button
            className="date-nav-btn"
            onClick={() => setDate(addDays(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft />
          </button>
          <button
            className="date-nav-btn"
            onClick={() => setDate(addDays(date, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Smart Fix Suggestions */}
      {smartFix.length > 0 && isToday && (
        <div className="card mb-16" style={{ background: 'var(--emerald-50)', borderColor: 'var(--emerald-200)' }}>
          <div className="card-title" style={{ color: 'var(--emerald-800)' }}>
            <Sparkles /> Smart Insight
          </div>
          <p className="text-sm mt-8" style={{ color: 'var(--emerald-900)' }}>
            {smartFix[0].message}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <div className="stat-label">Daily Streak</div>
          <div className="stat-value">
            {streak ? streak.current : '–'}
            <small>days</small>
          </div>
          <div className="stat-detail">Best: {streak?.best || 0} days</div>
        </div>

        <div className="stat-card progress-ring-wrap">
          <div>
            <div className="stat-label">Prayers</div>
            <div className="stat-value">
              {data ? prayed : '–'}
              <small>/5</small>
            </div>
            <div className="stat-detail">
              {prayed === 5 ? 'All complete ✓' : `${5 - prayed} remaining`}
            </div>
          </div>
          <ProgressRing done={prayed} />
        </div>

        <div className="stat-card">
          <div className="stat-label">Points Earned</div>
          <div className="stat-value" style={{ color: 'var(--emerald-600)' }}>
            {points ? points.today : pts}
            <small>pts</small>
          </div>
          <div className="stat-detail">Total: {points?.total || 0} pts</div>
        </div>
      </div>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          {/* Namaz Card */}
          <div className="card mb-16">
            <div className="card-header">
              <div>
                <div className="card-title">Five Daily Prayers</div>
                <div className="card-subtitle">Mark each prayer as prayed in congregation, alone, missed, or made up</div>
              </div>
              {data.pointsOpen ? (
                <span className="card-badge success">Points Active · {pts} pts</span>
              ) : (
                <span className="card-badge neutral">Record Only · 0 pts</span>
              )}
            </div>

            {PRAYERS.map((p) => {
              const cur = data.prayers[p];
              return (
                <div className="prayer-item" key={p}>
                  <div className="prayer-name">
                    <span>{PRAYER_NAMES[p]}</span>
                    <span className="text-muted text-xs" style={{ fontFamily: 'var(--font-arabic)' }}>
                      {PRAYER_ARABIC[p]}
                    </span>
                    {cur?.edited && <span className="edited-tag">edited · 0 pts</span>}
                  </div>
                  <div className="prayer-states">
                    {STATES.map(([s, label, ptsLabel]) => (
                      <button
                        key={s}
                        disabled={busy}
                        className={`prayer-state-btn ${s} ${cur?.state === s ? 'sel' : ''}`}
                        onClick={() => act(() => api.setPrayer(date, p, s))}
                        title={`${label} (${ptsLabel})`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {data.pointsOpen && data.daysAgo > 0 && (
              <div className="points-info">
                ⏱ {4 - data.daysAgo} day{4 - data.daysAgo === 1 ? '' : 's'} remaining to earn points for this date.
              </div>
            )}
          </div>

          {/* Zikr Card */}
          <div className="card mb-16">
            <div className="card-header">
              <div>
                <div className="card-title">Daily Azkar</div>
                <div className="card-subtitle">+3 pts each · One tap completion</div>
              </div>
            </div>
            <div className="zikr-grid">
              {data.zikr.map((z) => (
                <button
                  key={z.id}
                  disabled={busy}
                  className={`zikr-btn ${z.done ? 'done' : ''}`}
                  onClick={() => act(() => api.setZikr(date, z.id, !z.done))}
                >
                  {z.slug === 'morning-azkar' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{z.name}</span>
                  {z.done && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
          </div>

          {/* Quran Row */}
          <div className="card mb-16">
            <div className="quran-summary-row">
              <div>
                <div className="card-title">
                  <BookOpen size={18} /> Quran Recitation
                </div>
                <div className="quran-summary-text mt-4">
                  {q?.pages || q?.paras
                    ? [q.pages ? `${q.pages} pages` : '', q.paras ? `${q.paras} para` : '']
                        .filter(Boolean)
                        .join(' · ')
                    : 'No recitation logged yet today'}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => go('quran')}>
                {q?.pages || q?.paras ? 'Edit' : 'Log'} <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Nafl Card */}
          <div className="card mb-16">
            <div className="card-header">
              <div>
                <div className="card-title">Optional Worship (Nafl)</div>
                <div className="card-subtitle">Sunnah and voluntary prayers</div>
              </div>
              <span className="private-badge">
                <Lock size={12} /> Private
              </span>
            </div>
            <div className="chip-row">
              {data.nafl.map((n) => (
                <button
                  key={n.id}
                  disabled={busy}
                  className={`chip-btn ${n.done ? 'done' : ''}`}
                  onClick={() => act(() => api.setNafl(date, n.id, !n.done))}
                >
                  {n.done ? '✓ ' : ''}{n.name}
                </button>
              ))}
            </div>
          </div>

          {/* Hadith of the Day */}
          <div className="card hadith-card mb-16">
            <div className="hadith-eyebrow">Hadith of the Day</div>
            {hadith.ar && (
              <div className="hadith-arabic mb-8" lang="ar">
                {hadith.ar}
              </div>
            )}
            <p className="hadith-text">"{hadith.en}"</p>
            <div className="hadith-source">— {hadith.src}</div>
          </div>
        </>
      )}
    </div>
  );
}
