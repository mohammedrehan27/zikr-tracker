import { useCallback, useEffect, useState } from 'react';
import { api, toISO, fromISO, addDays } from '../api.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  Moon,
  Lock,
  ChevronLeft,
  ChevronRight,
  Flame,
  Shield,
  Sparkles,
} from 'lucide-react';

export default function Nafl({ onUnauthorized, addToast }) {
  const todayStr = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [sum, setSum] = useState(null);
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([
        api.naflSummary(todayStr),
        api.day(selectedDate),
      ]);
      setSum(s);
      setDay(d);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [todayStr, selectedDate, onUnauthorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggle = async (n) => {
    setError('');
    // Optimistic UI update
    setDay((prev) => ({
      ...prev,
      nafl: prev.nafl.map((x) => (x.id === n.id ? { ...x, done: !n.done } : x)),
    }));

    try {
      await api.setNafl(selectedDate, n.id, !n.done);
      if (addToast) addToast(`${!n.done ? 'Recorded' : 'Unchecked'} ${n.name}`);
      // Refresh summary
      const s = await api.naflSummary(todayStr);
      setSum(s);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else {
        setError(e.message);
        loadData();
      }
    }
  };

  const isToday = selectedDate === todayStr;
  const heatmapDates = Array.from({ length: 14 }, (_, i) => addDays(todayStr, i - 13));
  const doneSet = new Set(sum ? sum.logs.map((l) => `${l.date}:${l.naflId}`) : []);

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Moon className="text-emerald-600" /> Voluntary Worship (Nafl)
          </h1>
          <div className="page-date">Sunnah Rawatib, Tahajjud, Duha, Ishraq & Witr</div>
        </div>
        <span className="private-badge">
          <Lock size={12} /> Strictly Private
        </span>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Privacy guarantee banner */}
      <div className="card mb-16 flex items-center gap-12" style={{ background: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
        <Shield className="text-emerald-600 flex-shrink-0" size={24} />
        <div>
          <div className="font-semibold text-sm">Protected Spiritual Space</div>
          <div className="text-xs text-muted">
            Nafl prayers never award competitive points, are excluded from all leaderboards, and are never visible to friends.
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid stats-grid-2">
        <div className="stat-card">
          <div className="stat-label">Nafl Streak</div>
          <div className="stat-value">
            {sum ? sum.current : '–'}
            <small>days</small>
          </div>
          <div className="stat-detail">Personal consistency run</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Logged (14d)</div>
          <div className="stat-value" style={{ color: 'var(--emerald-600)' }}>
            {sum ? sum.logs.length : '–'}
            <small>prayers</small>
          </div>
          <div className="stat-detail">Across voluntary categories</div>
        </div>
      </div>

      {/* Daily Toggles */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">Daily Checklist</div>
            <div className="card-subtitle">
              Recording for: <b>{isToday ? 'Today' : selectedDate}</b>
            </div>
          </div>
          <div className="date-nav">
            <button
              className="date-nav-btn"
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="date-nav-btn"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              disabled={isToday}
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {loading || !day ? (
          <SkeletonCard />
        ) : (
          day.nafl.map((n) => (
            <label className="nafl-row" key={n.id}>
              <div className="nafl-info">
                <b>{n.name}</b>
                <span className="nafl-status block">
                  {n.done ? 'Completed on this date' : 'Not completed'}
                </span>
              </div>
              <input
                type="checkbox"
                className="toggle"
                checked={n.done}
                onChange={() => toggle(n)}
              />
            </label>
          ))
        )}
      </div>

      {/* 14-Day Heatmap */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">14-Day Nafl Consistency</div>
            <div className="card-subtitle">Personal pattern visualization</div>
          </div>
        </div>

        {sum && (
          <div className="heatmap-scroll">
            <div
              className="heatmap-grid"
              style={{ gridTemplateColumns: `130px repeat(14, 16px)` }}
            >
              {sum.types.map((t) => (
                <div key={t.id} style={{ display: 'contents' }}>
                  <span className="heatmap-label">{t.name}</span>
                  {heatmapDates.map((d) => (
                    <i
                      key={d}
                      title={`${d} · ${t.name}: ${
                        doneSet.has(`${d}:${t.id}`) ? 'Prayed' : 'None'
                      }`}
                      className={`heatmap-cell ${
                        doneSet.has(`${d}:${t.id}`) ? 'alone' : ''
                      }`}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                      onClick={() => setSelectedDate(d)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="legend">
          <span>
            <i className="heatmap-cell alone" style={{ width: 12, height: 12 }} /> Offered
          </span>
          <span>
            <i className="heatmap-cell" style={{ width: 12, height: 12 }} /> Not marked
          </span>
        </div>
      </div>
    </div>
  );
}
