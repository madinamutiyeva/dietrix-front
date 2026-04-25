import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/pantry.css';
import NotificationBell from '../components/NotificationBell';
import type { UserProfileDto, PantryItemDto, AddPantryItemRequest } from '../api/contracts';
import {
  getProfile,
  getAccessToken,
  clearTokens,
  getPantryItems,
  addPantryItem,
  deletePantryItem,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── predefined product catalog ───────────────

interface CatalogProduct {
  name: string;
  category: string;
  icon: string;
}

const CATALOG: CatalogProduct[] = [
  // Fruits & Vegetables
  { name: 'Apples',       category: 'Fruits & Vegetables', icon: 'fas fa-apple-whole' },
  { name: 'Bananas',      category: 'Fruits & Vegetables', icon: 'fas fa-seedling' },
  { name: 'Carrots',      category: 'Fruits & Vegetables', icon: 'fas fa-carrot' },
  { name: 'Spinach',      category: 'Fruits & Vegetables', icon: 'fas fa-leaf' },
  { name: 'Bell Peppers',  category: 'Fruits & Vegetables', icon: 'fas fa-pepper-hot' },
  { name: 'Broccoli',     category: 'Fruits & Vegetables', icon: 'fas fa-seedling' },
  { name: 'Tomatoes',     category: 'Fruits & Vegetables', icon: 'fas fa-apple-whole' },
  { name: 'Lemons',       category: 'Fruits & Vegetables', icon: 'fas fa-lemon' },
  { name: 'Onions',       category: 'Fruits & Vegetables', icon: 'fas fa-circle' },
  { name: 'Potatoes',     category: 'Fruits & Vegetables', icon: 'fas fa-cube' },
  { name: 'Garlic',       category: 'Fruits & Vegetables', icon: 'fas fa-seedling' },
  { name: 'Cucumbers',    category: 'Fruits & Vegetables', icon: 'fas fa-leaf' },

  // Meat & Fish
  { name: 'Chicken',      category: 'Meat & Fish', icon: 'fas fa-drumstick-bite' },
  { name: 'Ground Beef',  category: 'Meat & Fish', icon: 'fas fa-cow' },
  { name: 'Salmon',       category: 'Meat & Fish', icon: 'fas fa-fish' },
  { name: 'Shrimp',       category: 'Meat & Fish', icon: 'fas fa-shrimp' },
  { name: 'Turkey',       category: 'Meat & Fish', icon: 'fas fa-drumstick-bite' },
  { name: 'Tuna',         category: 'Meat & Fish', icon: 'fas fa-fish' },

  // Dairy & Eggs
  { name: 'Eggs',         category: 'Dairy & Eggs', icon: 'fas fa-egg' },
  { name: 'Milk',         category: 'Dairy & Eggs', icon: 'fas fa-glass-water' },
  { name: 'Cheese',       category: 'Dairy & Eggs', icon: 'fas fa-cheese' },
  { name: 'Yogurt',       category: 'Dairy & Eggs', icon: 'fas fa-glass-water' },
  { name: 'Butter',       category: 'Dairy & Eggs', icon: 'fas fa-cube' },
  { name: 'Cream',        category: 'Dairy & Eggs', icon: 'fas fa-glass-water' },

  // Grains
  { name: 'Rice',         category: 'Grains', icon: 'fas fa-bowl-rice' },
  { name: 'Pasta',        category: 'Grains', icon: 'fas fa-wheat-awn' },
  { name: 'Oats',         category: 'Grains', icon: 'fas fa-bread-slice' },
  { name: 'Quinoa',       category: 'Grains', icon: 'fas fa-seedling' },
  { name: 'Bread',        category: 'Grains', icon: 'fas fa-bread-slice' },
  { name: 'Flour',        category: 'Grains', icon: 'fas fa-wheat-awn' },
  { name: 'Buckwheat',    category: 'Grains', icon: 'fas fa-seedling' },

  // Spices & Sauces
  { name: 'Olive Oil',    category: 'Spices & Sauces', icon: 'fas fa-bottle-droplet' },
  { name: 'Soy Sauce',    category: 'Spices & Sauces', icon: 'fas fa-bottle-droplet' },
  { name: 'Salt',         category: 'Spices & Sauces', icon: 'fas fa-jar' },
  { name: 'Black Pepper', category: 'Spices & Sauces', icon: 'fas fa-mortar-pestle' },
  { name: 'Honey',        category: 'Spices & Sauces', icon: 'fas fa-jar' },
  { name: 'Vinegar',      category: 'Spices & Sauces', icon: 'fas fa-bottle-droplet' },

  // Canned Goods
  { name: 'Canned Beans', category: 'Canned Goods', icon: 'fas fa-jar' },
  { name: 'Canned Tomatoes', category: 'Canned Goods', icon: 'fas fa-jar' },
  { name: 'Coconut Milk', category: 'Canned Goods', icon: 'fas fa-jar' },
  { name: 'Chickpeas',    category: 'Canned Goods', icon: 'fas fa-jar' },
  { name: 'Corn',         category: 'Canned Goods', icon: 'fas fa-jar' },
];

const CATEGORIES = ['All', ...Array.from(new Set(CATALOG.map((p) => p.category)))];

// ── component ────────────────────────────────

export default function Pantry() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // names of catalog products being toggled right now (prevent double-click)
  const [togglingNames, setTogglingNames] = useState<Set<string>>(new Set());

  // filters
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // V12 — custom product form
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customSaving, setCustomSaving] = useState(false);

  // helper: lower-cased set of names currently in pantry (recomputed each render)
  const existingNames = new Set(pantryItems.map((i) => i.name.toLowerCase()));

  function flashSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2200);
  }

  async function handleAddCustom() {
    const name = customName.trim();
    if (!name) {
      setError('Please enter product name');
      return;
    }
    setCustomSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const req: AddPantryItemRequest = { name };
      const qty = parseFloat(customQty);
      if (!isNaN(qty) && qty > 0) req.quantity = qty;
      if (customUnit.trim()) req.unit = customUnit.trim();
      if (customCategory.trim()) req.category = customCategory.trim();

      const res = await addPantryItem(req);
      setPantryItems((prev) => [...prev, res.data]);
      flashSuccess(`Added "${name}" to your pantry`);

      // reset form
      setCustomName('');
      setCustomQty('');
      setCustomUnit('');
      setCustomCategory('');
      setShowCustom(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add product');
    } finally {
      setCustomSaving(false);
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
      const [profileRes, pantryRes] = await Promise.allSettled([
        getProfile(),
        getPantryItems(),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (pantryRes.status === 'fulfilled') {
        setPantryItems(pantryRes.value.data ?? []);
      }
    } catch {
      // show what we can
    } finally {
      setLoading(false);
    }
  }

  /**
   * Click on a catalog product card → instantly add it to pantry, or remove
   * the matching pantry item if it's already there.
   */
  async function toggleProduct(p: CatalogProduct) {
    if (togglingNames.has(p.name)) return;

    setError('');
    setTogglingNames((prev) => new Set(prev).add(p.name));

    try {
      const existing = pantryItems.find(
        (i) => i.name.toLowerCase() === p.name.toLowerCase(),
      );

      if (existing) {
        // remove
        await deletePantryItem(existing.id);
        setPantryItems((prev) => prev.filter((i) => i.id !== existing.id));
        flashSuccess(`Removed "${p.name}"`);
      } else {
        // add
        const res = await addPantryItem({ name: p.name, category: p.category });
        setPantryItems((prev) => [...prev, res.data]);
        flashSuccess(`Added "${p.name}"`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || `Failed to update "${p.name}"`);
    } finally {
      setTogglingNames((prev) => {
        const next = new Set(prev);
        next.delete(p.name);
        return next;
      });
    }
  }

  async function handleRemoveItem(item: PantryItemDto) {
    setError('');
    try {
      await deletePantryItem(item.id);
      setPantryItems((prev) => prev.filter((i) => i.id !== item.id));
      flashSuccess(`Removed "${item.name}"`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove item.');
    }
  }

  function handleLogout() {
    clearTokens();
    navigate('/sign-in', { replace: true });
  }

  // ── filtered catalog ──────────────────────
  const filteredCatalog = CATALOG.filter((p) => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });


  // ── loading ───────────────────────────────
  if (loading) {
    return (
      <>
        <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="pantry-page">
          <div className="pantry-container">
            <nav className="navbar">
              <Link to="/home" className="logo"><i className="fas fa-leaf" /><span className="logo-text">DIETRIX</span></Link>
              <div style={{ flex: 1 }} />
              <div className="skeleton skeleton-text" style={{ width: 120 }} />
            </nav>
            <div style={{ marginTop: 40 }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
            <div className="skeleton skeleton-card" style={{ marginTop: 30, height: 50 }} />
            <div className="products-grid" style={{ marginTop: 25 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card" style={{ height: 140 }} />
              ))}
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

      <div className="pantry-page">
        <div className="pantry-container">

          {/* ═══ Navbar ═══════════════════════ */}
          <nav className="navbar">
            <Link to="/home" className="logo">
              <i className="fas fa-leaf" />
              <span className="logo-text">DIETRIX</span>
            </Link>

            <div className="nav-links">
              <Link to="/home">Home</Link>
              <Link to="/my-plan">My Plan</Link>
              <Link to="/pantry" className="active">Pantry</Link>
              <Link to="/ai-generate">AI Generator</Link>
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
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span>{profile ? getInitials(profile.name) : '?'}</span>
                )}
              </Link>
            </div>
          </nav>

          {/* ═══ Header ══════════════════════ */}
          <div className="page-header">
            <h1 className="page-title">My Pantry</h1>
            <p className="page-subtitle">Select the products you have at home</p>
          </div>

          {/* ═══ Messages ════════════════════ */}
          {error && (
            <div className="error-banner">
              <i className="fas fa-exclamation-circle" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="calorie-warning warning-info" style={{ marginBottom: 20 }}>
              <span className="warning-icon">✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* ═══ Custom product (V12) ═══════ */}
          <div className="custom-product-section">
            <button
              className="custom-product-toggle"
              onClick={() => setShowCustom((v) => !v)}
            >
              <i className={`fas ${showCustom ? 'fa-minus' : 'fa-plus'}`} />
              {showCustom ? ' Cancel' : ' Add custom product'}
            </button>

            {showCustom && (
              <div className="custom-product-form">
                <div className="custom-row">
                  <div className="custom-field custom-field-wide">
                    <label>Product name <span className="req">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Olive oil"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
                      autoFocus
                    />
                  </div>
                  <div className="custom-field">
                    <label>Quantity</label>
                    <input
                      type="number"
                      placeholder="500"
                      min={0}
                      step="any"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                    />
                  </div>
                  <div className="custom-field">
                    <label>Unit</label>
                    <input
                      type="text"
                      placeholder="ml, g, pcs"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      list="unit-suggestions"
                    />
                    <datalist id="unit-suggestions">
                      <option value="g" />
                      <option value="kg" />
                      <option value="ml" />
                      <option value="L" />
                      <option value="pcs" />
                      <option value="pack" />
                      <option value="tbsp" />
                      <option value="tsp" />
                      <option value="cup" />
                    </datalist>
                  </div>
                </div>

                <div className="custom-row">
                  <div className="custom-field">
                    <label>Category</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    >
                      <option value="">— Choose —</option>
                      {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="custom-field custom-field-action">
                    <button
                      className="pantry-btn pantry-btn-primary custom-add-btn"
                      onClick={handleAddCustom}
                      disabled={customSaving || !customName.trim()}
                    >
                      {customSaving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
                      {' '}Add to pantry
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ My items (from API) ═════════ */}
          {pantryItems.length > 0 && (
            <div className="my-items-section">
              <div className="my-items-header">
                <h2>Your items</h2>
                <span className="item-count">{pantryItems.length} item(s)</span>
              </div>
              <div className="my-items-grid">
                {pantryItems.map((item) => (
                  <span key={item.id} className="my-item-tag">
                    <i className="fas fa-check-circle item-icon" />
                    {item.name}
                    {item.quantity != null && item.unit ? ` (${item.quantity} ${item.unit})` : ''}
                    <button className="my-item-remove" onClick={() => handleRemoveItem(item)} title="Remove">
                      <i className="fas fa-times" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Search ══════════════════════ */}
          <div className="pantry-search">
            <div className="search-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search for products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ═══ Categories ══════════════════ */}
          <div className="pantry-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`cat-btn${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* ═══ Products grid ═══════════════ */}
          {filteredCatalog.length > 0 ? (
            <div className="products-grid">
              {filteredCatalog.map((p) => {
                const isInPantry = existingNames.has(p.name.toLowerCase());
                const isToggling = togglingNames.has(p.name);
                return (
                  <div
                    key={p.name}
                    className={`product-card${isInPantry ? ' selected' : ''}${isToggling ? ' toggling' : ''}`}
                    onClick={() => toggleProduct(p)}
                  >
                    <div className="product-icon">
                      <i className={p.icon} />
                    </div>
                    <div className="product-name">{p.name}</div>
                    <div className="product-category">{p.category}</div>
                    <div className="product-check">
                      {isToggling ? (
                        <i className="fas fa-spinner fa-spin" />
                      ) : (
                        <i className={isInPantry ? 'fas fa-check' : 'fas fa-plus'} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pantry-empty">
              <i className="fas fa-search" />
              <p>No products match your search.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

