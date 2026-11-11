import { useCallback, useEffect, useState } from 'react';
import { api, toISO } from '../api.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  Target,
  Plus,
  Users,
  User,
  CheckCircle,
  Clock,
  ChevronRight,
  Flame,
} from 'lucide-react';

export default function Challenges({ onUnauthorized, addToast }) {
  const [tab, setTab] = useState('active'); // active vs completed
  const [challenges, setChallenges] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState('personal'); // personal vs friend
  const [category, setCategory] = useState('namaz');
  const [targetType, setTargetType] = useState('fajr_jamaat');
  const [targetValue, setTargetValue] = useState(7);
  const [durationDays, setDurationDays] = useState(7);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadChallenges = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, fr] = await Promise.all([
        api.challenges(tab),
        api.friends().catch(() => ({ friends: [] })),
      ]);
      setChallenges(data.challenges || []);
      setFriendsList(fr.friends || []);
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, onUnauthorized]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createChallenge({
        title,
        description,
        challengeType,
        category,
        targetType,
        targetValue: Number(targetValue),
        durationDays: Number(durationDays),
        friendIds: challengeType === 'friend' ? selectedFriends : undefined,
      });
      if (addToast) addToast('Challenge initiated successfully!');
      setShowCreate(false);
      setTitle('');
      setDescription('');
      loadChallenges();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const respondInvitation = async (id, action) => {
    try {
      await api.respondChallenge(id, action);
      if (addToast) addToast(`Challenge invitation ${action}ed`);
      loadChallenges();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Target className="text-emerald-600" /> Spiritual Goals & Challenges
          </h1>
          <div className="page-date">Personal growth and encouraging friend milestones</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={16} /> New Challenge
        </button>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Creation Modal / Form */}
      {showCreate && (
        <div className="card mb-16" style={{ background: 'var(--surface-hover)' }}>
          <div className="card-header">
            <div className="card-title">Create a Worship Challenge</div>
          </div>
          <form onSubmit={handleCreate}>
            <div className="input-group">
              <label className="input-label">Challenge Title</label>
              <input
                type="text"
                placeholder="e.g. 7 Days of Fajr in Jamaat"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Description (Optional)</label>
              <input
                type="text"
                placeholder="Encouragement or context for this milestone"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid2 mb-16">
              <div>
                <label className="input-label block mb-4">Challenge Scope</label>
                <div className="seg-control">
                  <button
                    type="button"
                    className={`seg-btn ${challengeType === 'personal' ? 'active' : ''}`}
                    onClick={() => setChallengeType('personal')}
                  >
                    Personal Goal
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${challengeType === 'friend' ? 'active' : ''}`}
                    onClick={() => setChallengeType('friend')}
                  >
                    Friend Challenge
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label block mb-4">Category</label>
                <select
                  className="input-select"
                  style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="namaz">Namaz Consistency</option>
                  <option value="zikr">Morning / Evening Azkar</option>
                  <option value="quran">Quran Reading</option>
                  <option value="mixed">Comprehensive</option>
                </select>
              </div>
            </div>

            <div className="grid2 mb-16">
              <div>
                <label className="input-label block mb-4">Target Days / Value</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="input-label block mb-4">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  required
                />
              </div>
            </div>

            {challengeType === 'friend' && (
              <div className="mb-16">
                <label className="input-label block mb-4">Invite Friends</label>
                {friendsList.length === 0 ? (
                  <p className="text-xs text-muted">You have not added any friends yet.</p>
                ) : (
                  <div className="chip-row">
                    {friendsList.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`chip-btn ${selectedFriends.includes(f.id) ? 'done' : ''}`}
                        onClick={() => {
                          setSelectedFriends((prev) =>
                            prev.includes(f.id)
                              ? prev.filter((id) => id !== f.id)
                              : [...prev, f.id]
                          );
                        }}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-8">
              <button className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Launch Challenge'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="seg-control mb-16" style={{ width: '220px' }}>
        <button
          type="button"
          className={`seg-btn ${tab === 'active' ? 'active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
        <button
          type="button"
          className={`seg-btn ${tab === 'completed' ? 'active' : ''}`}
          onClick={() => setTab('completed')}
        >
          Completed
        </button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : challenges.length === 0 ? (
        <div className="card empty-state">
          <Target />
          <h3>No {tab} challenges found</h3>
          <p>Set a personal worship goal or invite a friend to build consistency together.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {challenges.map((c) => {
            const isPendingInvite = c.my_status === 'pending';
            const pct = Math.min(100, Math.round((c.my_progress / c.target_value) * 100));

            return (
              <div className="card" key={c.id}>
                <div className="card-header">
                  <div>
                    <div className="card-title flex items-center gap-8">
                      {c.challenge_type === 'personal' ? (
                        <User size={16} className="text-muted" />
                      ) : (
                        <Users size={16} className="text-emerald-600" />
                      )}
                      <span>{c.title}</span>
                    </div>
                    {c.description && <div className="card-subtitle">{c.description}</div>}
                  </div>
                  <span className="card-badge neutral">
                    {c.duration_days} Days ({c.start_date} to {c.end_date})
                  </span>
                </div>

                {isPendingInvite ? (
                  <div className="flex-between py-8">
                    <span className="text-sm">You are invited to this challenge!</span>
                    <div className="flex gap-8">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => respondInvitation(c.id, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => respondInvitation(c.id, 'reject')}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex-between text-xs text-muted mb-4">
                      <span>Progress</span>
                      <span>
                        {c.my_progress} / {c.target_value} ({pct}%)
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

