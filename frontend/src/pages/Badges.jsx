import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import { Award, Lock, CheckCircle2, Shield } from 'lucide-react';

export default function Badges({ onUnauthorized }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBadges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.badges();
      setBadges(data.badges || []);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  if (loading) {
    return (
      <div>
        <h1 className="page-title mb-16">Badges & Achievements</h1>
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Award className="text-emerald-600" /> Spiritual Milestones & Badges
          </h1>
          <div className="page-date">
            Unlocked {unlockedCount} of {badges.length} achievements
          </div>
        </div>
      </div>

      <div className="progress-bar mb-16">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.round((unlockedCount / badges.length) * 100)}%` }}
        />
      </div>

      <div className="badges-grid">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`badge-card ${!b.unlocked ? 'locked' : ''}`}
          >
            <div className="badge-icon">{b.icon || '🏆'}</div>
            <div className="badge-name">{b.name}</div>
            <div className="badge-desc">{b.description}</div>
            <span className={`badge-rarity ${b.rarity}`}>{b.rarity}</span>
            {b.unlocked && b.unlockedAt && (
              <div className="text-xs text-muted mt-8 flex-center gap-4">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>{b.unlockedAt.slice(0, 10)}</span>
              </div>
            )}
            {!b.unlocked && (
              <div className="text-xs text-muted mt-8 flex-center gap-4">
                <Lock size={12} />
                <span>Locked</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

