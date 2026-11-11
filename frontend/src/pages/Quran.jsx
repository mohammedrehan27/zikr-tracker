import { useCallback, useEffect, useState } from 'react';
import { api, toISO, fromISO, addDays } from '../api.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle,
  Plus,
  Minus,
  Lock,
  Layers,
} from 'lucide-react';

const fmt = (n) => String(Math.round(n * 100) / 100);

export default function Quran({ onUnauthorized, addToast }) {
  const todayStr = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [sum, setSum] = useState(null);
  const [day, setDay] = useState(null);
  const [unit, setUnit] = useState('pages');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([
        api.quranSummary(todayStr),
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

  useEffect(() => {
    if (day) {
      setValue(day.quran[unit] ? String(day.quran[unit]) : '');
    }
  }, [unit, day]);

  const save = async (e) => {
    if (e) e.preventDefault();
    const text = value.trim();
    const n = text === '' ? 0 : Number(text);
    if (!Number.isFinite(n) || n < 0) {
      setError('Please enter a valid positive number');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.setQuran(selectedDate, unit, n);
      if (addToast) addToast(`Saved ${n} ${unit} for ${selectedDate === todayStr ? 'today' : selectedDate}`);
      await loadData();
    } catch (err) {
      if (err.status === 401) onUnauthorized();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const adjustValue = (delta) => {
    const current = parseFloat(value) || 0;
    const nextVal = Math.max(0, current + delta);
    const rounded = unit === 'pages' ? Math.round(nextVal) : Math.round(nextVal * 100) / 100;
    setValue(String(rounded));
  };

  const setPreset = (amount) => {
    setValue(String(amount));
  };

  const isToday = selectedDate === todayStr;
  const pct = sum ? Math.min(100, Math.round((sum.inProgress / 30) * 100)) : 0;
  const t = day?.quran || { pages: 0, paras: 0 };

  const byDate = {};
  if (sum?.map) {
    sum.map.forEach((m) => {
      byDate[m.date] = m;
    });
  }
  const heatmapDates = Array.from({ length: 35 }, (_, i) => addDays(todayStr, i - 34));

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <BookOpen className="text-emerald-600" /> Quran Recitation
          </h1>
          <div className="page-date">Track pages and paras independently. Kept strictly private.</div>
        </div>
        <span className="private-badge">
          <Lock size={12} /> Private to you
        </span>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Stats Summary */}
      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-label">Quran Streak</div>
          <div className="stat-value">
            {sum ? sum.current : '–'}
            <small>days</small>
          </div>
          <div className="stat-detail">Best: {sum?.best || 0} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last 7 Days</div>
          <div className="stat-value">
            {sum ? sum.week.pages : '–'}
            <small>pages</small>
          </div>
          <div className="stat-detail">+{sum ? fmt(sum.week.paras) : 0} para</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Khatam Progress</div>
          <div className="stat-value">
            {sum ? `${fmt(sum.inProgress)}/30` : '–'}
          </div>
          <div className="stat-detail">{pct}% of current Khatam</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Khatams Completed</div>
          <div className="stat-value" style={{ color: 'var(--emerald-600)' }}>
            {sum ? sum.khatams : '0'}
          </div>
          <div className="stat-detail">Total: {sum ? fmt(sum.totalParas) : 0} paras</div>
        </div>
      </div>

      {/* Log Recitation Form */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">Log Recitation</div>
            <div className="card-subtitle">
              Logging for: <b>{isToday ? 'Today' : selectedDate}</b>
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

        <form onSubmit={save}>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn ${unit === 'pages' ? 'active' : ''}`}
              onClick={() => setUnit('pages')}
            >
              Pages
            </button>
            <button
              type="button"
              className={`seg-btn ${unit === 'paras' ? 'active' : ''}`}
              onClick={() => setUnit('paras')}
            >
              Para (Juz)
            </button>
          </div>

          <div className="input-group">
            <label className="input-label">
              {unit === 'pages'
                ? 'Number of pages recited on this date (0–604)'
                : 'Portion of para recited (e.g. 0.25, 0.5, 1, 2)'}
            </label>
            <div className="flex gap-8 items-center">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '12px' }}
                onClick={() => adjustValue(unit === 'pages' ? -1 : -0.25)}
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                step={unit === 'pages' ? '1' : '0.25'}
                min="0"
                max={unit === 'pages' ? '604' : '30'}
                className="input-lg"
                placeholder={unit === 'pages' ? 'e.g. 5' : 'e.g. 1'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '12px' }}
                onClick={() => adjustValue(unit === 'pages' ? 1 : 0.25)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="chip-row mb-16">
            {unit === 'pages' ? (
              [1, 2, 5, 10, 20].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="chip-btn"
                  onClick={() => setPreset(amt)}
                >
                  +{amt} pages
                </button>
              ))
            ) : (
              [0.25, 0.5, 1, 2].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="chip-btn"
                  onClick={() => setPreset(amt)}
                >
                  {amt === 0.25 ? '¼ para' : amt === 0.5 ? '½ para' : `${amt} para`}
                </button>
              ))
            )}
          </div>

          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy ? 'Saving...' : `Save ${unit === 'pages' ? 'Pages' : 'Para'} for ${isToday ? 'Today' : selectedDate}`}
          </button>
        </form>

        <div className="points-info">
          Recorded on {selectedDate}:{' '}
          <b>
            {t.pages || t.paras
              ? [t.pages ? `${t.pages} pages` : '', t.paras ? `${t.paras} para` : '']
                  .filter(Boolean)
                  .join(' · ')
              : 'No recitation'}
          </b>
          . Pages and Paras are never converted; you can track both concurrently. Enter 0 to clear.
        </div>
      </div>

      {/* 30-Para Khatam Progress Ring/Bar */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">30-Para Khatam Visualization</div>
            <div className="card-subtitle">
              Para {Math.floor(sum ? sum.inProgress : 0) + 1} in progress · {pct}% of 30 paras
            </div>
          </div>
          {sum && sum.khatams > 0 && (
            <span className="card-badge success">{sum.khatams} Khatam Completed 🎉</span>
          )}
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted mt-8">
          Khatam completion is derived purely from completed paras. Reading pages maintains your daily habit and reading volume without being conflated.
        </p>
      </div>

      {/* 5-Week Contribution Map */}
      <div className="card mb-16">
        <div className="card-header">
          <div className="card-title">Quran Habit Heatmap</div>
          <span className="card-subtitle">Last 5 weeks</span>
        </div>
        <div className="quran-map">
          {heatmapDates.map((d) => {
            const m = byDate[d];
            const label = m
              ? [m.pages ? `${m.pages}p` : '', m.paras ? `${m.paras}j` : ''].filter(Boolean).join(' ')
              : 'none';
            return (
              <div
                key={d}
                title={`${d}: ${label}`}
                className={`heatmap-cell qc flex-center text-xs font-semibold ${
                  m ? 'jamaat text-white' : ''
                }`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedDate(d)}
              >
                {m ? label : ''}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="heatmap-cell" style={{ width: 12, height: 12 }} /> No entry
          </span>
          <span>
            <i className="heatmap-cell jamaat" style={{ width: 12, height: 12 }} /> Recited
          </span>
        </div>
      </div>
    </div>
  );
}
