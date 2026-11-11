import { useCallback, useEffect, useState } from 'react';
import { api, toISO } from '../api.js';
import { PRAYER_NAMES } from '../consts.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  CheckCircle,
  Award,
  ArrowRight,
  BookOpen,
  Target,
} from 'lucide-react';

export default function WeeklyReport({ onUnauthorized, addToast, go }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.weeklyReport(toISO(new Date()));
      setReport(data);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const convertGoalToChallenge = async (prayerName) => {
    try {
      await api.createChallenge({
        title: `Consistent ${PRAYER_NAMES[prayerName] || prayerName} Week`,
        description: `Commit to praying ${PRAYER_NAMES[prayerName] || prayerName} every day for the next 7 days.`,
        challengeType: 'personal',
        category: 'namaz',
        targetType: `${prayerName}_consistency`,
        targetValue: 7,
        durationDays: 7,
      });
      if (addToast) addToast(`Challenge created for ${PRAYER_NAMES[prayerName] || prayerName}!`);
      if (go) go('challenges');
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="page-title mb-16">Weekly Worship Report</h1>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !report) {
    return <div className="alert alert-error">{error || 'Unable to generate report'}</div>;
  }

  const { prayers, zikr, quran, nafl, streak, points, insights, comparison, strongest, weakest } = report;
  const completionPct = Math.round((prayers.total / 35) * 100);

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <FileText className="text-emerald-600" /> Personal Weekly Report
          </h1>
          <div className="page-date">
            {report.weekStart} to {report.weekEnd} · Private summary
          </div>
        </div>
      </div>

      {/* Main Highlights Card */}
      <div className="card mb-16" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--emerald-50) 100%)' }}>
        <div className="card-header">
          <div>
            <div className="card-title">7-Day Completion Summary</div>
            <div className="card-subtitle">{prayers.total} of 35 obligatory prayers logged</div>
          </div>
          <span className="card-badge success font-bold">{completionPct}% Consistent</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
        </div>
        <div className="stats-grid stats-grid-4 mt-16">
          <div>
            <div className="stat-label">In Jamaat</div>
            <div className="stat-value text-emerald-700">{prayers.jamaat}</div>
          </div>
          <div>
            <div className="stat-label">Alone</div>
            <div className="stat-value">{prayers.alone}</div>
          </div>
          <div>
            <div className="stat-label">Made Up (Qaza)</div>
            <div className="stat-value">{prayers.qaza}</div>
          </div>
          <div>
            <div className="stat-label">Points Earned</div>
            <div className="stat-value" style={{ color: 'var(--emerald-600)' }}>
              {points.week}
              <small style={{ fontSize: '11px', color: points.change >= 0 ? 'var(--emerald-600)' : 'var(--danger)' }}>
                ({points.change >= 0 ? `+${points.change}` : points.change})
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligent Insights */}
      {insights && insights.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <div className="card-title">
              <Sparkles className="text-emerald-600" /> Transparent Spiritual Insights
            </div>
          </div>
          <div className="flex flex-col gap-12">
            {insights.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-8 text-sm">
                <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-2" />
                <span>{msg}</span>
              </div>
            ))}
          </div>

          {weakest && (
            <div className="mt-16 pt-16 border-t flex-between">
              <span className="text-xs text-muted">
                Turn insight into action for <b>{PRAYER_NAMES[weakest] || weakest}</b>:
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => convertGoalToChallenge(weakest)}
              >
                <Target size={14} /> Create Personal Challenge
              </button>
            </div>
          )}
        </div>
      )}

      {/* Breakdown: Zikr, Quran, Nafl */}
      <div className="stats-grid stats-grid-3 mb-16">
        <div className="card">
          <div className="card-title text-sm mb-8">Daily Azkar</div>
          <div className="stat-value">{zikr.fullDays} <small>/ 7 days</small></div>
          <div className="stat-detail">Completed both morning and evening</div>
        </div>

        <div className="card">
          <div className="card-title text-sm mb-8">Quran Volume</div>
          <div className="stat-value">{quran.pages} <small>pages</small></div>
          <div className="stat-detail">+{quran.paras} paras completed</div>
        </div>

        <div className="card">
          <div className="card-title text-sm mb-8">Nafl Worship</div>
          <div className="stat-value">{nafl.count} <small>prayers</small></div>
          <div className="stat-detail">Private voluntary prayers</div>
        </div>
      </div>

      {/* Prayer by Prayer Analysis Table */}
      <div className="card mb-16">
        <div className="card-title mb-16">Prayer-wise Consistency</div>
        <div className="flex flex-col gap-8">
          {Object.entries(prayers.prayerStats || {}).map(([p, st]) => (
            <div key={p} className="flex-between py-8 border-b text-sm">
              <div className="flex items-center gap-8">
                <b>{PRAYER_NAMES[p] || p}</b>
                {p === strongest && <span className="card-badge success text-xs">Strongest</span>}
                {p === weakest && <span className="card-badge warning text-xs">Opportunity</span>}
              </div>
              <div className="text-muted">
                {st.jamaat} Jamaat · {st.alone} Alone · {st.total}/7 Logged
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

