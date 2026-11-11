import { useCallback, useEffect, useState } from 'react';
import { api, toISO, addDays } from '../api.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  Moon,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  BookOpen,
} from 'lucide-react';

export default function Ramadan({ onUnauthorized, addToast }) {
  const todayStr = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [summary, setSummary] = useState(null);
  const [dayLog, setDayLog] = useState({
    fasted: 0,
    taraweeh: 0,
    tahajjud: 0,
    sadaqah: 0,
    quranPara: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await api.ramadanSummary();
      setSummary(s);
      const current = s.logs.find((l) => l.log_date === selectedDate);
      if (current) {
        setDayLog({
          fasted: current.fasted,
          taraweeh: current.taraweeh,
          tahajjud: current.tahajjud,
          sadaqah: current.sadaqah,
          quranPara: current.quran_para,
          notes: current.notes || '',
        });
      } else {
        setDayLog({ fasted: 0, taraweeh: 0, tahajjud: 0, sadaqah: 0, quranPara: 0, notes: '' });
      }
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, onUnauthorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveLog = async (updatedFields) => {
    const next = { ...dayLog, ...updatedFields };
    setDayLog(next);
    setBusy(true);
    try {
      await api.setRamadan({
        date: selectedDate,
        fasted: !!next.fasted,
        taraweeh: !!next.taraweeh,
        tahajjud: !!next.tahajjud,
        sadaqah: !!next.sadaqah,
        quranPara: Number(next.quranPara),
        notes: next.notes,
      });
      if (addToast) addToast('Ramadan log saved');
      const s = await api.ramadanSummary();
      setSummary(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isOddNight = (dayNum) => [21, 23, 25, 27, 29].includes(dayNum);

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8 text-emerald-800">
            <Moon className="text-gold-500" /> Ramadan Mubarak Mode
          </h1>
          <div className="page-date">Spiritual devotion during the blessed month</div>
        </div>
      </div>

      {/* Hero Banner with Duas */}
      <div
        className="card mb-16"
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0f2a1e 100%)',
          color: '#ffffff',
          borderColor: 'var(--gold-500)',
        }}
      >
        <div className="flex-between mb-12">
          <span className="card-badge" style={{ background: 'var(--gold-500)', color: '#04170d', fontWeight: 700 }}>
            Ramadan Experience
          </span>
          <span className="text-xs" style={{ color: 'var(--gold-300)' }}>
            Iftar & Sehri Tracking
          </span>
        </div>

        <div className="mb-12">
          <div className="text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--gold-400)' }}>
            Dua for Breaking Fast (Iftar)
          </div>
          <div
            className="text-lg mb-4"
            dir="rtl"
            style={{ fontFamily: 'var(--font-arabic)', lineHeight: 1.8 }}
          >
            ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ
          </div>
          <div className="text-xs" style={{ color: '#d1fae5' }}>
            "The thirst is gone, the veins are moistened, and the reward is confirmed, if Allah wills." (Abu Dawood)
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-label">Fasts Completed</div>
          <div className="stat-value text-emerald-700">
            {summary ? summary.summary.fasted : 0}
            <small>/ 30</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taraweeh Offered</div>
          <div className="stat-value">
            {summary ? summary.summary.taraweeh : 0}
            <small>nights</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Quran Recited</div>
          <div className="stat-value">
            {summary ? summary.summary.quranPara : 0}
            <small>paras</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Khatams</div>
          <div className="stat-value" style={{ color: 'var(--gold-600)' }}>
            {summary ? summary.summary.khatams : 0}
          </div>
        </div>
      </div>

      {/* Daily Ramadan Checklist Card */}
      <div className="card mb-16">
        <div className="card-header">
          <div>
            <div className="card-title">Daily Ramadan Checklist</div>
            <div className="card-subtitle">Recording for: <b>{selectedDate}</b></div>
          </div>
        </div>

        <div className="flex flex-col gap-12">
          <label className="nafl-row">
            <div>
              <b>Roza (Fasting)</b>
              <span className="block text-xs text-muted">Kept the fast today</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!dayLog.fasted}
              onChange={(e) => saveLog({ fasted: e.target.checked ? 1 : 0 })}
            />
          </label>

          <label className="nafl-row">
            <div>
              <b>Taraweeh Prayer</b>
              <span className="block text-xs text-muted">Night prayer during Ramadan</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!dayLog.taraweeh}
              onChange={(e) => saveLog({ taraweeh: e.target.checked ? 1 : 0 })}
            />
          </label>

          <label className="nafl-row">
            <div>
              <b>Tahajjud / Qiyam al-Layl</b>
              <span className="block text-xs text-muted">Offered in the last third of the night</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!dayLog.tahajjud}
              onChange={(e) => saveLog({ tahajjud: e.target.checked ? 1 : 0 })}
            />
          </label>

          <label className="nafl-row">
            <div>
              <b>Sadaqah / Good Deeds</b>
              <span className="block text-xs text-muted">Charity or acts of kindness</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!dayLog.sadaqah}
              onChange={(e) => saveLog({ sadaqah: e.target.checked ? 1 : 0 })}
            />
          </label>

          <div className="pt-12 border-t">
            <label className="input-label block mb-4">Quran Para Completed Today</label>
            <input
              type="number"
              step="0.25"
              min="0"
              max="30"
              value={dayLog.quranPara}
              onChange={(e) => saveLog({ quranPara: e.target.value })}
              className="input-sm"
              placeholder="e.g. 1"
            />
          </div>
        </div>
      </div>

      {/* 30-Day Ramadan Heatmap */}
      <div className="card mb-16">
        <div className="card-header">
          <div className="card-title">30-Day Ramadan Journey</div>
          <span className="card-subtitle">Last 10 nights marked with stars</span>
        </div>
        <div className="quran-map">
          {Array.from({ length: 30 }, (_, i) => {
            const dayNum = i + 1;
            const isOdd = isOddNight(dayNum);
            const isFasted = summary && summary.logs[i] && summary.logs[i].fasted;

            return (
              <div
                key={dayNum}
                className={`heatmap-cell qc flex-center flex-col text-xs font-semibold ${
                  isFasted ? 'jamaat text-white' : ''
                }`}
                style={{
                  border: isOdd ? '2px solid var(--gold-500)' : undefined,
                  position: 'relative',
                }}
              >
                <span>{dayNum}</span>
                {isOdd && <span style={{ fontSize: '8px', color: 'var(--gold-400)' }}>★</span>}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="heatmap-cell jamaat" style={{ width: 12, height: 12 }} /> Fasted
          </span>
          <span>
            <i className="heatmap-cell" style={{ width: 12, height: 12, border: '2px solid var(--gold-500)' }} /> Odd Night (21, 23, 25, 27, 29)
          </span>
        </div>
      </div>
    </div>
  );
}

