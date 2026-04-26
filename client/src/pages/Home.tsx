import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/home.css';
import NotificationBell from '../components/NotificationBell';
import type {
  UserProfileDto,
  UserPreferenceDto,
  RecipeDto,
  RecipeDetailDto,
  PantryItemDto,
  ActivityLevel,
  CalorieCalculatorResponse,
  DashboardDto,
  WaterTodayResponse,
} from '../api/contracts';
import {
  getProfile,
  getPreferences,
  getRecommendedRecipes,
  getPantryItems,
  calculateCalories,
  getAccessToken,
  clearTokens,
  getDashboard,
  getWaterToday,
  addWaterLog,
  deleteWaterLog,
  getRecipeById,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatActivity(level: ActivityLevel | null): string {
  const map: Record<string, string> = {
    SEDENTARY: 'Sedentary',
    LIGHTLY_ACTIVE: 'Lightly active',
    MODERATELY_ACTIVE: 'Moderately active',
    VERY_ACTIVE: 'Very active',
    EXTRA_ACTIVE: 'Extra active',
  };
  return level ? map[level] ?? level : '—';
}


/** Pick an icon for recipe card based on mealType */
function mealIcon(mealType: string): string {
  switch (mealType) {
    case 'breakfast': return 'fas fa-egg';
    case 'lunch':     return 'fas fa-utensils';
    case 'dinner':    return 'fas fa-fish';
    case 'snack':     return 'fas fa-apple-whole';
    default:          return 'fas fa-utensils';
  }
}

// ── placeholder data (shown while backend has no recipes yet) ──

const PLACEHOLDER_RECIPES = [
  {
    icon: 'fas fa-utensils',
    title: 'Grilled Chicken Salad',
    desc: 'Fresh greens, grilled chicken, avocado, and lemon vinaigrette.',
    time: 20,
    kcal: 420,
  },
  {
    icon: 'fas fa-fish',
    title: 'Salmon with Quinoa',
    desc: 'Baked salmon, quinoa, steamed broccoli.',
    time: 25,
    kcal: 550,
  },
  {
    icon: 'fas fa-egg',
    title: 'Avocado & Egg Toast',
    desc: 'Whole grain toast, smashed avocado, poached egg.',
    time: 10,
    kcal: 380,
  },
];

// ── component ────────────────────────────────

export default function Home() {
  const navigate = useNavigate();

  const [profile, setProfile]       = useState<UserProfileDto | null>(null);
  const [preferences, setPreferences] = useState<UserPreferenceDto | null>(null);
  const [recipes, setRecipes]       = useState<RecipeDto[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItemDto[]>([]);
  const [calorieData, setCalorieData] = useState<CalorieCalculatorResponse | null>(null);
  const [dashboard, setDashboard]   = useState<DashboardDto | null>(null);
  const [water, setWater]           = useState<WaterTodayResponse | null>(null);
  const [addingWater, setAddingWater] = useState(false);
  const [loading, setLoading]       = useState(true);

  // recipe quick-view modal
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipe, setRecipe] = useState<RecipeDetailDto | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // confirm modal for "Reset water"
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  async function openRecipe(id: number) {
    setRecipeOpen(true);
    setRecipeLoading(true);
    setRecipe(null);
    try {
      const res = await getRecipeById(id);
      setRecipe(res.data);
    } catch {
      setRecipeOpen(false);
    } finally {
      setRecipeLoading(false);
    }
  }

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/sign-in', { replace: true });
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, prefsRes, recipesRes, pantryRes, dashRes, waterRes] = await Promise.allSettled([
        getProfile(),
        getPreferences(),
        getRecommendedRecipes(),
        getPantryItems(),
        getDashboard(),
        getWaterToday(),
      ]);

      if (profileRes.status === 'fulfilled')  setProfile(profileRes.value.data);
      if (prefsRes.status === 'fulfilled')    setPreferences(prefsRes.value.data);
      if (recipesRes.status === 'fulfilled')  setRecipes(recipesRes.value.data);
      if (pantryRes.status === 'fulfilled')   setPantryItems(pantryRes.value.data);
      if (dashRes.status === 'fulfilled')     setDashboard(dashRes.value.data);
      if (waterRes.status === 'fulfilled')    setWater(waterRes.value.data);

      // Fetch calorie data from backend if profile has all required fields
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value.data;
        if (p.gender && p.age && p.heightCm && p.weightKg && p.activityLevel && p.goal) {
          try {
            const calorieRes = await calculateCalories({
              gender: p.gender,
              age: p.age,
              heightCm: p.heightCm,
              weightKg: p.weightKg,
              activityLevel: p.activityLevel,
              goal: p.goal,
            });
            setCalorieData(calorieRes.data);
          } catch {
            // calorie calc failed — non-critical
          }
        }
      }
    } catch {
      // show what we can
    } finally {
      setLoading(false);
    }
  }

  /** Refetch authoritative water + dashboard state from the backend. */
  async function refreshWater() {
    try {
      const [w, d] = await Promise.allSettled([getWaterToday(), getDashboard()]);
      if (w.status === 'fulfilled') setWater(w.value.data);
      if (d.status === 'fulfilled') setDashboard(d.value.data);
    } catch { /* noop */ }
  }

  function handleLogout() {
    clearTokens();
    navigate('/sign-in', { replace: true });
  }

  async function handleAddWater(ml: number) {
    if (addingWater) return;
    setAddingWater(true);
    // Optimistic UI bump so the number changes instantly.
    setWater((prev) => {
      const targetMl = prev?.targetMl ?? dashboard?.waterTargetMl ?? 2400;
      const newTotal = (prev?.totalMl ?? 0) + ml;
      return {
        logs: [...(prev?.logs ?? []), { id: -Date.now(), amountMl: ml, loggedAt: new Date().toISOString() }],
        totalMl: newTotal,
        targetMl,
        progressPercent: Math.min(100, (newTotal / Math.max(1, targetMl)) * 100),
      };
    });
    try {
      await addWaterLog({ amountMl: ml });
      await refreshWater();          // reconcile with server (replaces fake id with real one)
    } catch {
      await refreshWater();          // revert on failure
    } finally {
      setAddingWater(false);
    }
  }


  /** Wipe ALL water entries for today.
   *  Backend's /water-logs/today doesn't expose log ids, so we try several
   *  routes a typical Spring backend may have, in order. */
  async function handleResetWater() {
    if (addingWater) return;
    setShowResetConfirm(true);
  }

  async function performResetWater() {
    setShowResetConfirm(false);
    setAddingWater(true);

    const tryFetch = async (url: string, init: RequestInit = {}): Promise<Response | null> => {
      try {
        const token = getAccessToken();
        const r = await fetch(url, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
          },
        });
        return r;
      } catch { return null; }
    };

    const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') + '/api';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // (1) Try a clear-all-today endpoint.
      let r = await tryFetch(`${apiBase}/users/me/water-logs/today`, { method: 'DELETE' });
      if (r && r.ok) {
        await refreshWater();
        return;
      }

      // (2) Try listing logs by date and deleting each.
      r = await tryFetch(`${apiBase}/users/me/water-logs?date=${today}`);
      if (r && r.ok) {
        const body = await r.json().catch(() => null);
        const arr: any[] = Array.isArray(body) ? body : (body?.data ?? body?.logs ?? []);
        const ids = arr.map((l) => l?.id).filter((id) => Number(id) > 0);
        if (ids.length > 0) {
          await Promise.allSettled(ids.map((id) => deleteWaterLog(id)));
          await refreshWater();
          return;
        }
      }

      // (3) Nothing worked.
      // eslint-disable-next-line no-console
      console.warn('Reset: no working endpoint found.');
      alert(
        'Reset is not supported by the backend yet.\n\n' +
        'It needs one of:\n' +
        '  • DELETE /api/users/me/water-logs/today, or\n' +
        '  • GET /api/users/me/water-logs?date=YYYY-MM-DD returning [{id, amountMl, ...}]',
      );
    } finally {
      setAddingWater(false);
    }
  }

  const firstName = profile?.name?.split(' ')[0] ?? '';

  // ── skeleton ──────────────────────────────
  if (loading) {
    return (
      <>
        <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="home-page">
          <div className="home-container">
            <nav className="navbar">
              <div className="logo"><i className="fas fa-leaf" /><span className="logo-text">DIETRIX</span></div>
              <div style={{ flex: 1 }} />
              <div className="skeleton skeleton-text" style={{ width: 120 }} />
            </nav>
            <div style={{ marginTop: 40 }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
            <div className="skeleton skeleton-card" style={{ marginTop: 30 }} />
            <div className="recipe-grid" style={{ marginTop: 40 }}>
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── main render ───────────────────────────
  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="home-page">
        <div className="home-container">

          {/* ═══ Navbar ═══════════════════════ */}
          <nav className="navbar">
            <div className="logo">
              <i className="fas fa-leaf" />
              <span className="logo-text">DIETRIX</span>
            </div>

            <div className="nav-links">
              <a href="/home" className="active">Home</a>
              <Link to="/my-plan">My Plan</Link>
              <Link to="/pantry">Pantry</Link>
              <Link to="/ai-generate">AI Generator</Link>
              <Link to="/chat">Chat</Link>
            </div>

            <div className="user-menu">
              {/* notifications */}
              <NotificationBell />


              {/* logout */}
              <Link to="/settings" className="logout-btn" title="Settings" style={{ textDecoration: 'none' }}>
                <i className="fas fa-gear" />
              </Link>
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <i className="fas fa-sign-out-alt" />
              </button>

              {/* avatar → profile */}
              <a href="/profile" className="user-avatar" title="My Profile">
                {profile?.avatarUrl
                  ? <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : <span>{profile ? getInitials(profile.name) : '?'}</span>}
              </a>
            </div>
          </nav>

          {/* ═══ Welcome ═════════════════════ */}
          <div className="welcome-section">
            <h1 className="welcome-title">
              {(() => {
                const h = new Date().getHours();
                const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
                return <>{greet}, <span>{firstName || 'User'}</span>! 👋</>;
              })()}
            </h1>
            <p className="welcome-subtitle">Here's your wellness snapshot for today</p>
          </div>

          {/* ═══ TODAY widget (V12 dashboard) ═══ */}
          {dashboard && (
            <div className="today-widget">
              {/* Calories */}
              <div className="today-card today-card-calories">
                <div className="today-card-header">
                  <i className="fas fa-fire" />
                  <span>Calories today</span>
                  {dashboard.streakDays > 0 && (
                    <span className="streak-badge">🔥 {dashboard.streakDays} {dashboard.streakDays === 1 ? 'day' : 'days'}</span>
                  )}
                </div>
                <div className="today-card-value">
                  <strong>{dashboard.todayCaloriesConsumed}</strong>
                  <span> / {dashboard.dailyCalorieTarget} kcal</span>
                </div>
                <div className="today-progress">
                  <div
                    className="today-progress-bar"
                    style={{ width: `${Math.min(100, (dashboard.todayCaloriesConsumed / Math.max(1, dashboard.dailyCalorieTarget)) * 100)}%` }}
                  />
                </div>
                <div className="macros-row">
                  {(() => {
                    const p = Math.round(Number(dashboard.todayProtein) || 0);
                    const c = Math.round(Number(dashboard.todayCarbs) || 0);
                    const f = Math.round(Number(dashboard.todayFat) || 0);
                    return (
                      <>
                        <span className="macro"><b>{`${p}g`}</b> P</span>
                        <span className="macro"><b>{`${c}g`}</b> C</span>
                        <span className="macro"><b>{`${f}g`}</b> F</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Water */}
              {(() => {
                const w: any = water;
                const rawTotal  = w?.totalMl  ?? w?.consumedMl ?? dashboard.waterConsumedMl;
                const rawTarget = w?.targetMl ?? dashboard.waterTargetMl;
                const totalMl   = Number.isFinite(Number(rawTotal))  ? Number(rawTotal)  : 0;
                const targetMl  = Number.isFinite(Number(rawTarget)) && Number(rawTarget) > 0
                  ? Number(rawTarget)
                  : 2400;
                const rawPct = w?.progressPercent ?? w?.percent;
                const progressPct = Number.isFinite(Number(rawPct))
                  ? Number(rawPct)
                  : (totalMl / targetMl) * 100;
                return (
                  <div className="today-card today-card-water">
                    <div className="today-card-header">
                      <i className="fas fa-glass-water" />
                      <span>Water</span>
                    </div>
                    <div className="today-card-value">
                      <strong>{(totalMl / 1000).toFixed(2)}</strong>
                      <span> / {(targetMl / 1000).toFixed(1)} L</span>
                    </div>
                    <div className="today-progress">
                      <div
                        className="today-progress-bar today-progress-water"
                        style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                      />
                    </div>
                    <div className="water-buttons">
                      <button onClick={() => handleAddWater(250)} disabled={addingWater}>+250 ml</button>
                      <button onClick={() => handleAddWater(500)} disabled={addingWater}>+500 ml</button>
                      <button onClick={() => handleAddWater(750)} disabled={addingWater}>+750 ml</button>
                      <button
                        onClick={handleResetWater}
                        disabled={addingWater || totalMl <= 0}
                        title="Clear all water for today"
                        style={{ background: 'transparent', color: '#dc2626' }}
                      >
                        <i className="fas fa-trash" /> Reset
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Plan progress */}
              <div className="today-card today-card-plan">
                <div className="today-card-header">
                  <i className="fas fa-calendar-day" />
                  <span>Today's plan</span>
                </div>
                {dashboard.hasMealPlan ? (
                  <>
                    <div className="today-card-value">
                      <strong>{dashboard.mealPlanCompletedMeals}</strong>
                      <span> / {dashboard.mealPlanTotalMeals} meals done</span>
                    </div>
                    <div className="today-progress">
                      <div
                        className="today-progress-bar today-progress-plan"
                        style={{ width: `${dashboard.mealPlanProgressPercent}%` }}
                      />
                    </div>
                    <Link to="/my-plan" className="today-link">View plan →</Link>
                  </>
                ) : (
                  <>
                    <div style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0' }}>
                      No plan for today yet
                    </div>
                    <Link to="/my-plan" className="today-link">Generate plan →</Link>
                  </>
                )}
              </div>

              {/* Weight */}
              {dashboard.currentWeightKg != null && (
                <div className="today-card today-card-weight">
                  <div className="today-card-header">
                    <i className="fas fa-weight-scale" />
                    <span>Current weight</span>
                  </div>
                  <div className="today-card-value">
                    <strong>{dashboard.currentWeightKg.toFixed(1)}</strong>
                    <span> kg</span>
                  </div>
                  <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 8 }}>
                    BMI {dashboard.bmi.toFixed(1)} — {dashboard.bmiCategory}
                  </div>
                  <Link to="/profile" className="today-link">View progress →</Link>
                </div>
              )}
            </div>
          )}

          {/* ═══ Profile summary ═════════════ */}
          {profile && (
            <div className="profile-summary">
              <div className="profile-avatar-lg">
                {profile.avatarUrl
                  ? <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : <i className="fas fa-user" />}
              </div>
              <div className="profile-details">
                <p>
                  <strong>Age:</strong> {profile.age ?? '—'} |{' '}
                  <strong>Height:</strong> {profile.heightCm ? `${profile.heightCm} cm` : '—'} |{' '}
                  <strong>Weight:</strong> {profile.weightKg ? `${profile.weightKg} kg` : '—'}
                </p>
                <p>
                  <strong>Activity:</strong> {formatActivity(profile.activityLevel)} |{' '}
                  <strong>Daily calories:</strong> {calorieData ? `${calorieData.dailyCalories} kcal` : '—'}
                </p>

                {/* ── Macros + BMI + Water (from backend) ── */}
                {calorieData && (
                  <div className="profile-tags">
                    <span className="profile-tag">
                      🔥 {calorieData.dailyCalories} kcal/day
                    </span>
                    <span className="profile-tag">
                      🥩 P: {calorieData.proteinGrams}g ({calorieData.proteinPercent}%)
                    </span>
                    <span className="profile-tag">
                      🍞 C: {calorieData.carbsGrams}g ({calorieData.carbsPercent}%)
                    </span>
                    <span className="profile-tag">
                      🧈 F: {calorieData.fatGrams}g ({calorieData.fatPercent}%)
                    </span>
                    <span className="profile-tag">
                      ⚖️ BMI: {calorieData.bmi.toFixed(1)} — {calorieData.bmiCategory}
                    </span>
                    <span className="profile-tag">
                      💧 Water: {(calorieData.waterMl / 1000).toFixed(1)} L/day
                    </span>
                  </div>
                )}

                {/* ── Food preferences ── */}
                {preferences && (
                  <div className="profile-tags" style={{ marginTop: calorieData ? 8 : 10 }}>
                    {(preferences.likedFoods ?? []).length > 0 && (
                      <span className="profile-tag">
                        ❤️ Loves: {(preferences.likedFoods ?? []).join(', ')}
                      </span>
                    )}
                    <span className="profile-tag">
                      🚫 Allergies: {(preferences.allergies ?? []).length > 0 ? (preferences.allergies ?? []).join(', ') : 'None'}
                    </span>
                    {(preferences.dislikedFoods ?? []).length > 0 && (
                      <span className="profile-tag">
                        😐 Dislikes: {(preferences.dislikedFoods ?? []).join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Recommended recipes ═════════ */}
          <div className="recommendation-section">
            <div className="section-header">
              <h2>Recommended for you</h2>
              <Link to="/ai-generate">View all</Link>
            </div>

            {recipes.length > 0 ? (
              <div className="recipe-grid">
                {recipes.slice(0, 3).map((r) => (
                  <div
                    className="recipe-card"
                    key={r.id}
                    onClick={() => openRecipe(r.id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(r.id); }}
                  >
                    <div className="recipe-icon">
                      <i className={mealIcon(r.mealType)} />
                    </div>
                    <div className="recipe-title">{r.title}</div>
                    <div className="recipe-desc">{r.description}</div>
                    <div className="recipe-meta">
                      <span><i className="fas fa-clock" /> {r.cookTimeMinutes} min</span>
                      <span><i className="fas fa-fire" /> {r.calories} kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="recipe-grid">
                {PLACEHOLDER_RECIPES.map((r, i) => (
                  <div className="recipe-card" key={i}>
                    <div className="recipe-icon"><i className={r.icon} /></div>
                    <div className="recipe-title">{r.title}</div>
                    <div className="recipe-desc">{r.desc}</div>
                    <div className="recipe-meta">
                      <span><i className="fas fa-clock" /> {r.time} min</span>
                      <span><i className="fas fa-fire" /> {r.kcal} kcal</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Quick actions ═══════════════ */}
          <div className="quick-actions">
            <Link to="/my-plan" className="action-card">
              <i className="fas fa-calendar-week" />
              <span>My Plan</span>
            </Link>
            <Link to="/pantry" className="action-card">
              <i className="fas fa-boxes-stacked" />
              <span>Pantry</span>
            </Link>
            <Link to="/chat" className="action-card">
              <i className="fas fa-comment-dots" />
              <span>Chat</span>
            </Link>
            <Link to="/ai-generate" className="action-card">
              <i className="fas fa-robot" />
              <span>AI Generator</span>
            </Link>
          </div>

          {/* ═══ AI Recipe callout ═══════════ */}
          <div className="pantry-callout">
            <div className="callout-text">
              <h3>✨ AI Recipe Generator</h3>
              <p>Tell us what ingredients you have at home, and we'll create a recipe just for you.</p>
            </div>
            <Link to="/ai-generate" className="home-btn home-btn-primary">
              <i className="fas fa-wand-magic-sparkles" /> Try it now
            </Link>
          </div>

          {/* ═══ Pantry section ══════════════ */}
          {pantryItems.length === 0 ? (
            <div className="empty-pantry">
              <i className="fas fa-box-open" />
              <h3>Your pantry is empty</h3>
              <p>Add items to your pantry and let AI suggest meals you can cook right now.</p>
              <Link to="/pantry" className="home-btn home-btn-outline">
                <i className="fas fa-plus" /> Add items
              </Link>
            </div>
          ) : (
            <div className="profile-summary">
              <div className="profile-avatar-lg">
                <i className="fas fa-boxes-stacked" />
              </div>
              <div className="profile-details">
                <p><strong>Your pantry</strong> — {pantryItems.length} item(s)</p>
                <div className="profile-tags">
                  {pantryItems.slice(0, 8).map((item) => (
                    <span className="profile-tag" key={item.id}>
                      {item.name}
                      {item.quantity != null && item.unit ? ` (${item.quantity} ${item.unit})` : ''}
                    </span>
                  ))}
                  {pantryItems.length > 8 && (
                    <span className="profile-tag">+{pantryItems.length - 8} more</span>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ Recipe quick-view modal ═══════ */}
      {recipeOpen && (
        <div className="modal-overlay" onClick={() => setRecipeOpen(false)}>
          <div className="modal-content modal-recipe" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{recipeLoading ? 'Loading…' : recipe?.title ?? 'Recipe'}</h2>
              <button className="modal-close" onClick={() => setRecipeOpen(false)}>
                <i className="fas fa-times" />
              </button>
            </div>

            {recipeLoading ? (
              <div className="generating-overlay" style={{ padding: '30px 0' }}>
                <div className="spinner" />
                <p>Loading recipe…</p>
              </div>
            ) : recipe ? (
              <div className="recipe-detail">
                {recipe.description && (
                  <p className="recipe-detail-desc">{recipe.description}</p>
                )}
                <div className="recipe-macros">
                  <span className="macro-badge macro-cal">
                    <i className="fas fa-fire" /> {recipe.calories} kcal
                  </span>
                  <span className="macro-badge macro-p">
                    <i className="fas fa-drumstick-bite" /> {recipe.protein}g protein
                  </span>
                  <span className="macro-badge macro-c">
                    <i className="fas fa-wheat-awn" /> {recipe.carbs}g carbs
                  </span>
                  <span className="macro-badge macro-f">
                    <i className="fas fa-droplet" /> {recipe.fat}g fat
                  </span>
                  {recipe.cookTimeMinutes > 0 && (
                    <span className="macro-badge">
                      <i className="fas fa-clock" /> {recipe.cookTimeMinutes} min
                    </span>
                  )}
                  {recipe.cuisine && (
                    <span className="macro-badge">
                      <i className="fas fa-earth-americas" /> {recipe.cuisine}
                    </span>
                  )}
                </div>
                {(recipe.ingredients ?? []).length > 0 && (
                  <div className="recipe-section">
                    <h3><i className="fas fa-list" /> Ingredients</h3>
                    <ul className="recipe-ingredients">
                      {recipe.ingredients.map((ing) => (
                        <li key={ing.id}>
                          <span className="ing-name">{ing.name}</span>
                          <span className="ing-amount">{ing.amount} {ing.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {recipe.instructions && (
                  <div className="recipe-section">
                    <h3><i className="fas fa-utensils" /> Instructions</h3>
                    <div className="recipe-instructions">
                      {recipe.instructions.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 20 }}>
                Recipe not found.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Reset water confirmation modal ═════════ */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm reset</h2>
              <button className="modal-close" onClick={() => setShowResetConfirm(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove all water entries for today?</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn" onClick={performResetWater}>
                <i className="fas fa-check" /> Yes, reset
              </button>
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowResetConfirm(false)}>
                <i className="fas fa-times" /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

