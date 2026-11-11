import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { Toast, Avatar } from './components/UI.jsx';
import Auth from './pages/Auth.jsx';
import Today from './pages/Today.jsx';
import Quran from './pages/Quran.jsx';
import Nafl from './pages/Nafl.jsx';
import Streak from './pages/Streak.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Challenges from './pages/Challenges.jsx';
import Badges from './pages/Badges.jsx';
import WeeklyReport from './pages/WeeklyReport.jsx';
import Ramadan from './pages/Ramadan.jsx';
import Settings from './pages/Settings.jsx';

import {
  Calendar,
  BookOpen,
  Moon,
  Flame,
  Trophy,
  Target,
  Award,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: Calendar, section: 'Daily Worship' },
  { id: 'quran', label: 'Quran', icon: BookOpen, section: 'Daily Worship' },
  { id: 'nafl', label: 'Nafl (Private)', icon: Moon, section: 'Daily Worship' },
  { id: 'streak', label: 'Streaks & Matrix', icon: Flame, section: 'Consistency' },
  { id: 'weekly-report', label: 'Weekly Report', icon: FileText, section: 'Consistency' },
  { id: 'leaderboard', label: 'Circle & Ranks', icon: Trophy, section: 'Community' },
  { id: 'challenges', label: 'Challenges', icon: Target, section: 'Community' },
  { id: 'badges', label: 'Achievements', icon: Award, section: 'Milestones' },
  { id: 'ramadan', label: 'Ramadan Mode', icon: Sparkles, section: 'Milestones' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, section: 'System' },
];

const MOBILE_TABS = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'quran', label: 'Quran', icon: BookOpen },
  { id: 'nafl', label: 'Nafl', icon: Moon },
  { id: 'streak', label: 'Streak', icon: Flame },
  { id: 'leaderboard', label: 'Circle', icon: Trophy },
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('today');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState([]);

  const unauthorized = useCallback(() => setUser(null), []);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    api.me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="auth-container">
        <div className="text-muted font-medium">Opening your spiritual dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onDone={(u) => {
          setTab('today');
          setUser(u);
          addToast(`Assalamu Alaikum, ${u.name}!`);
        }}
      />
    );
  }

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  let currentSection = null;

  return (
    <div className="app-layout">
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="sidebar-logo">
          <Moon size={20} className="text-emerald-700" />
          <span>Ibadah Tracker</span>
        </div>
        <div className="flex items-center gap-8">
          <Avatar name={user.name} color={user.avatar_color} size="sm" />
          <button className="btn-ghost" onClick={() => setTab('settings')} title="Settings">
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* Desktop Collapsible Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Moon size={22} className="text-emerald-700" />
            {!sidebarCollapsed && <span>Ibadah Tracker</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isNewSection = item.section !== currentSection;
            currentSection = item.section;
            const Icon = item.icon;
            const isActive = tab === item.id;

            return (
              <div key={item.id}>
                {isNewSection && !sidebarCollapsed && (
                  <div className="sidebar-section">{item.section}</div>
                )}
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setTab(item.id)}
                  title={item.label}
                >
                  <Icon />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => setTab('settings')}>
            <Avatar name={user.name} color={user.avatar_color} size="sm" />
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-email">{user.email}</div>
              </div>
            )}
          </div>
          <button
            className="nav-item text-danger mt-8"
            onClick={logout}
            title="Log Out"
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="main-content">
        <div className="main-inner">
          {tab === 'today' && (
            <Today
              user={user}
              go={setTab}
              onUnauthorized={unauthorized}
              addToast={addToast}
            />
          )}
          {tab === 'quran' && (
            <Quran onUnauthorized={unauthorized} addToast={addToast} />
          )}
          {tab === 'nafl' && (
            <Nafl onUnauthorized={unauthorized} addToast={addToast} />
          )}
          {tab === 'streak' && (
            <Streak onUnauthorized={unauthorized} />
          )}
          {tab === 'weekly-report' && (
            <WeeklyReport
              onUnauthorized={unauthorized}
              addToast={addToast}
              go={setTab}
            />
          )}
          {tab === 'leaderboard' && (
            <Leaderboard
              user={user}
              onUnauthorized={unauthorized}
              addToast={addToast}
            />
          )}
          {tab === 'challenges' && (
            <Challenges onUnauthorized={unauthorized} addToast={addToast} />
          )}
          {tab === 'badges' && (
            <Badges onUnauthorized={unauthorized} />
          )}
          {tab === 'ramadan' && (
            <Ramadan onUnauthorized={unauthorized} addToast={addToast} />
          )}
          {tab === 'settings' && (
            <Settings
              user={user}
              onUnauthorized={unauthorized}
              addToast={addToast}
              onUserUpdate={(u) => setUser(u)}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
