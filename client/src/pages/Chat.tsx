import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/chat.css';
import NotificationBell from '../components/NotificationBell';
import type { UserProfileDto, FaqItemDto } from '../api/contracts';
import {
  getProfile,
  getAccessToken,
  clearTokens,
  chatWithAssistant,
  getFaq,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

interface ChatMsg {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: string;
  error?: boolean;
}

interface Article {
  icon: string;
  title: string;
  readTime: string;
  category: string;
  intro: string;
  sections: { heading: string; body: string }[];
  takeaway: string;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: '',          label: 'All' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'diet',      label: 'Diet' },
  { value: 'recipes',   label: 'Recipes' },
  { value: 'general',   label: 'General' },
];

const POPULAR_TOPICS: { icon: string; text: string; article: Article }[] = [
  {
    icon: 'fas fa-dumbbell',
    text: 'How much protein do I need?',
    article: {
      icon: 'fas fa-dumbbell',
      title: 'How much protein do I really need?',
      readTime: '4 min read',
      category: 'Nutrition',
      intro:
        'Protein is the building block of muscles, enzymes and hormones. Your daily need depends on body weight, activity level and goal.',
      sections: [
        {
          heading: '🧮 General formula',
          body:
            'Sedentary adults: 0.8 g per kg of body weight.\nActive adults: 1.2–1.6 g/kg.\nStrength athletes / muscle gain: 1.6–2.2 g/kg.\nWeight loss (to preserve muscle): 1.6–2.4 g/kg.',
        },
        {
          heading: '🥩 Best sources',
          body:
            '• Chicken breast — 31 g per 100 g\n• Salmon — 25 g per 100 g\n• Eggs — 6 g each\n• Greek yogurt — 10 g per 100 g\n• Lentils — 9 g per 100 g\n• Cottage cheese — 11 g per 100 g',
        },
        {
          heading: '⏰ Timing',
          body:
            'Spread protein across 3–4 meals (~25–40 g each). This maximises muscle protein synthesis throughout the day.',
        },
      ],
      takeaway:
        'A 70 kg active adult should aim for ~110–150 g protein per day, split across 3–4 meals. Hit your goal consistently — it matters more than perfect timing.',
    },
  },
  {
    icon: 'fas fa-flask',
    text: 'Best sources of vitamins?',
    article: {
      icon: 'fas fa-flask',
      title: 'Top food sources of essential vitamins',
      readTime: '5 min read',
      category: 'Nutrition',
      intro:
        'Whole foods are the best vitamin source — they come bundled with fiber, minerals and phytochemicals that supplements cannot match.',
      sections: [
        {
          heading: '☀️ Vitamin D',
          body:
            'Salmon, mackerel, sardines, egg yolks, fortified milk. Plus 15 minutes of midday sun.',
        },
        {
          heading: '🍊 Vitamin C',
          body:
            'Bell peppers, citrus fruits, kiwi, strawberries, broccoli, parsley. Cooking destroys it — eat raw when possible.',
        },
        {
          heading: '🥬 Vitamin K',
          body:
            'Dark leafy greens (kale, spinach, collards), broccoli, Brussels sprouts. Pair with fat for absorption.',
        },
        {
          heading: '🥕 Vitamin A',
          body:
            'Carrots, sweet potato, pumpkin, liver, egg yolks, mango. Beta-carotene converts to vitamin A in the body.',
        },
        {
          heading: '🌰 B-vitamins',
          body:
            'Whole grains, eggs, meat, legumes, nuts, leafy greens. Vegans should supplement B12.',
        },
      ],
      takeaway:
        'Eat the rainbow — a colourful plate covers most vitamin needs. Consider supplementing only D and B12 if your diet or sun exposure is limited.',
    },
  },
  {
    icon: 'fas fa-utensils',
    text: 'Meal prep for beginners',
    article: {
      icon: 'fas fa-utensils',
      title: 'Meal prep 101: a beginner\'s guide',
      readTime: '6 min read',
      category: 'General',
      intro:
        'Meal prep saves time, money and willpower. Start small — one meal type per week is enough to build the habit.',
      sections: [
        {
          heading: '🛒 Step 1 — Plan & shop',
          body:
            'Pick 2–3 recipes for the week. Make a single grocery list. Shop once, ideally on the same day each week.',
        },
        {
          heading: '🔪 Step 2 — Prep ingredients',
          body:
            'Wash and chop vegetables. Cook a big batch of grain (rice, quinoa) and protein (chicken, beans, eggs). Store in airtight containers.',
        },
        {
          heading: '📦 Step 3 — Assemble',
          body:
            'Mix-and-match in containers: 1/4 protein + 1/4 grain + 1/2 vegetables + sauce. Refrigerate up to 4 days, freeze the rest.',
        },
        {
          heading: '⚡ Time-saving tips',
          body:
            '• Cook once, eat 3 times\n• Use a sheet pan or slow cooker\n• Pre-portion snacks (nuts, fruit, yogurt)\n• Keep sauces separate to avoid soggy meals',
        },
      ],
      takeaway:
        'Spend 90 minutes on Sunday → save 5+ hours during the week. Start with just lunches before scaling to all meals.',
    },
  },
  {
    icon: 'fas fa-cookie',
    text: 'Healthy snack ideas',
    article: {
      icon: 'fas fa-cookie',
      title: '15 healthy snacks under 200 kcal',
      readTime: '3 min read',
      category: 'Recipes',
      intro:
        'Smart snacks keep blood sugar steady and prevent overeating at meals. Aim for protein + fiber combinations.',
      sections: [
        {
          heading: '🥣 Protein-rich (under 150 kcal)',
          body:
            '• Greek yogurt + berries — 130 kcal\n• 2 boiled eggs — 140 kcal\n• Cottage cheese (100 g) + cucumber — 110 kcal\n• Turkey slices + apple — 150 kcal',
        },
        {
          heading: '🥑 Healthy fats',
          body:
            '• 1 tbsp almond butter + apple — 180 kcal\n• Half avocado on rye toast — 200 kcal\n• Handful (28 g) of nuts — 165 kcal',
        },
        {
          heading: '🍎 Fiber-packed',
          body:
            '• Carrot sticks + hummus (50 g) — 120 kcal\n• Apple + 1 tsp peanut butter — 130 kcal\n• Air-popped popcorn (3 cups) — 90 kcal\n• Pear + 30 g cheese — 180 kcal',
        },
      ],
      takeaway:
        'The best snack is one you actually keep around. Pre-portion options on Sunday and you will reach for them instead of chips.',
    },
  },
  {
    icon: 'fas fa-fire',
    text: 'How to calculate my daily calories?',
    article: {
      icon: 'fas fa-fire',
      title: 'Calculating your daily calorie needs',
      readTime: '5 min read',
      category: 'Nutrition',
      intro:
        'Your daily calorie target is built from three numbers: BMR, activity level and your goal. Dietrix calculates this for you in your profile.',
      sections: [
        {
          heading: '1️⃣ BMR (Mifflin-St Jeor)',
          body:
            'Men: 10 × kg + 6.25 × cm − 5 × age + 5\nWomen: 10 × kg + 6.25 × cm − 5 × age − 161\n\nThis is the energy your body burns at complete rest.',
        },
        {
          heading: '2️⃣ TDEE — Total daily expenditure',
          body:
            'Multiply BMR by your activity factor:\n• Sedentary × 1.2\n• Lightly active × 1.375\n• Moderately active × 1.55\n• Very active × 1.725\n• Extra active × 1.9',
        },
        {
          heading: '3️⃣ Adjust for goal',
          body:
            '• Lose weight: TDEE × 0.80 (−20 %)\n• Maintain: TDEE × 1.00\n• Gain muscle: TDEE × 1.10 (+10 %)\n• Gain weight: TDEE × 1.20 (+20 %)',
        },
        {
          heading: '📊 Example',
          body:
            '30-year-old woman, 65 kg, 165 cm, moderately active, weight loss:\nBMR ≈ 1399 → TDEE ≈ 2168 → Target ≈ 1735 kcal/day.',
        },
      ],
      takeaway:
        'Numbers are a starting point — track your weight weekly and adjust by ±100–200 kcal if progress stalls.',
    },
  },
  {
    icon: 'fas fa-glass-water',
    text: 'How much water should I drink?',
    article: {
      icon: 'fas fa-glass-water',
      title: 'Daily water intake — what science says',
      readTime: '3 min read',
      category: 'General',
      intro:
        'Water makes up ~60 % of body weight and powers every cellular reaction. Even mild dehydration (−1 %) hurts focus and performance.',
      sections: [
        {
          heading: '🥛 General recommendation',
          body:
            'Adults: 30–35 ml per kg of body weight per day.\nA 70 kg person → ~2.1–2.5 L (8–10 cups).',
        },
        {
          heading: '🔥 When to drink more',
          body:
            '• Hot weather → +500 ml\n• Exercise → +500–1000 ml/hour of activity\n• Pregnancy / breastfeeding → +300–700 ml\n• High protein or fiber intake\n• Coffee or alcohol (mild diuretics)',
        },
        {
          heading: '🚦 Easy hydration check',
          body:
            'Pale-yellow urine = well hydrated.\nDark yellow / amber = drink more.\nThirst is a late signal — don\'t wait for it.',
        },
        {
          heading: '🥤 Smart sources',
          body:
            'Water, herbal tea, sparkling water, broth, fruits and vegetables (cucumber, watermelon, oranges). Sugary drinks and excess caffeine don\'t count.',
        },
      ],
      takeaway:
        'Keep a 1 L bottle within reach and refill it twice a day. Add lemon, mint or berries if plain water bores you.',
    },
  },
];

// ── component ────────────────────────────────

export default function Chat() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [faq, setFaq] = useState<FaqItemDto[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeFaqId, setActiveFaqId] = useState<number | null>(null);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: "👋 Hi! I'm your Dietrix nutrition assistant. Ask me anything about nutrition, diets, recipes, or healthy eating habits — I'm here to help!",
      time: timeNow(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesRef = useRef<HTMLDivElement>(null);

  // ── effects ───────────────────────────────
  useEffect(() => {
    if (!getAccessToken()) { navigate('/sign-in', { replace: true }); return; }
    loadInitial();
  }, []);

  useEffect(() => {
    loadFaq(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveArticle(null);
    }
    if (activeArticle) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [activeArticle]);

  async function loadInitial() {
    setLoading(true);
    try {
      const [profileRes, faqRes] = await Promise.allSettled([
        getProfile(),
        getFaq(),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (faqRes.status === 'fulfilled') setFaq(faqRes.value.data ?? []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  async function loadFaq(category: string) {
    try {
      const res = await getFaq(category || undefined);
      setFaq(res.data ?? []);
      setActiveFaqId(null);
    } catch {
      setFaq([]);
    }
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      time: timeNow(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await chatWithAssistant({ message: text });
      const botMsg: ChatMsg = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: res.data.message,
        time: timeNow(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Sorry, I could not process your question right now. Please try again.';
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'bot', text: msg, time: timeNow(), error: true },
      ]);
    } finally {
      setSending(false);
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
        <div className="chat-page">
          <nav className="navbar">
            <div className="logo"><i className="fas fa-leaf" /><span className="logo-text">DIETRIX</span></div>
            <div style={{ flex: 1 }} />
            <div className="skeleton skeleton-text" style={{ width: 120 }} />
          </nav>
          <div style={{ marginTop: 40 }}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-card" style={{ height: 400, marginTop: 20 }} />
          </div>
        </div>
      </>
    );
  }

  // ── main render ───────────────────────────
  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="chat-page">
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
            <Link to="/ai-generate">AI Generator</Link>
            <Link to="/chat" className="active">Chat</Link>
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
            <i className="fas fa-comment-dots" />
            FAQ Chat
          </h1>
          <p className="page-subtitle">Get answers to common questions about nutrition and healthy eating</p>
        </div>

        {/* ═══ Category chips ════════════════ */}
        <div className="category-chips">
          {CATEGORIES.map((c) => (
            <span
              key={c.value || 'all'}
              className={`chip ${activeCategory === c.value ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.value)}
            >
              {c.label}
            </span>
          ))}
        </div>

        {/* ═══ Layout ════════════════════════ */}
        <div className="chat-layout">

          {/* ── Chat ── */}
          <div className="chat-main">
            <div className="chat-messages" ref={messagesRef}>
              {messages.map((msg) => (
                <div className="chat-message" key={msg.id}>
                  <div className={`chat-message-avatar ${msg.role === 'bot' ? 'bot' : ''}`}>
                    <i className={msg.role === 'bot' ? 'fas fa-robot' : 'fas fa-user'} />
                  </div>
                  <div className="chat-message-content">
                    <div className="chat-message-header">
                      <span className="chat-message-name">
                        {msg.role === 'bot' ? 'Dietrix Bot' : (profile?.name?.split(' ')[0] ?? 'You')}
                      </span>
                      <span className="chat-message-time">{msg.time}</span>
                    </div>
                    <div className={`chat-bubble ${msg.role === 'user' ? 'user' : ''} ${msg.error ? 'error' : ''}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}

              {/* typing indicator */}
              {sending && (
                <div className="chat-message">
                  <div className="chat-message-avatar bot">
                    <i className="fas fa-robot" />
                  </div>
                  <div className="chat-message-content">
                    <div className="chat-message-header">
                      <span className="chat-message-name">Dietrix Bot</span>
                      <span className="chat-message-time">typing…</span>
                    </div>
                    <div className="chat-bubble">
                      <div className="typing-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-area">
              <input
                type="text"
                className="chat-input"
                placeholder="Type your question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                disabled={sending}
              />
              <button
                className="chat-send-btn"
                onClick={() => handleSend()}
                disabled={sending || !input.trim()}
                title="Send"
              >
                <i className="fas fa-paper-plane" />
              </button>
            </div>
          </div>

          {/* ── FAQ sidebar ── */}
          <div className="faq-sidebar">
            <div className="sidebar-title">
              <i className="fas fa-question-circle" />
              Frequently Asked
            </div>

            {faq.length > 0 ? (
              <div className="faq-list">
                {faq.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className={`faq-item ${activeFaqId === item.id ? 'active' : ''}`}
                    onClick={() => setActiveFaqId(activeFaqId === item.id ? null : item.id)}
                  >
                    <div className="faq-question">
                      <span>{item.question}</span>
                      <i className="fas fa-chevron-down chevron" />
                    </div>
                    <div className="faq-answer">
                      {item.answer}
                      <button
                        className="faq-ask-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSend(item.question);
                        }}
                      >
                        <i className="fas fa-paper-plane" style={{ marginRight: 6 }} />
                        Ask in chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="faq-empty">
                <i className="fas fa-folder-open" />
                No FAQ items in this category
              </div>
            )}

            {/* Popular topics */}
            <div className="popular-topics">
              <div className="sidebar-title" style={{ marginTop: 10 }}>
                <i className="fas fa-fire" />
                Popular Topics
              </div>
              {POPULAR_TOPICS.map((t, i) => (
                <button
                  key={i}
                  className="topic-item"
                  onClick={() => setActiveArticle(t.article)}
                >
                  <i className={t.icon} />
                  <span className="topic-text">{t.text}</span>
                  <i className="fas fa-arrow-right" style={{ fontSize: 12, color: 'var(--text-gray)' }} />
                </button>
              ))}
            </div>

            {/* Need more help */}
            <div style={{ marginTop: 28, padding: 20, background: 'var(--primary-light)', borderRadius: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <i className="fas fa-headset" style={{ color: 'var(--primary)', fontSize: 22 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Need more help?</div>
              </div>
              <p style={{ color: 'var(--text-soft)', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                Our nutritionists are available Monday–Friday, 9am–6pm.
              </p>
              <button
                style={{
                  background: 'white', border: 'none', padding: '10px 16px',
                  borderRadius: 40, width: '100%', fontWeight: 600,
                  color: 'var(--primary)', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                }}
                onClick={() => window.location.href = 'mailto:dietrix@inbox.ru'}
              >
                <i className="fas fa-envelope" style={{ marginRight: 8 }} />
                Contact Support
              </button>
            </div>
          </div>
        </div>

      {/* ═══ Article modal ═══════════════════ */}
      {activeArticle && (
        <div className="article-overlay" onClick={() => setActiveArticle(null)}>
          <div className="article-modal" onClick={(e) => e.stopPropagation()}>
            <button className="article-close" onClick={() => setActiveArticle(null)} aria-label="Close">
              <i className="fas fa-times" />
            </button>

            <div className="article-icon">
              <i className={activeArticle.icon} />
            </div>

            <div className="article-meta">
              <span className="article-category-tag">{activeArticle.category}</span>
              <span className="article-read-time">
                <i className="far fa-clock" /> {activeArticle.readTime}
              </span>
            </div>

            <h2 className="article-title">{activeArticle.title}</h2>
            <p className="article-intro">{activeArticle.intro}</p>

            {activeArticle.sections.map((s, i) => (
              <div className="article-section" key={i}>
                <h3 className="article-section-heading">{s.heading}</h3>
                <div className="article-section-body">{s.body}</div>
              </div>
            ))}

            <div className="article-takeaway">
              <div className="takeaway-label">
                <i className="fas fa-lightbulb" /> Key takeaway
              </div>
              <div className="takeaway-text">{activeArticle.takeaway}</div>
            </div>

            <button
              className="article-ask-btn"
              onClick={() => {
                const q = activeArticle.title;
                setActiveArticle(null);
                handleSend(q);
              }}
              disabled={sending}
            >
              <i className="fas fa-paper-plane" /> Ask Dietrix Bot about this
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

