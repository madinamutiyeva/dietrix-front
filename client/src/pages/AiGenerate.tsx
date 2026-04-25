import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/aigenerate.css';
import NotificationBell from '../components/NotificationBell';
import type {
  UserProfileDto,
  PantryItemDto,
  RecipeDto,
  RecipeDetailDto,
  Cuisine,
} from '../api/contracts';
import {
  getProfile,
  getAccessToken,
  clearTokens,
  getPantryItems,
  generateRecipe,
  getRecipeById,
  getRecentGeneratedRecipes,
  getCurrentMealPlan,
  generateMealPlan,
  addMealToPlan,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const CUISINES: { value: Cuisine | ''; label: string }[] = [
  { value: '', label: 'Any cuisine' },
  { value: 'ITALIAN', label: 'Italian' },
  { value: 'JAPANESE', label: 'Japanese' },
  { value: 'MEXICAN', label: 'Mexican' },
  { value: 'INDIAN', label: 'Indian' },
  { value: 'KOREAN', label: 'Korean' },
  { value: 'FRENCH', label: 'French' },
  { value: 'TURKISH', label: 'Turkish' },
  { value: 'AMERICAN', label: 'American' },
  { value: 'KAZAKH', label: 'Kazakh' },
  { value: 'RUSSIAN', label: 'Russian' },
  { value: 'THAI', label: 'Thai' },
  { value: 'CHINESE', label: 'Chinese' },
  { value: 'GEORGIAN', label: 'Georgian' },
  { value: 'UZBEK', label: 'Uzbek' },
  { value: 'GREEK', label: 'Greek' },
  { value: 'SPANISH', label: 'Spanish' },
  { value: 'INTERNATIONAL', label: 'International' },
];

const MEAL_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Any type' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'main', label: 'Main course' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
];

function mealIcon(mealType: string): string {
  switch (mealType?.toLowerCase()) {
    case 'breakfast': return 'fas fa-egg';
    case 'main':      return 'fas fa-utensils';
    case 'snack':     return 'fas fa-apple-whole';
    case 'dessert':   return 'fas fa-cake-candles';
    default:          return 'fas fa-utensils';
  }
}

function pantryIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('chicken') || n.includes('turkey') || n.includes('beef'))  return 'fas fa-drumstick-bite';
  if (n.includes('fish') || n.includes('salmon') || n.includes('tuna'))     return 'fas fa-fish';
  if (n.includes('egg'))   return 'fas fa-egg';
  if (n.includes('milk') || n.includes('yogurt') || n.includes('cream'))    return 'fas fa-glass-water';
  if (n.includes('cheese')) return 'fas fa-cheese';
  if (n.includes('apple'))  return 'fas fa-apple-whole';
  if (n.includes('carrot')) return 'fas fa-carrot';
  if (n.includes('lemon'))  return 'fas fa-lemon';
  if (n.includes('pepper')) return 'fas fa-pepper-hot';
  if (n.includes('rice'))   return 'fas fa-bowl-rice';
  if (n.includes('bread') || n.includes('flour')) return 'fas fa-bread-slice';
  return 'fas fa-seedling';
}

// ── component ────────────────────────────────

export default function AiGenerate() {
  const navigate = useNavigate();

  // data
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItemDto[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<RecipeDto[]>([]);
  const [generatedRecipes, setGeneratedRecipes] = useState<RecipeDetailDto[]>([]);

  // form
  const [cuisine, setCuisine] = useState('');
  const [mealType, setMealType] = useState('');
  const [maxCalories, setMaxCalories] = useState('');
  const [usePantry, setUsePantry] = useState(true);
  const [notes, setNotes] = useState('');

  // ui
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [viewRecipe, setViewRecipe] = useState<RecipeDetailDto | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // V12 — Add to today's plan
  const [addToPlanRecipe, setAddToPlanRecipe] = useState<RecipeDetailDto | null>(null);
  const [addPlanMealType, setAddPlanMealType] = useState<'BREAKFAST' | 'MAIN' | 'SNACK' | 'DESSERT'>('SNACK');
  const [addingToPlan, setAddingToPlan] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function openAddToPlan(r: RecipeDetailDto) {
    // pre-select meal type from recipe.mealType if it matches
    const mt = (r.mealType || '').toUpperCase();
    if (mt === 'BREAKFAST' || mt === 'MAIN' || mt === 'SNACK' || mt === 'DESSERT') {
      setAddPlanMealType(mt as any);
    } else {
      setAddPlanMealType('SNACK');
    }
    setAddToPlanRecipe(r);
  }

  async function handleAddToPlan() {
    if (!addToPlanRecipe) return;
    setAddingToPlan(true);
    try {
      // 1. ensure today's plan exists
      let planId: number | null = null;
      try {
        const cur = await getCurrentMealPlan();
        const today = new Date();
        const todayISO =
          `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (cur.data && cur.data.date === todayISO) {
          planId = cur.data.id;
        }
      } catch { /* no current plan */ }

      // 2. if no plan today → generate one (empty/quick)
      if (!planId) {
        const gen = await generateMealPlan({ usePantry: false });
        planId = gen.data.id;
      }

      // 3. add recipe to plan
      await addMealToPlan(planId, addToPlanRecipe.id, addPlanMealType);

      showToast(`Added "${addToPlanRecipe.title}" to today's plan`);
      setAddToPlanRecipe(null);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to add to plan', 'err');
    } finally {
      setAddingToPlan(false);
    }
  }

  useEffect(() => {
    if (!getAccessToken()) { navigate('/sign-in', { replace: true }); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, pantryRes, recentRes] = await Promise.allSettled([
        getProfile(),
        getPantryItems(),
        getRecentGeneratedRecipes(),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (pantryRes.status === 'fulfilled') setPantryItems(pantryRes.value.data);
      if (recentRes.status === 'fulfilled') setRecentRecipes(recentRes.value.data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await generateRecipe({
        mealType: mealType || undefined,
        cuisine: cuisine || undefined,
        maxCalories: maxCalories ? Number(maxCalories) : undefined,
        usePantry,
        additionalNotes: notes || undefined,
      });
      setGeneratedRecipes((prev) => [res.data, ...prev]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Generation failed. Please try again.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleViewRecipe(recipeId: number) {
    // check if already in generated list (full detail)
    const existing = generatedRecipes.find((r) => r.id === recipeId);
    if (existing && existing.instructions) {
      setViewRecipe(existing);
      return;
    }
    setViewLoading(true);
    try {
      const res = await getRecipeById(recipeId);
      setViewRecipe(res.data);
    } catch {
      setError('Failed to load recipe details');
    } finally {
      setViewLoading(false);
    }
  }

  function handleLogout() {
    clearTokens();
    navigate('/sign-in', { replace: true });
  }

  // ── skeleton ──────────────────────────────
  if (loading) {
    return (
      <>
        <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="aigen-page">
          <nav className="navbar">
            <div className="logo"><i className="fas fa-leaf" /><span className="logo-text">DIETRIX</span></div>
            <div style={{ flex: 1 }} />
            <div className="skeleton skeleton-text" style={{ width: 120 }} />
          </nav>
          <div style={{ marginTop: 40 }}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
          <div className="skeleton skeleton-card" style={{ marginTop: 30, height: 200 }} />
        </div>
      </>
    );
  }

  // ── main render ───────────────────────────
  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="aigen-page">

        {/* ═══ Navbar ═══════════════════════ */}
        <nav className="navbar">
          <Link to="/home" className="logo">
            <i className="fas fa-leaf" />
            <span className="logo-text">DIETRIX</span>
          </Link>

          <div className="nav-links">
            <Link to="/home">Home</Link>
            <Link to="/my-plan">My Plan</Link>
            <Link to="/pantry">Pantry</Link>
            <Link to="/ai-generate" className="active">AI Generator</Link>
            <Link to="/chat">Chat</Link>
          </div>

          <div className="user-menu">
            <NotificationBell />


            <Link to="/settings" className="logout-btn" title="Settings" style={{ textDecoration: 'none' }}>
              <i className="fas fa-gear" />
            </Link>
            <button className="logout-btn" onClick={handleLogout} title="Sign out">
              <i className="fas fa-sign-out-alt" />
            </button>

            <Link to="/profile" className="user-avatar" title="My Profile">
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : <span>{profile ? getInitials(profile.name) : '?'}</span>}
            </Link>
          </div>
        </nav>

        {/* ═══ Page header ═══════════════════ */}
        <div className="page-header">
          <h1 className="page-title">
            <i className="fas fa-robot" />
            AI Recipe Generator
          </h1>
          <p className="page-subtitle">Get personalized recipe ideas based on your preferences and pantry</p>
        </div>

        {/* ═══ Pantry products ═══════════════ */}
        {pantryItems.length > 0 && (
          <div className="aigen-products">
            <div className="section-header">
              <h2><i className="fas fa-boxes-stacked" /> Products in your pantry</h2>
              <Link to="/pantry" className="edit-link">
                <i className="fas fa-pencil-alt" /> Edit pantry
              </Link>
            </div>
            <div className="product-tags">
              {pantryItems.slice(0, 12).map((item) => (
                <span className="product-tag" key={item.id}>
                  <i className={pantryIcon(item.name)} />
                  {item.name}
                  {item.quantity != null && item.unit ? ` (${item.quantity} ${item.unit})` : ''}
                </span>
              ))}
              {pantryItems.length > 12 && (
                <span className="product-tag" style={{ background: '#f1f5f9', color: 'var(--text-gray)' }}>
                  +{pantryItems.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* ═══ Generation controls ═══════════ */}
        <div className="aigen-controls">
          <div className="aigen-controls-row">
            <div className="aigen-field">
              <label><i className="fas fa-globe-americas" /> Cuisine</label>
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                {CUISINES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="aigen-field">
              <label><i className="fas fa-utensils" /> Meal type</label>
              <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="aigen-field">
              <label><i className="fas fa-fire" /> Max calories</label>
              <input
                type="text"
                placeholder="e.g. 600"
                value={maxCalories}
                onChange={(e) => setMaxCalories(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="aigen-field">
              <label><i className="fas fa-comment" /> Additional notes</label>
              <input
                type="text"
                placeholder="e.g. something light, no dairy"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="aigen-checkbox" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              id="usePantry"
              checked={usePantry}
              onChange={(e) => setUsePantry(e.target.checked)}
            />
            <label htmlFor="usePantry">
              <i className="fas fa-boxes-stacked" style={{ color: 'var(--primary)', marginRight: 4 }} />
              Use products from my pantry ({pantryItems.length} items)
            </label>
          </div>
        </div>

        {/* ═══ Generate button ═══════════════ */}
        <div className="generate-section">
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <div className="spinner" />
                Generating…
              </>
            ) : (
              <>
                <i className="fas fa-wand-magic-sparkles" />
                Generate Recipe
              </>
            )}
          </button>
        </div>

        {/* ═══ Error ═════════════════════════ */}
        {error && (
          <div className="aigen-error">
            <i className="fas fa-exclamation-triangle" />
            {error}
            <button
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}
              onClick={() => setError('')}
            >
              ✕
            </button>
          </div>
        )}

        {/* ═══ Generated results ═════════════ */}
        {generatedRecipes.length > 0 ? (
          <div className="results-section">
            <div className="results-header">
              <h3>🧑‍🍳 Generated Recipes</h3>
              <span className="results-count">{generatedRecipes.length} recipe(s)</span>
            </div>

            <div className="recipes-grid">
              {generatedRecipes.map((recipe) => (
                <div className="recipe-card" key={recipe.id}>
                  {recipe.cuisine && (
                    <span className="recipe-badge">{recipe.cuisine}</span>
                  )}
                  <div className="recipe-icon-lg">
                    <i className={mealIcon(recipe.mealType)} />
                  </div>
                  <h4 className="recipe-name">{recipe.title}</h4>
                  <p className="recipe-desc">{recipe.description}</p>

                  {recipe.ingredients && recipe.ingredients.length > 0 && (
                    <div className="recipe-ingredients-box">
                      {recipe.ingredients.slice(0, 5).map((ing) => {
                        const inPantry = pantryItems.some(
                          (p) => p.name.toLowerCase().includes(ing.name.toLowerCase()) ||
                                 ing.name.toLowerCase().includes(p.name.toLowerCase()),
                        );
                        return (
                          <div className="ingredient-item" key={ing.id}>
                            <span className={inPantry ? 'used' : 'missing'}>
                              {inPantry ? '✓' : '✗'} {ing.name}
                            </span>
                            <span>{ing.amount} {ing.unit}</span>
                          </div>
                        );
                      })}
                      {recipe.ingredients.length > 5 && (
                        <div className="ingredient-item" style={{ color: 'var(--text-gray)', fontStyle: 'italic' }}>
                          <span>+{recipe.ingredients.length - 5} more…</span>
                          <span />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="recipe-meta-row">
                    <span className="meta-item"><i className="fas fa-clock" /> {recipe.cookTimeMinutes} min</span>
                    <span className="meta-item"><i className="fas fa-fire" /> {recipe.calories} kcal</span>
                    {recipe.protein != null && (
                      <span className="meta-item"><i className="fas fa-dumbbell" /> {recipe.protein}g protein</span>
                    )}
                  </div>

                  <div className="recipe-footer">
                    {recipe.mealType && (
                      <span className="recipe-cuisine-tag">
                        {recipe.mealType.charAt(0).toUpperCase() + recipe.mealType.slice(1).toLowerCase()}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="recipe-btn" onClick={() => handleViewRecipe(recipe.id)}>
                        <i className="fas fa-eye" style={{ marginRight: 6 }} />View
                      </button>
                      <button
                        className="recipe-btn"
                        onClick={() => openAddToPlan(recipe)}
                        title="Add to today's plan"
                        style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }}
                      >
                        <i className="fas fa-calendar-plus" style={{ marginRight: 6 }} />Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !generating ? (
          <div className="aigen-empty">
            <i className="fas fa-wand-magic-sparkles" />
            <h3>No recipes generated yet</h3>
            <p>Choose your preferences above and click "Generate Recipe" to get a personalized recipe powered by AI.</p>
          </div>
        ) : null}

        {/* ═══ Recent generated ══════════════ */}
        {recentRecipes.length > 0 && generatedRecipes.length === 0 && (
          <div className="aigen-recent">
            <h3><i className="fas fa-history" /> Recently Generated</h3>
            <div className="recipes-grid">
              {recentRecipes.slice(0, 6).map((recipe) => (
                <div className="recipe-card" key={recipe.id}>
                  {recipe.cuisine && <span className="recipe-badge">{recipe.cuisine}</span>}
                  <div className="recipe-icon-lg">
                    <i className={mealIcon(recipe.mealType)} />
                  </div>
                  <h4 className="recipe-name">{recipe.title}</h4>
                  <p className="recipe-desc">{recipe.description}</p>
                  <div className="recipe-meta-row">
                    <span className="meta-item"><i className="fas fa-clock" /> {recipe.cookTimeMinutes} min</span>
                    <span className="meta-item"><i className="fas fa-fire" /> {recipe.calories} kcal</span>
                  </div>
                  <div className="recipe-footer">
                    {recipe.mealType && (
                      <span className="recipe-cuisine-tag">
                        {recipe.mealType.charAt(0).toUpperCase() + recipe.mealType.slice(1).toLowerCase()}
                      </span>
                    )}
                    <button className="recipe-btn" onClick={() => handleViewRecipe(recipe.id)}>
                      <i className="fas fa-eye" style={{ marginRight: 6 }} />View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Quick links ═══════════════════ */}
        <div className="aigen-quick-links">
          <Link to="/pantry">
            <i className="fas fa-boxes-stacked" /> Update Pantry
          </Link>
          <Link to="/my-plan">
            <i className="fas fa-calendar-day" /> My Plan
          </Link>
          <Link to="/home">
            <i className="fas fa-home" /> Dashboard
          </Link>
        </div>
      </div>

      {/* ═══ Recipe detail modal ═════════════ */}
      {(viewRecipe || viewLoading) && (
        <div className="recipe-modal-overlay" onClick={() => { if (!viewLoading) setViewRecipe(null); }}>
          <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
            <button className="recipe-modal-close" onClick={() => setViewRecipe(null)}>✕</button>

            {viewLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 4, borderColor: 'var(--primary-light)', borderTopColor: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-soft)' }}>Loading recipe…</p>
              </div>
            ) : viewRecipe && (
              <>
                <h2>{viewRecipe.title}</h2>
                {viewRecipe.cuisine && <span className="modal-cuisine">{viewRecipe.cuisine}</span>}
                <p className="modal-desc">{viewRecipe.description}</p>

                <div className="modal-macros">
                  <span className="modal-macro-tag"><i className="fas fa-fire" /> {viewRecipe.calories} kcal</span>
                  <span className="modal-macro-tag"><i className="fas fa-dumbbell" /> P: {viewRecipe.protein}g</span>
                  <span className="modal-macro-tag"><i className="fas fa-bread-slice" /> C: {viewRecipe.carbs}g</span>
                  <span className="modal-macro-tag"><i className="fas fa-droplet" /> F: {viewRecipe.fat}g</span>
                  <span className="modal-macro-tag"><i className="fas fa-clock" /> {viewRecipe.cookTimeMinutes} min</span>
                </div>

                {viewRecipe.ingredients && viewRecipe.ingredients.length > 0 && (
                  <>
                    <h3><i className="fas fa-list" /> Ingredients</h3>
                    <ul className="modal-ingredients-list">
                      {viewRecipe.ingredients.map((ing) => {
                        const inPantry = pantryItems.some(
                          (p) => p.name.toLowerCase().includes(ing.name.toLowerCase()) ||
                                 ing.name.toLowerCase().includes(p.name.toLowerCase()),
                        );
                        return (
                          <li key={ing.id}>
                            <span style={{ color: inPantry ? 'var(--primary)' : 'var(--text-dark)', fontWeight: inPantry ? 600 : 400 }}>
                              {inPantry ? '✓ ' : ''}{ing.name}
                            </span>
                            <span style={{ color: 'var(--text-gray)' }}>{ing.amount} {ing.unit}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {viewRecipe.instructions && (
                  <>
                    <h3><i className="fas fa-book-open" /> Instructions</h3>
                    <div className="modal-instructions">{viewRecipe.instructions}</div>
                  </>
                )}

                {/* V12 — Add to today's plan */}
                <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    className="generate-btn"
                    onClick={() => {
                      const r = viewRecipe;
                      setViewRecipe(null);
                      if (r) openAddToPlan(r);
                    }}
                  >
                    <i className="fas fa-calendar-plus" /> Add to today's plan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Add-to-plan modal (meal-type chooser) ═══ */}
      {addToPlanRecipe && (
        <div className="recipe-modal-overlay" onClick={() => !addingToPlan && setAddToPlanRecipe(null)}>
          <div className="recipe-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <button className="modal-close" onClick={() => setAddToPlanRecipe(null)} disabled={addingToPlan}>
              <i className="fas fa-times" />
            </button>
            <h2 style={{ marginBottom: 8 }}>Add to today's plan</h2>
            <p className="modal-desc" style={{ marginBottom: 18 }}>
              <strong>{addToPlanRecipe.title}</strong> — {addToPlanRecipe.calories} kcal
            </p>

            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Meal slot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 22 }}>
              {([
                { v: 'BREAKFAST', label: '🍳 Breakfast' },
                { v: 'MAIN',      label: '🍽 Main course' },
                { v: 'SNACK',     label: '🥨 Snack' },
                { v: 'DESSERT',   label: '🍰 Dessert' },
              ] as const).map((m) => (
                <button
                  key={m.v}
                  onClick={() => setAddPlanMealType(m.v)}
                  className={`cuisine-pill ${addPlanMealType === m.v ? 'active' : ''}`}
                  style={{ width: '100%' }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAddToPlanRecipe(null)}
                disabled={addingToPlan}
                className="cuisine-pill"
              >
                Cancel
              </button>
              <button
                className="generate-btn"
                onClick={handleAddToPlan}
                disabled={addingToPlan}
              >
                {addingToPlan ? (
                  <><i className="fas fa-spinner fa-spin" /> Adding…</>
                ) : (
                  <><i className="fas fa-calendar-plus" /> Add to plan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: 30,
            background: toast.type === 'ok' ? 'var(--primary)' : '#dc2626',
            color: 'white',
            fontWeight: 600,
            fontSize: 14,
            zIndex: 2000,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}
        >
          {toast.type === 'ok' ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}
    </>
  );
}

