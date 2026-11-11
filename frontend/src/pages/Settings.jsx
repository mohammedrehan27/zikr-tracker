import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { CALC_METHODS } from '../consts.js';
import { Skeleton, SkeletonCard } from '../components/UI.jsx';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Globe,
  Bell,
  Eye,
  Trash2,
  Save,
  Moon,
  Sparkles,
  Shield,
} from 'lucide-react';

export default function Settings({ user, onUnauthorized, addToast, onUserUpdate }) {
  const [prefs, setPrefs] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePass, setDeletePass] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.preferences();
      setPrefs(data.preferences || {});
    } catch (e) {
      if (e.status === 401) onUnauthorized();
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updatePref = async (key, val) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    try {
      await api.updatePreferences({ [key]: val });
      if (addToast) addToast('Preferences updated');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await api.updateProfile({ name });
      if (onUserUpdate) onUserUpdate(res.user);
      if (addToast) addToast('Profile name updated');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError('');
    try {
      await api.updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (addToast) addToast('Password changed successfully');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePass) {
      alert('Please enter your password to confirm account deletion.');
      return;
    }
    if (confirm('CRITICAL: This will permanently delete your account, prayer logs, streaks, and data. Are you sure?')) {
      try {
        await api.deleteAccount({ password: deletePass });
        onUnauthorized();
      } catch (e) {
        setError(e.message);
      }
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="page-title mb-16">Settings</h1>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h1 className="page-title flex items-center gap-8">
            <SettingsIcon className="text-emerald-600" /> Account & Preferences
          </h1>
          <div className="page-date">Configure calculation methods, privacy, and account security</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Profile Details */}
      <div className="card mb-16">
        <div className="card-title mb-12 flex items-center gap-8">
          <User size={18} className="text-emerald-600" /> Profile Information
        </div>
        <form onSubmit={handleUpdateProfile}>
          <div className="input-group">
            <label className="input-label">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Registered Email</label>
            <input type="email" value={user.email} disabled style={{ opacity: 0.6 }} />
          </div>
          <button className="btn btn-secondary btn-sm">Update Name</button>
        </form>
      </div>

      {/* Prayer Calculation Settings */}
      <div className="card mb-16">
        <div className="card-title mb-12 flex items-center gap-8">
          <Globe size={18} className="text-emerald-600" /> Prayer Calculation Settings
        </div>

        <div className="grid2 mb-16">
          <div>
            <label className="input-label block mb-4">Calculation Method</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}
              value={prefs?.prayer_calc_method || 'MWL'}
              onChange={(e) => updatePref('prayer_calc_method', e.target.value)}
            >
              {CALC_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label block mb-4">Asr Juristic Madhab</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}
              value={prefs?.asr_madhab || 'Standard'}
              onChange={(e) => updatePref('asr_madhab', e.target.value)}
            >
              <option value="Standard">Standard (Shafi'i, Maliki, Hanbali)</option>
              <option value="Hanafi">Hanafi (Later Asr time)</option>
            </select>
          </div>
        </div>

        <div className="grid2">
          <div className="input-group">
            <label className="input-label">City / Location</label>
            <input
              type="text"
              placeholder="e.g. London, Cairo, New York"
              value={prefs?.city || ''}
              onChange={(e) => updatePref('city', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Timezone</label>
            <input
              type="text"
              placeholder="e.g. UTC+3"
              value={prefs?.timezone || ''}
              onChange={(e) => updatePref('timezone', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Privacy & Social Permissions */}
      <div className="card mb-16">
        <div className="card-title mb-12 flex items-center gap-8">
          <Shield size={18} className="text-emerald-600" /> Privacy & Social Controls
        </div>

        <div className="flex flex-col gap-12">
          <label className="nafl-row">
            <div>
              <b>Leaderboard Visibility</b>
              <span className="block text-xs text-muted">Include your name in friends leaderboards</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!prefs?.leaderboard_visible}
              onChange={(e) => updatePref('leaderboard_visible', e.target.checked ? 1 : 0)}
            />
          </label>

          <label className="nafl-row">
            <div>
              <b>Public Prayer Heatmap</b>
              <span className="block text-xs text-muted">Allow friends to view your 5-prayer matrix (Off by default)</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!prefs?.heatmap_public}
              onChange={(e) => updatePref('heatmap_public', e.target.checked ? 1 : 0)}
            />
          </label>

          <label className="nafl-row">
            <div>
              <b>Smart Fix & Spiritual Insights</b>
              <span className="block text-xs text-muted">Display constructive consistency feedback on Today</span>
            </div>
            <input
              type="checkbox"
              className="toggle"
              checked={!!prefs?.smart_fix_enabled}
              onChange={(e) => updatePref('smart_fix_enabled', e.target.checked ? 1 : 0)}
            />
          </label>
        </div>
      </div>

      {/* Change Password */}
      <div className="card mb-16">
        <div className="card-title mb-12 flex items-center gap-8">
          <Lock size={18} className="text-emerald-600" /> Account Security
        </div>
        <form onSubmit={handleChangePassword}>
          <div className="input-group">
            <label className="input-label">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid2">
            <div className="input-group">
              <label className="input-label">New Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm">Update Password</button>
        </form>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="card mb-16" style={{ borderColor: 'var(--danger-bg)' }}>
        <div className="card-title text-danger mb-12 flex items-center gap-8">
          <Trash2 size={18} /> Danger Zone
        </div>
        <p className="text-xs text-muted mb-12">
          Permanently delete your account and all associated prayer logs, Quran tracking, and history.
        </p>
        <div className="flex gap-8 items-center">
          <input
            type="password"
            placeholder="Enter password to confirm"
            value={deletePass}
            onChange={(e) => setDeletePass(e.target.value)}
            style={{ maxWidth: '280px' }}
          />
          <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>
            Permanently Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

