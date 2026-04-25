import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/settings.css';
import type {
  UserProfileDto,
  UserSettingsDto,
  NotificationPreferenceDto,
  ThemeMode,
  WeightUnit,
  HeightUnit,
} from '../api/contracts';
import {
  getProfile,
  getAccessToken,
  clearTokens,
  getUserSettings,
  updateUserSettings,
  getNotificationPreferences,
  updateNotificationPreferences,
  changePassword,
  deleteAccount,
  sendTestNotification,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const DEFAULT_SETTINGS: UserSettingsDto = {
  theme: 'LIGHT',
  locale: 'en',
  units: { weight: 'KG', height: 'CM' },
};

const DEFAULT_PREFS: NotificationPreferenceDto = {
  pushEnabled: true,
  emailEnabled: true,
  mealReminders: true,
  expiryAlerts: true,
  weeklyReport: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  breakfastTime: '08:00',
  lunchTime: '13:00',
  dinnerTime: '19:00',
};

// ── component ────────────────────────────────

export default function Settings() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [settings, setSettings] = useState<UserSettingsDto>(DEFAULT_SETTINGS);
  const [prefs, setPrefs] = useState<NotificationPreferenceDto>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // change password modal
  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // delete account modal
  const [showDelete, setShowDelete] = useState(false);
  const [delPwd, setDelPwd] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) { navigate('/sign-in', { replace: true }); return; }
    loadAll();
  }, []);

  // apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme.toLowerCase());
  }, [settings.theme]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, sRes, nRes] = await Promise.allSettled([
        getProfile(),
        getUserSettings(),
        getNotificationPreferences(),
      ]);
      if (pRes.status === 'fulfilled') setProfile(pRes.value.data);
      if (sRes.status === 'fulfilled') setSettings({ ...DEFAULT_SETTINGS, ...sRes.value.data });
      if (nRes.status === 'fulfilled') setPrefs({ ...DEFAULT_PREFS, ...nRes.value.data });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function saveSettings(patch: Partial<UserSettingsDto>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await updateUserSettings(patch);
      showToast('Settings saved');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to save', 'err');
    } finally { setSaving(false); }
  }


  async function handleChangePassword() {
    if (newPwd.length < 6) { showToast('Password must be at least 6 chars', 'err'); return; }
    if (newPwd !== newPwd2) { showToast('Passwords do not match', 'err'); return; }
    setPwdSaving(true);
    try {
      await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      showToast('Password changed successfully');
      setShowPwd(false);
      setCurrentPwd(''); setNewPwd(''); setNewPwd2('');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed (wrong current password?)', 'err');
    } finally { setPwdSaving(false); }
  }

  async function handleDelete() {
    if (delConfirm !== 'DELETE') { showToast('Type DELETE to confirm', 'err'); return; }
    setDeleting(true);
    try {
      await deleteAccount({ password: delPwd, reason: delReason || undefined });
      clearTokens();
      navigate('/sign-up', { replace: true });
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Failed to delete account', 'err');
      setDeleting(false);
    }
  }


  function handleLogout() {
    clearTokens();
    navigate('/sign-in', { replace: true });
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="skeleton skeleton-title" style={{ marginTop: 60 }} />
          <div className="skeleton skeleton-card" style={{ height: 200, marginTop: 20 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="settings-page">
        <div className="settings-container">

          {/* Navbar (compact) */}
          <nav className="navbar">
            <Link to="/home" className="logo">
              <i className="fas fa-leaf" />
              <span className="logo-text">DIETRIX</span>
            </Link>
            <div className="nav-links">
              <Link to="/home">Home</Link>
              <Link to="/my-plan">My Plan</Link>
              <Link to="/pantry">Pantry</Link>
              <Link to="/ai-generate">AI Generator</Link>
              <Link to="/chat">Chat</Link>
            </div>
            <div className="user-menu">
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <i className="fas fa-sign-out-alt" />
              </button>
              <Link to="/profile" className="user-avatar" title="My Profile">
                {profile?.avatarUrl
                  ? <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : <span>{profile ? getInitials(profile.name) : '?'}</span>}
              </Link>
            </div>
          </nav>

          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">
              <i className="fas fa-gear" style={{ color: 'var(--primary)', marginRight: 12 }} />
              Settings
            </h1>
            <p className="page-subtitle">Customize your experience and account</p>
          </div>

          {/* === Section: Appearance === */}
          <section className="settings-card">
            <h2 className="settings-section-title">
              <i className="fas fa-palette" /> Appearance
            </h2>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Theme</div>
                <div className="settings-row-desc">Choose how Dietrix looks</div>
              </div>
              <div className="settings-toggle-group">
                {(['LIGHT', 'DARK', 'SYSTEM'] as ThemeMode[]).map((t) => (
                  <button
                    key={t}
                    className={`tg-btn ${settings.theme === t ? 'active' : ''}`}
                    onClick={() => saveSettings({ theme: t })}
                    disabled={saving}
                  >
                    {t === 'LIGHT' && <><i className="fas fa-sun" /> Light</>}
                    {t === 'DARK' && <><i className="fas fa-moon" /> Dark</>}
                    {t === 'SYSTEM' && <><i className="fas fa-circle-half-stroke" /> Auto</>}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* === Section: Units === */}
          <section className="settings-card">
            <h2 className="settings-section-title">
              <i className="fas fa-ruler" /> Units
            </h2>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Weight</div>
                <div className="settings-row-desc">Kilograms or pounds</div>
              </div>
              <div className="settings-toggle-group">
                {(['KG', 'LB'] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    className={`tg-btn ${settings.units.weight === u ? 'active' : ''}`}
                    onClick={() => saveSettings({ units: { ...settings.units, weight: u } })}
                    disabled={saving}
                  >{u}</button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Height</div>
                <div className="settings-row-desc">Centimeters or inches</div>
              </div>
              <div className="settings-toggle-group">
                {(['CM', 'INCH'] as HeightUnit[]).map((u) => (
                  <button
                    key={u}
                    className={`tg-btn ${settings.units.height === u ? 'active' : ''}`}
                    onClick={() => saveSettings({ units: { ...settings.units, height: u } })}
                    disabled={saving}
                  >{u}</button>
                ))}
              </div>
            </div>
          </section>


          {/* === Section: Account === */}
          <section className="settings-card">
            <h2 className="settings-section-title">
              <i className="fas fa-user-shield" /> Account & Security
            </h2>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Email</div>
                <div className="settings-row-desc">{profile?.email}</div>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <div className="settings-row-title">Password</div>
                <div className="settings-row-desc">Change your password</div>
              </div>
              <button className="btn-secondary" onClick={() => setShowPwd(true)}>
                <i className="fas fa-key" /> Change
              </button>
            </div>

            <div className="settings-row danger-row">
              <div className="settings-row-info">
                <div className="settings-row-title" style={{ color: '#dc2626' }}>Delete account</div>
                <div className="settings-row-desc">Permanently delete your account and all data (GDPR)</div>
              </div>
              <button className="btn-danger" onClick={() => setShowDelete(true)}>
                <i className="fas fa-trash" /> Delete
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`settings-toast ${toast.type === 'err' ? 'toast-err' : 'toast-ok'}`}>
          {toast.type === 'ok' ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Change password modal */}
      {showPwd && (
        <div className="settings-modal-overlay" onClick={() => !pwdSaving && setShowPwd(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <button className="settings-modal-close" onClick={() => setShowPwd(false)}>✕</button>
            <h2>Change password</h2>
            <p className="modal-desc">Enter your current password and choose a new one.</p>

            <input
              type="password"
              placeholder="Current password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
            />
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
            />

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPwd(false)} disabled={pwdSaving}>Cancel</button>
              <button className="btn-primary" onClick={handleChangePassword} disabled={pwdSaving || !currentPwd || !newPwd}>
                {pwdSaving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {showDelete && (
        <div className="settings-modal-overlay" onClick={() => !deleting && setShowDelete(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <button className="settings-modal-close" onClick={() => setShowDelete(false)}>✕</button>
            <h2 style={{ color: '#dc2626' }}>⚠️ Delete account</h2>
            <p className="modal-desc">
              This action <strong>cannot be undone</strong>. All your meal plans, recipes, pantry items
              and personal data will be permanently deleted (after a 30-day grace period).
            </p>

            <input
              type="password"
              placeholder="Your password"
              value={delPwd}
              onChange={(e) => setDelPwd(e.target.value)}
            />
            <input
              type="text"
              placeholder="Reason (optional, helps us improve)"
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
            />
            <input
              type="text"
              placeholder='Type "DELETE" to confirm'
              value={delConfirm}
              onChange={(e) => setDelConfirm(e.target.value)}
            />

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting || delConfirm !== 'DELETE' || !delPwd}
              >
                {deleting ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

