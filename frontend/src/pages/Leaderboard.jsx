import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Avatar, SkeletonCard, EmptyState } from '../components/UI.jsx';
import {
  Trophy,
  Users,
  Search,
  UserPlus,
  Check,
  X,
  UserMinus,
  Shield,
  Medal,
} from 'lucide-react';

export default function Leaderboard({ user, onUnauthorized, addToast }) {
  const [period, setPeriod] = useState('week'); // week vs month
  const [leaderboard, setLeaderboard] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lb, fr, reqs] = await Promise.all([
        api.leaderboard(period),
        api.friends(),
        api.friendRequests(),
      ]);
      setLeaderboard(lb.leaderboard || []);
      setFriends(fr.friends || []);
      setRequests(reqs || { incoming: [], outgoing: [] });
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, onUnauthorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const search = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await api.searchUsers(searchQuery);
      setSearchResults(res.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetId) => {
    try {
      await api.sendFriendRequest(targetId);
      if (addToast) addToast('Friend request sent!');
      setSearchResults((prev) => prev.filter((u) => u.id !== targetId));
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRequest = async (id, action) => {
    try {
      await api.respondFriendRequest(id, action);
      if (addToast) addToast(`Request ${action}ed`);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await api.removeFriend(friendId);
      if (addToast) addToast('Friend removed');
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Trophy className="text-emerald-600" /> Circle & Leaderboard
          </h1>
          <div className="page-date">Friendly, positive competition in good deeds</div>
        </div>
        <div className="seg-control" style={{ width: '180px', marginBottom: 0 }}>
          <button
            type="button"
            className={`seg-btn ${period === 'week' ? 'active' : ''}`}
            onClick={() => setPeriod('week')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={`seg-btn ${period === 'month' ? 'active' : ''}`}
            onClick={() => setPeriod('month')}
          >
            Monthly
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="card mb-16" style={{ background: 'linear-gradient(180deg, var(--emerald-50) 0%, var(--surface) 100%)' }}>
          <div className="podium">
            {/* Rank 2 */}
            {top3[1] && (
              <div className="podium-item">
                <Avatar name={top3[1].name} color={top3[1].avatar_color} size="lg" />
                <span className="font-semibold text-sm">{top3[1].name}</span>
                <span className="podium-rank">2nd</span>
                <span className="podium-points">{top3[1].periodPoints} pts</span>
              </div>
            )}
            {/* Rank 1 */}
            {top3[0] && (
              <div className="podium-item">
                <Medal className="text-gold-500 mb-2" size={28} />
                <Avatar name={top3[0].name} color={top3[0].avatar_color} size="xl" />
                <span className="font-bold text-sm">{top3[0].name}</span>
                <span className="podium-rank">1st Place</span>
                <span className="podium-points text-emerald-700 font-bold">{top3[0].periodPoints} pts</span>
              </div>
            )}
            {/* Rank 3 */}
            {top3[2] && (
              <div className="podium-item">
                <Avatar name={top3[2].name} color={top3[2].avatar_color} size="lg" />
                <span className="font-semibold text-sm">{top3[2].name}</span>
                <span className="podium-rank">3rd</span>
                <span className="podium-points">{top3[2].periodPoints} pts</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="card mb-16">
        <div className="card-header">
          <div className="card-title">Ranking (Friends & You)</div>
          <span className="text-xs text-muted">Nafl and Quran never affect ranking</span>
        </div>

        {loading ? (
          <SkeletonCard />
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Leaderboard is empty"
            description="Add friends below to track and encourage each other."
          />
        ) : (
          <div>
            {leaderboard.map((row) => (
              <div
                key={row.id}
                className={`leaderboard-row ${row.isMe ? 'me' : ''}`}
              >
                <div className="leaderboard-rank">#{row.rank}</div>
                <Avatar name={row.name} color={row.avatar_color} size="sm" />
                <div className="leaderboard-name">
                  <span>{row.name}</span>
                  {row.isMe && <span className="card-badge success text-xs ml-8">You</span>}
                </div>
                <div className="leaderboard-points">{row.periodPoints} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Friend Requests */}
      {requests.incoming.length > 0 && (
        <div className="card mb-16">
          <div className="card-title mb-12">Incoming Friend Requests</div>
          <div className="flex flex-col gap-8">
            {requests.incoming.map((req) => (
              <div key={req.id} className="flex-between py-8 border-b">
                <div className="flex items-center gap-8">
                  <Avatar name={req.name} color={req.avatar_color} size="sm" />
                  <span className="font-medium text-sm">{req.name}</span>
                </div>
                <div className="flex gap-8">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRequest(req.id, 'accept')}
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRequest(req.id, 'reject')}
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List & User Search */}
      <div className="card mb-16">
        <div className="card-header">
          <div className="card-title">Find & Add Friends</div>
        </div>

        <form onSubmit={search} className="flex gap-8 mb-16">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn btn-primary" disabled={searching}>
            <Search size={16} /> Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mb-16 pb-16 border-b">
            <div className="text-xs text-muted mb-8">Search Results:</div>
            <div className="flex flex-col gap-8">
              {searchResults.map((u) => (
                <div key={u.id} className="flex-between py-6">
                  <div className="flex items-center gap-8">
                    <Avatar name={u.name} color={u.avatar_color} size="sm" />
                    <span>{u.name}</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => sendRequest(u.id)}
                  >
                    <UserPlus size={14} /> Add Friend
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-muted mb-8">Your Friends ({friends.length}):</div>
          {friends.length === 0 ? (
            <p className="text-sm text-muted">No friends yet. Search above to invite companions.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {friends.map((f) => (
                <div key={f.id} className="flex-between py-6 border-b">
                  <div className="flex items-center gap-8">
                    <Avatar name={f.name} color={f.avatar_color} size="sm" />
                    <span className="font-medium text-sm">{f.name}</span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => removeFriend(f.id)}
                    title="Remove Friend"
                  >
                    <UserMinus size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

