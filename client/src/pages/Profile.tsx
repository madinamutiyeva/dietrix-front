import { useEffect, useState, useRef, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/profile.css';
import type {
  UserProfileDto,
  UserPreferenceDto,
  UserTargetsDto,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  Gender,
  Goal,
  ActivityLevel,
  DietType,
  Allergy,
} from '../api/contracts';
import {
  getProfile,
  getPreferences,
  getTargets,
  updateProfile,
  updatePreferences,
  getAccessToken,
} from '../api/client';
import axios from 'axios';

// ── enum display maps ────────────────────────

const GENDER_LABELS: Record<string, string> = { MALE: 'Male', FEMALE: 'Female' };
const GOAL_LABELS: Record<string, string> = {
  LOSE_WEIGHT: 'Lose weight',
  MAINTAIN: 'Maintain',
  GAIN_MUSCLE: 'Gain muscle',
  GAIN_WEIGHT: 'Gain weight',
};
const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARY: 'Sedentary',
  LIGHTLY_ACTIVE: 'Lightly active',
  MODERATELY_ACTIVE: 'Moderately active',
  VERY_ACTIVE: 'Very active',
  EXTRA_ACTIVE: 'Extra active',
};
const DIET_LABELS: Record<string, string> = {
  NONE: 'No specific diet',
  VEGETARIAN: 'Vegetarian',
  VEGAN: 'Vegan',
  KETO: 'Keto',
  PALEO: 'Paleo',
  MEDITERRANEAN: 'Mediterranean',
  LOW_CARB: 'Low carb',
  HIGH_PROTEIN: 'High protein',
  GLUTEN_FREE: 'Gluten free',
};

const ALL_ALLERGIES: Allergy[] = [
  'GLUTEN','DAIRY','EGGS','NUTS','PEANUTS','SOY',
  'FISH','SHELLFISH','WHEAT','SESAME','SULFITES','LACTOSE','FRUCTOSE',
];

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── component ────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile]       = useState<UserProfileDto | null>(null);
  const [prefs, setPrefs]           = useState<UserPreferenceDto | null>(null);
  const [targets, setTargets]       = useState<UserTargetsDto | null>(null);
  const [loading, setLoading]       = useState(true);

  // edit states
  const [editBasic, setEditBasic]   = useState(false);
  const [editPrefs, setEditPrefs]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');

  // avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // form drafts
  const [draft, setDraft] = useState<UpdateProfileRequest>({});
  const [prefsDraft, setPrefsDraft] = useState<UpdatePreferencesRequest>({});

  // tags input state
  const [likedInput, setLikedInput]       = useState('');
  const [dislikedInput, setDislikedInput] = useState('');
  const [cuisineInput, setCuisineInput]   = useState('');

  useEffect(() => {
    if (!getAccessToken()) { navigate('/sign-in', { replace: true }); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pRes, prRes, tRes] = await Promise.allSettled([
        getProfile(), getPreferences(), getTargets(),
      ]);
      if (pRes.status === 'fulfilled')  { setProfile(pRes.value.data); initDraft(pRes.value.data); }
      if (prRes.status === 'fulfilled') { setPrefs(prRes.value.data); initPrefsDraft(prRes.value.data); }
      if (tRes.status === 'fulfilled')  setTargets(tRes.value.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }

  function initDraft(p: UserProfileDto) {
    setDraft({
      name: p.name,
      gender: p.gender ?? undefined,
      age: p.age ?? undefined,
      heightCm: p.heightCm ?? undefined,
      weightKg: p.weightKg ?? undefined,
      goal: p.goal ?? undefined,
      activityLevel: p.activityLevel ?? undefined,
    });
  }

  function initPrefsDraft(pr: UserPreferenceDto) {
    setPrefsDraft({
      dietType: pr.dietType ?? undefined,
      allergies: [...(pr.allergies ?? [])],
      likedFoods: [...(pr.likedFoods ?? [])],
      dislikedFoods: [...(pr.dislikedFoods ?? [])],
      cuisinePreferences: [...(pr.cuisinePreferences ?? [])],
    });
  }

  // ── avatar handlers ───────────────────────

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrorMsg('Image must be under 5 MB'); return; }

    setAvatarUploading(true);
    setErrorMsg('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await updateProfile({ avatarUrl: dataUrl });
      setProfile(res.data);
      setSuccessMsg('Avatar updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    setAvatarUploading(true);
    try {
      const res = await updateProfile({ avatarUrl: '' });
      setProfile(res.data);
      setSuccessMsg('Avatar removed');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to remove avatar');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── save basic info ───────────────────────

  async function handleSaveBasic() {
    setSaving(true); setErrorMsg('');
    try {
      const res = await updateProfile(draft);
      setProfile(res.data);
      initDraft(res.data);
      setEditBasic(false);
      setSuccessMsg('Profile updated');
      // refresh targets since weight/activity/goal may have changed
      try { const t = await getTargets(); setTargets(t.data); } catch { /* */ }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Failed to save changes');
      }
    } finally { setSaving(false); }
  }

  // ── save preferences ──────────────────────

  async function handleSavePrefs() {
    setSaving(true); setErrorMsg('');

    // flush any text left in tag inputs
    const liked    = [...(prefsDraft.likedFoods ?? [])];
    const disliked = [...(prefsDraft.dislikedFoods ?? [])];
    const cuisines = [...(prefsDraft.cuisinePreferences ?? [])];

    if (likedInput.trim())    { const v = likedInput.trim();    if (!liked.includes(v))    liked.push(v);    setLikedInput(''); }
    if (dislikedInput.trim()) { const v = dislikedInput.trim(); if (!disliked.includes(v)) disliked.push(v); setDislikedInput(''); }
    if (cuisineInput.trim())  { const v = cuisineInput.trim();  if (!cuisines.includes(v)) cuisines.push(v); setCuisineInput(''); }

    try {
      const payload: UpdatePreferencesRequest = {
        dietType: prefsDraft.dietType ?? 'NONE',
        allergies: prefsDraft.allergies ?? [],
        likedFoods: liked,
        dislikedFoods: disliked,
        cuisinePreferences: cuisines,
      };
      const res = await updatePreferences(payload);
      setPrefs(res.data);
      initPrefsDraft(res.data);
      setEditPrefs(false);
      setSuccessMsg('Preferences updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Failed to save preferences');
      }
    } finally { setSaving(false); }
  }

  // ── tag helpers ───────────────────────────

  function addTag(field: 'likedFoods' | 'dislikedFoods' | 'cuisinePreferences', value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const list = prefsDraft[field] ?? [];
    if (!list.includes(trimmed)) {
      setPrefsDraft({ ...prefsDraft, [field]: [...list, trimmed] });
    }
  }

  function removeTag(field: 'likedFoods' | 'dislikedFoods' | 'cuisinePreferences', idx: number) {
    const list = [...(prefsDraft[field] ?? [])];
    list.splice(idx, 1);
    setPrefsDraft({ ...prefsDraft, [field]: list });
  }

  function handleTagKeyDown(
    field: 'likedFoods' | 'dislikedFoods' | 'cuisinePreferences',
    value: string,
    setter: (v: string) => void,
    e: KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field, value);
      setter('');
    }
  }

  function toggleAllergy(a: Allergy) {
    const list = [...(prefsDraft.allergies ?? [])];
    const idx = list.indexOf(a);
    if (idx >= 0) list.splice(idx, 1); else list.push(a);
    setPrefsDraft({ ...prefsDraft, allergies: list });
  }

  // ── skeleton ──────────────────────────────

  if (loading) {
    return (
      <>
        <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="profile-page">
          <div className="profile-container">
            <div style={{ marginTop: 40 }}><div className="skeleton skeleton-title" /></div>
            <div className="skeleton skeleton-card" style={{ marginTop: 24, height: 160 }} />
            <div className="skeleton skeleton-card" style={{ marginTop: 24, height: 280 }} />
            <div className="skeleton skeleton-card" style={{ marginTop: 24, height: 200 }} />
          </div>
        </div>
      </>
    );
  }

  // ── render ────────────────────────────────

  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="profile-page">
        <div className="profile-container">

          {/* ── Back ─────────────────────────── */}
          <Link to="/home" className="profile-back">
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>

          {/* ── Alerts ───────────────────────── */}
          {successMsg && (
            <div className="profile-alert profile-alert-success">
              <i className="fas fa-check-circle" /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="profile-alert profile-alert-error">
              <i className="fas fa-exclamation-circle" /> {errorMsg}
            </div>
          )}

          {/* ═══ Avatar ═══════════════════════ */}
          <div className="avatar-section">
            <div className="avatar-wrapper">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  {profile ? getInitials(profile.name) : '?'}
                </div>
              )}
              <label className="avatar-upload-btn" title="Upload photo">
                <i className="fas fa-camera" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <div className="avatar-name">{profile?.name}</div>
            <div className="avatar-email">{profile?.email}</div>
            {avatarUploading && (
              <div className="avatar-uploading"><span className="spinner" /> Uploading…</div>
            )}
            {profile?.avatarUrl && !avatarUploading && (
              <button className="avatar-remove" onClick={handleAvatarDelete}>
                <i className="fas fa-trash-alt" /> Remove photo
              </button>
            )}
          </div>

          {/* ═══ Basic info ═══════════════════ */}
          <div className="profile-section">
            <div className="profile-section-header">
              <h2><i className="fas fa-user" /> Basic Info</h2>
              {!editBasic && (
                <button className="edit-toggle" onClick={() => setEditBasic(true)}>
                  <i className="fas fa-pen" /> Edit
                </button>
              )}
            </div>

            {!editBasic ? (
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{profile?.name ?? '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Gender</span>
                  <span className="info-value">{profile?.gender ? GENDER_LABELS[profile.gender] : '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Age</span>
                  <span className="info-value">{profile?.age ?? '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Height</span>
                  <span className="info-value">{profile?.heightCm ? `${profile.heightCm} cm` : '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Weight</span>
                  <span className="info-value">{profile?.weightKg ? `${profile.weightKg} kg` : '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Activity</span>
                  <span className="info-value">{profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Goal</span>
                  <span className="info-value">{profile?.goal ? GOAL_LABELS[profile.goal] : '—'}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="edit-grid">
                  <div className="edit-field full-width">
                    <label className="edit-label">Name</label>
                    <input className="edit-input" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Gender</label>
                    <select className="edit-select" value={draft.gender ?? ''} onChange={(e) => setDraft({ ...draft, gender: e.target.value as Gender })}>
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Age</label>
                    <input className="edit-input" type="number" min={10} max={120} value={draft.age ?? ''} onChange={(e) => setDraft({ ...draft, age: +e.target.value || undefined })} />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Height (cm)</label>
                    <input className="edit-input" type="number" min={50} max={300} step={0.1} value={draft.heightCm ?? ''} onChange={(e) => setDraft({ ...draft, heightCm: +e.target.value || undefined })} />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Weight (kg)</label>
                    <input className="edit-input" type="number" min={20} max={500} step={0.1} value={draft.weightKg ?? ''} onChange={(e) => setDraft({ ...draft, weightKg: +e.target.value || undefined })} />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Activity Level</label>
                    <select className="edit-select" value={draft.activityLevel ?? ''} onChange={(e) => setDraft({ ...draft, activityLevel: e.target.value as ActivityLevel })}>
                      <option value="">Select</option>
                      {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Goal</label>
                    <select className="edit-select" value={draft.goal ?? ''} onChange={(e) => setDraft({ ...draft, goal: e.target.value as Goal })}>
                      <option value="">Select</option>
                      {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="profile-btn-row">
                  <button className="profile-btn profile-btn-cancel" onClick={() => { setEditBasic(false); if (profile) initDraft(profile); }}>Cancel</button>
                  <button className="profile-btn profile-btn-save" disabled={saving} onClick={handleSaveBasic}>
                    {saving ? <><span className="spinner" /> Saving…</> : <><i className="fas fa-check" /> Save</>}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ═══ Nutrition Targets ════════════ */}
          {targets && (
            <div className="profile-section">
              <div className="profile-section-header">
                <h2><i className="fas fa-bullseye" /> Daily Targets</h2>
              </div>
              <div className="targets-grid">
                <div className="target-card">
                  <div className="target-value">{targets.dailyCalories}</div>
                  <div className="target-label">Calories</div>
                  <div className="target-sub">kcal / day</div>
                </div>
                <div className="target-card">
                  <div className="target-value">{targets.proteinGrams}g</div>
                  <div className="target-label">Protein</div>
                  <div className="target-sub">{targets.proteinPercent}%</div>
                </div>
                <div className="target-card">
                  <div className="target-value">{targets.carbsGrams}g</div>
                  <div className="target-label">Carbs</div>
                  <div className="target-sub">{targets.carbsPercent}%</div>
                </div>
                <div className="target-card">
                  <div className="target-value">{targets.fatGrams}g</div>
                  <div className="target-label">Fat</div>
                  <div className="target-sub">{targets.fatPercent}%</div>
                </div>
                <div className="target-card">
                  <div className="target-value">{targets.bmi.toFixed(1)}</div>
                  <div className="target-label">BMI</div>
                  <div className="target-sub">{targets.bmiCategory}</div>
                </div>
                <div className="target-card">
                  <div className="target-value">{(targets.waterMl / 1000).toFixed(1)}L</div>
                  <div className="target-label">Water</div>
                  <div className="target-sub">per day</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Diet Preferences ═════════════ */}
          <div className="profile-section">
            <div className="profile-section-header">
              <h2><i className="fas fa-utensils" /> Diet & Preferences</h2>
              {!editPrefs && (
                <button className="edit-toggle" onClick={() => setEditPrefs(true)}>
                  <i className="fas fa-pen" /> Edit
                </button>
              )}
            </div>

            {!editPrefs ? (
              <>
                <div className="info-grid" style={{ marginBottom: 20 }}>
                  <div className="info-item">
                    <span className="info-label">Diet Type</span>
                    <span className="info-value">{prefs?.dietType ? DIET_LABELS[prefs.dietType] : '—'}</span>
                  </div>
                </div>

                <div className="info-item" style={{ marginBottom: 16 }}>
                  <span className="info-label">Allergies</span>
                  <div className="tags-display" style={{ marginTop: 8 }}>
                    {(prefs?.allergies ?? []).length > 0
                      ? (prefs!.allergies ?? []).map((a) => <span className="pref-tag" key={a}>{a}</span>)
                      : <span className="info-value">None</span>}
                  </div>
                </div>

                <div className="info-item" style={{ marginBottom: 16 }}>
                  <span className="info-label">Liked Foods</span>
                  <div className="tags-display" style={{ marginTop: 8 }}>
                    {(prefs?.likedFoods ?? []).length > 0
                      ? (prefs!.likedFoods ?? []).map((f, i) => <span className="pref-tag" key={i}>{f}</span>)
                      : <span className="info-value">—</span>}
                  </div>
                </div>

                <div className="info-item" style={{ marginBottom: 16 }}>
                  <span className="info-label">Disliked Foods</span>
                  <div className="tags-display" style={{ marginTop: 8 }}>
                    {(prefs?.dislikedFoods ?? []).length > 0
                      ? (prefs!.dislikedFoods ?? []).map((f, i) => <span className="pref-tag" key={i}>{f}</span>)
                      : <span className="info-value">—</span>}
                  </div>
                </div>

                <div className="info-item">
                  <span className="info-label">Cuisine Preferences</span>
                  <div className="tags-display" style={{ marginTop: 8 }}>
                    {(prefs?.cuisinePreferences ?? []).length > 0
                      ? (prefs!.cuisinePreferences ?? []).map((c, i) => <span className="pref-tag" key={i}>{c}</span>)
                      : <span className="info-value">—</span>}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Diet type */}
                <div className="edit-field" style={{ marginBottom: 20 }}>
                  <label className="edit-label">Diet Type</label>
                  <select className="edit-select" value={prefsDraft.dietType ?? 'NONE'} onChange={(e) => setPrefsDraft({ ...prefsDraft, dietType: e.target.value as DietType })}>
                    {Object.entries(DIET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Allergies */}
                <div className="edit-field" style={{ marginBottom: 20 }}>
                  <label className="edit-label">Allergies</label>
                  <div className="allergy-grid">
                    {ALL_ALLERGIES.map((a) => (
                      <label className="allergy-check" key={a}>
                        <input type="checkbox" checked={prefsDraft.allergies?.includes(a) ?? false} onChange={() => toggleAllergy(a)} />
                        <span className="allergy-box"><i className="fas fa-check" /></span>
                        {a}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Liked foods */}
                <div className="edit-field" style={{ marginBottom: 20 }}>
                  <label className="edit-label">Liked Foods</label>
                  <div className="tags-edit-wrapper">
                    {(prefsDraft.likedFoods ?? []).map((f, i) => (
                      <span className="tag-chip" key={i}>{f}<button onClick={() => removeTag('likedFoods', i)}>×</button></span>
                    ))}
                    <input className="tags-input" placeholder="Type & press Enter" value={likedInput} onChange={(e) => setLikedInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown('likedFoods', likedInput, setLikedInput, e)} />
                  </div>
                </div>

                {/* Disliked foods */}
                <div className="edit-field" style={{ marginBottom: 20 }}>
                  <label className="edit-label">Disliked Foods</label>
                  <div className="tags-edit-wrapper">
                    {(prefsDraft.dislikedFoods ?? []).map((f, i) => (
                      <span className="tag-chip" key={i}>{f}<button onClick={() => removeTag('dislikedFoods', i)}>×</button></span>
                    ))}
                    <input className="tags-input" placeholder="Type & press Enter" value={dislikedInput} onChange={(e) => setDislikedInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown('dislikedFoods', dislikedInput, setDislikedInput, e)} />
                  </div>
                </div>

                {/* Cuisine preferences */}
                <div className="edit-field" style={{ marginBottom: 20 }}>
                  <label className="edit-label">Cuisine Preferences</label>
                  <div className="tags-edit-wrapper">
                    {(prefsDraft.cuisinePreferences ?? []).map((c, i) => (
                      <span className="tag-chip" key={i}>{c}<button onClick={() => removeTag('cuisinePreferences', i)}>×</button></span>
                    ))}
                    <input className="tags-input" placeholder="Type & press Enter" value={cuisineInput} onChange={(e) => setCuisineInput(e.target.value)} onKeyDown={(e) => handleTagKeyDown('cuisinePreferences', cuisineInput, setCuisineInput, e)} />
                  </div>
                </div>

                <div className="profile-btn-row">
                  <button className="profile-btn profile-btn-cancel" onClick={() => { setEditPrefs(false); if (prefs) initPrefsDraft(prefs); }}>Cancel</button>
                  <button className="profile-btn profile-btn-save" disabled={saving} onClick={handleSavePrefs}>
                    {saving ? <><span className="spinner" /> Saving…</> : <><i className="fas fa-check" /> Save</>}
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

