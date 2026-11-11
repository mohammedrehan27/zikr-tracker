import { useEffect, useState } from 'react';
import { api, toISO, addDays, fromISO } from '../api.js';
import { PRAYERS, PRAYER_NAMES } from '../consts.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  Flame,
  Calendar,
  Sparkles,
  TrendingUp,
  HeartHandshake,
  CheckCircle,
} from 'lucide-react';

export default function Streak({ onUnauthorized }) {
  const end = toISO(new Date());
  const [daysCount, setDaysCount] = useState(35); // 35 or 70 days
  const [heat, setHeat] = useState(null);
  const [streak, setStreak] = useState(null);
  const [zikrStreak, setZikrStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');

    Promise.all([
      api.heatmap(daysCount, end),
      api.streak(end),
      api.zikrStreak(end).catch(() => ({ current: 0, best: 0 })),
    ])
      .then(([h, s, zs]) => {
        if (!stale) {
          setHeat(h);
          setStreak(s);
          setZikrStreak(zs);
        }
      })
      .catch((e) => {
        if (e.status === 401) onUnauthorized();
        else if (!stale) setError(e.message);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [daysCount, end, onUnauthorized]);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const dates = Array.from({ length: daysCount }, (_, i) =>
    addDays(end, i - (daysCount - 1))
  );

  const stateMap = {};
  if (heat) {
    heat.prayers.forEach((p) => {
      stateMap[p.date + p.prayer] = p.state;
    });
  }

  const zikrMap = {};
  if (heat) {
    heat.zikr.forEach((z) => {
      zikrMap[z.date] = z.count;
    });
  }

  const totalPrayersMarked = heat ? heat.prayers.length : 0;
  const jamaatCount = heat
    ? heat.prayers.filter((p) => p.state === 'jamaat').length
    : 0;
  const aloneCount = heat
    ? heat.prayers.filter((p) => p.state === 'alone').length
    : 0;
  const qazaCount = heat
    ? heat.prayers.filter((p) => p.state === 'qaza').length
    : 0;

  const pctJamaat = totalPrayersMarked
    ? Math.round((jamaatCount / totalPrayersMarked) * 100)
    : 0;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Flame className="text-emerald-600" /> Consistency & Streaks
          </h1>
          <div className="page-date">GitHub-style worship contribution matrix</div>
        </div>
        <div className="seg-control" style={{ width: '160px', marginBottom: 0 }}>
          <button
            type="button"
            className={`seg-btn ${daysCount === 35 ? 'active' : ''}`}
            onClick={() => setDaysCount(35)}
          >
            5 Weeks
          </button>
          <button
            type="button"
            className={`seg-btn ${daysCount === 70 ? 'active' : ''}`}
            onClick={() => setDaysCount(70)}
          >
            10 Weeks
          </button>
        </div>
      </div>

      {/* Positive Comeback Encouragement Banner */}
      <div
        className="card mb-16"
        style={{
          background: 'linear-gradient(135deg, var(--emerald-50) 0%, var(--surface) 100%)',
          borderColor: 'var(--emerald-200)',
        }}
      >
        <div className="flex items-center gap-12">
          <HeartHandshake className="text-emerald-700 flex-shrink-0" size={24} />
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--emerald-900)' }}>
              A Gentle Path of Continuity
            </div>
            <div className="text-xs text-muted">
              Missed a day? Do not despair or abandon the effort. The beloved deed in the sight of Allah is that which is continuous, even if small. Every prayer is a fresh beginning.
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-label">Namaz Streak</div>
          <div className="stat-value">
            {streak ? streak.current : '–'}
            <small>days</small>
          </div>
          <div className="stat-detail">Best: {streak?.best || 0} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Zikr Streak</div>
          <div className="stat-value">
            {zikrStreak ? zikrStreak.current : '–'}
            <small>days</small>
          </div>
          <div className="stat-detail">Both Morning & Evening</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Jamaat Ratio</div>
          <div className="stat-value" style={{ color: 'var(--emerald-700)' }}>
            {pctJamaat}%
          </div>
          <div className="stat-detail">{jamaatCount} in congregation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Logged</div>
          <div className="stat-value">
            {totalPrayersMarked}
          </div>
          <div className="stat-detail">
            {aloneCount} alone · {qazaCount} qaza
          </div>
        </div>
      </div>

      {/* Heatmap Card */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">Prayer Contribution Matrix</div>
            <div className="card-subtitle">
              Past {daysCount} days · 5 prayers + Zikr
            </div>
          </div>
        </div>

        {loading || !heat ? (
          <SkeletonCard />
        ) : (
          <div className="heatmap-scroll">
            <div
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `70px repeat(${daysCount}, 14px)`,
              }}
            >
              {PRAYERS.map((p) => (
                <div key={p} style={{ display: 'contents' }}>
                  <span className="heatmap-label">{PRAYER_NAMES[p]}</span>
                  {dates.map((d) => {
                    const st = stateMap[d + p] || '';
                    return (
                      <i
                        key={d}
                        title={`${d} · ${PRAYER_NAMES[p]}: ${st || 'unmarked'}`}
                        className={`heatmap-cell ${st}`}
                      />
                    );
                  })}
                </div>
              ))}
              <div style={{ display: 'contents' }}>
                <span className="heatmap-label">Azkar</span>
                {dates.map((d) => {
                  const cnt = zikrMap[d] || 0;
                  return (
                    <i
                      key={d}
                      title={`${d} · Azkar: ${cnt}/2 completed`}
                      className={`heatmap-cell z${cnt}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="legend">
          <span>
            <i className="heatmap-cell jamaat" /> Jamaat (+10)
          </span>
          <span>
            <i className="heatmap-cell alone" /> Alone (+4)
          </span>
          <span>
            <i className="heatmap-cell qaza" /> Qaza (+2)
          </span>
          <span>
            <i className="heatmap-cell" /> Missed / Unmarked
          </span>
          <span>
            <i className="heatmap-cell z1" /> 1 Zikr
          </span>
          <span>
            <i className="heatmap-cell z2" /> Both Azkar
          </span>
        </div>
      </div>
    </div>
  );
}
