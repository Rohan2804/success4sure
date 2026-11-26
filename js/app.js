/* Success4Sure prototype — single-page app with hash routing.
   Data lives in localStorage for now; each store maps to a future database table
   (users, attempts, questions). */
(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtDate = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const DAY = 86400000;
  const LETTERS = 'ABCD';
  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = $('#app');

  // Analytics: events go to Google Tag Manager's dataLayer via js/track.js (no-op if it didn't load).
  const track = (event, params) => { try { (window.s4sTrack || (() => {}))(event, params || {}); } catch (e) { /* never break the app for analytics */ } };

  const mem = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('s4s_' + k); if (v !== null) return JSON.parse(v); } catch (e) { /* storage unavailable */ }
      return k in mem ? mem[k] : d;
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem('s4s_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- icons ----------
  const ICONS = {
    pie: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chart: '<path d="M3 21h18"/><path d="M6 17v-5M11 17V7M16 17v-8M21 17v-3"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    minus: '<path d="M5 12h14"/>',
    bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  };
  const icon = (name, size = 20, cls = '') => `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const arrow = (size = 18) => icon('arrow', size, 'ico-arrow');

  const CAT = {
    'Mutual Funds': { icon: 'pie', color: '#2457f5' },
    'Derivatives': { icon: 'trend', color: '#7a5af8' },
    'Advisory & Research': { icon: 'bulb', color: '#0ea5e9' },
    'Operations & Compliance': { icon: 'shield', color: '#0e9384' },
    'AIF & PMS': { icon: 'briefcase', color: '#e8459c' },
    'Foundation': { icon: 'book', color: '#f79009' },
    'Banking': { icon: 'bank', color: '#12b76a' },
    'SSC': { icon: 'flag', color: '#f79009' },
    'MBA': { icon: 'trophy', color: '#7a5af8' },
    'Insurance & Finance': { icon: 'shield', color: '#e8459c' },
    'Soft Skills': { icon: 'sparkle', color: '#7a5af8' },
  };
  const GROUP_ICON = { 'NISM': 'chart', 'Banking': 'bank', 'SSC': 'flag', 'MBA': 'trophy', 'Insurance & Finance': 'shield' };

  // ---------- UI utilities ----------
  function toast(msg) {
    const t = $('#toast');
    t.innerHTML = icon('check', 18) + '<span>' + esc(msg) + '</span>';
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function modal(html, bind) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    $('.modal-backdrop', root).addEventListener('click', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
    bind && bind($('.modal', root), close);
  }

  // Reveal-on-scroll and animated counters, applied after every render.
  // Cards follow the pointer with a soft colour spotlight and a slight tilt (skipped for reduced motion / touch).
  function cardFx() {
    if (reducedMotion || !matchMedia('(hover: hover)').matches) return;
    app.addEventListener('pointermove', (ev) => {
      const card = ev.target.closest && ev.target.closest('.exam-card, .card.fx, .post-card, .price-card');
      if (!card) return;
      const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      if (card.classList.contains('exam-card')) card.style.transform = `perspective(800px) rotateX(${((0.5 - y) * 5).toFixed(2)}deg) rotateY(${((x - 0.5) * 6).toFixed(2)}deg) translateY(-3px)`;
    });
    app.addEventListener('pointerout', (ev) => {
      const card = ev.target.closest && ev.target.closest('.exam-card');
      if (card && !card.contains(ev.relatedTarget)) card.style.transform = '';
    });
  }
  cardFx();

  function enhance() {
    const reveal = (el) => {
      el.classList.add('in');
      $$('[data-count]', el).forEach(countUp);
      if (el.matches('[data-count]')) countUp(el);
    };
    const els = $$('.reveal', app);
    if (!('IntersectionObserver' in window) || reducedMotion) els.forEach(reveal);
    else {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      }), { threshold: 0.01, rootMargin: '0px 0px -40px 0px' });
      els.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight - 40) reveal(el); else io.observe(el); });
    }
    $$('[data-count]', app).filter((el) => !el.closest('.reveal')).forEach(countUp);
  }

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reducedMotion) { el.textContent = target + suffix; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function confetti() {
    if (reducedMotion) return;
    const c = $('#confetti');
    const ctx = c.getContext('2d');
    c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const colors = ['#2457f5', '#38bdf8', '#7a5af8', '#12b76a', '#ffb547', '#ffffff'];
    const parts = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight / 3,
      vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4,
      s: Math.random() * 7 + 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    const frame = (t) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (t - t0 < 3500) requestAnimationFrame(frame);
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
    };
    requestAnimationFrame(frame);
  }

  async function hashPw(pw) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('s4s:' + pw));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return 'plain:' + pw; // prototype fallback only
  }

  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- data ----------
  const EXAMS = window.EXAMS;
  const examById = (id) => EXAMS.find((e) => e.id === id);
  const examCode = (e) => (e.group === 'NISM' ? 'NISM ' + e.series : e.series);
  const groupOf = (e) => window.GROUPS.find((g) => g.id === e.group) || {};
  const passWord = (e) => (groupOf(e).competitive ? 'target score' : 'to pass');
  const extLink = (l, cls = 'btn btn-block') => `<a class="${cls}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon(l.kind === 'pdf' ? 'file' : 'external', 16)} ${esc(l.label)}</a>`;

  function questionsFor(examId) {
    const base = (window.QUESTIONS[examId] || []).map((q, i) => ({
      id: `${examId}-${i}`, chapter: q[0], text: q[1], options: q[2], answer: q[3], explanation: q[4],
    }));
    const custom = store.get('custom_questions', []).filter((q) => q.examId === examId);
    return base.concat(custom);
  }
  const allQuestionsById = (examId) => Object.fromEntries(questionsFor(examId).map((q) => [q.id, q]));
  const chaptersFor = (examId) => [...new Set(questionsFor(examId).map((q) => q.chapter))];
  const totalQuestions = () => EXAMS.reduce((s, e) => s + questionsFor(e.id).length, 0);

  // ---------- Google sign-in (Supabase Auth) ----------
  // The publishable key is meant to be public; the Google client secret lives only in Supabase.
  const SUPABASE_URL = 'https://yjxjldpmtedhjxggybbx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0oUFLZ9eHK3pr19J2Ae4UQ_N4Kaqrtn';
  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } }) : null;

  async function googleSignIn(next) {
    if (!sb) return toast('Google sign-in is unavailable right now. Please try again.');
    try { sessionStorage.setItem('s4s_next', next || '/dashboard'); } catch (e) { /* storage unavailable */ }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } });
    if (error) toast('Could not start Google sign-in: ' + error.message);
  }

  // Mirror the Supabase user into the local stores so subscriptions and progress keep working.
  function adoptSupabaseUser(su) {
    const m = su.user_metadata || {};
    const list = store.get('users', []);
    const prev = list.find((x) => x.id === su.id) || {};
    const u = { ...prev, id: su.id, email: (su.email || '').toLowerCase(), name: m.full_name || m.name || (su.email || 'Learner').split('@')[0],
      avatar: m.avatar_url || m.picture || '', provider: 'google', created: prev.created || Date.now() };
    store.set('users', [...list.filter((x) => x.id !== su.id), u]);
    store.set('session', { userId: u.id, provider: 'google' });
    claimGuest(u.id);
    return u;
  }

  if (sb) {
    sb.auth.onAuthStateChange((event, s) => {
      setTimeout(() => {
        if (s && s.user) {
          const fresh = !(store.get('session', null) || {}).userId || store.get('session', null).userId !== s.user.id;
          const u = adoptSupabaseUser(s.user);
          let next = null;
          try { next = sessionStorage.getItem('s4s_next'); sessionStorage.removeItem('s4s_next'); } catch (e) { /* storage unavailable */ }
          if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
          if (next) {
            const isNew = s.user.created_at && Date.now() - new Date(s.user.created_at).getTime() < 10 * 60 * 1000;
            track(isNew ? 'sign_up' : 'login', { method: 'google' });
            toast(`Welcome, ${u.name.split(' ')[0]}!`); location.hash = '#' + next;
          }
          if (fresh || next) route();
          else renderNav((location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || '');
        } else if (event === 'SIGNED_OUT' && (store.get('session', null) || {}).provider === 'google') {
          store.set('session', null); route();
        }
      }, 0);
    });
  }

  const users = () => store.get('users', []);
  const session = () => store.get('session', null);
  const currentUser = () => { const s = session(); return s ? users().find((u) => u.id === s.userId) || null : null; };
  const subs = () => store.get('subs', []);
  const attempts = () => store.get('attempts', []);

  // Everything is free: every exam and course is unlocked for everyone. Guests' results are kept
  // under 'guest' and moved to their account when they log in.
  const GUEST = 'guest';
  const meId = () => (currentUser() || {}).id || GUEST;
  function activeSub(userId, examId) {
    const p = productById(examId);
    return p ? { free: true, examId, tests: skillById(examId) ? 0 : maxMocks(p), label: 'Free' } : null;
  }
  function claimGuest(userId) {
    const list = attempts();
    if (list.some((a) => a.userId === GUEST || a.userId === null)) store.set('attempts', list.map((a) => (a.userId === GUEST || a.userId === null ? { ...a, userId } : a)));
    const sp = store.get('skill_progress', {});
    if (sp[GUEST]) { sp[userId] = { ...sp[GUEST], ...(sp[userId] || {}) }; delete sp[GUEST]; store.set('skill_progress', sp); }
  }
  const testsIn = (sub) => sub.tests || sub.days;
  // Some exams (e.g. NISM V-B, a 50-question paper) unlock more than one real-format mock test per plan day.
  const perDay = (e) => (e && e.mocksPerDay) || 1;
  const mocksFor = (e, plan) => plan.tests * perDay(e);
  const maxMocks = (e) => window.MAX_TESTS * perDay(e);
  const num = (n) => Number(n).toLocaleString('en-IN');
  const qPerTest = (e) => e.pattern.questions;

  // Mock test k (1-based) is a fixed paper. With a full bank each test gets its own slice of
  // questions; while the bank is small, each test is a stable, seeded mix of what exists.
  function seeded(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function mockQuestions(e, k) {
    const pool = questionsFor(e.id);
    const n = qPerTest(e);
    if (pool.length >= k * n) return pool.slice((k - 1) * n, k * n);
    const rnd = seeded([...(e.id + ':' + k)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261));
    const a = pool.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, Math.min(n, a.length));
  }
  function mockStatus(userId, examId) {
    const out = {};
    attempts().filter((a) => a.userId === userId && a.examId === examId && !a.demo && a.submittedAt && a.mockNo).forEach((a) => {
      const m = (out[a.mockNo] ||= { tries: 0, best: 0, passed: false, last: null });
      m.tries++; m.best = Math.max(m.best, a.result.pct); m.passed = m.passed || a.result.passed; m.last = a.id;
    });
    return out;
  }
  const nextMock = (status, total) => { for (let k = 1; k <= total; k++) if (!status[k]) return k; return null; };

  // ---------- nav + routing ----------
  function renderNav(active) {
    const u = currentUser();
    const link = (href, label, key, cls = '') => `<a href="${href}" class="${cls} ${active === key ? 'active' : ''}">${label}</a>`;
    $('#nav').innerHTML = `
      <div class="nav-links">
        ${link('#/', 'Home', '', 'nav-home')}
        ${link('#/exams', 'All Exams', 'exams')}
        ${window.GROUPS.filter((g) => g.id !== 'Insurance & Finance').map((g) => `<a class="nav-cat" href="#/exams?g=${encodeURIComponent(g.id)}">${esc(g.id === 'MBA' ? 'MBA' : g.label)}</a>`).join('')}
        ${link('#/skills', 'Soft Skills', 'skills', 'nav-skills')}
        ${link('#/study-material', 'Study Material', 'study-material', 'nav-study')}
        <a href="/blog/" class="nav-study">Blogs</a>
      </div>
      <form class="nav-search" id="nav-search" role="search">
        ${icon('search', 16)}<input type="search" placeholder="Search exams, e.g. NISM V-A, IBPS PO…" aria-label="Search exams"><kbd>⌘K</kbd>
      </form>
      <div class="nav-right">
        ${u ? `${link('#/dashboard', 'Dashboard', 'dashboard', 'nav-dash')}
          <div class="pmenu">
            <button type="button" class="pmenu-btn ${active === 'profile' ? 'active' : ''}" id="pmenu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Open profile menu">${avatarHtml(u)}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
            <div class="pmenu-pop" id="pmenu-pop" role="menu" hidden>
              <div class="pmenu-head">${avatarHtml(u, 'avatar avatar-md')}<div><b>${esc(u.name)}</b><span>${esc(u.email || '')}</span></div></div>
              <a role="menuitem" href="#/profile">${icon('user', 18)} My profile &amp; progress</a>
              <a role="menuitem" href="#/dashboard">${icon('grid', 18)} Dashboard</a>
              <a role="menuitem" href="#/" id="logout" class="pmenu-out">${icon('back', 18)} Log out</a>
            </div>
          </div>`
            : `<a href="#/login" class="btn btn-primary btn-sm">Login / Sign up</a>`}
      </div>`;
    $('#nav-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('input', e.currentTarget).value.trim();
      location.hash = '#/exams' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    const pb = $('#pmenu-btn');
    pb && pb.addEventListener('click', (e) => { e.stopPropagation(); togglePmenu(); });
    const lo = $('#logout');
    lo && lo.addEventListener('click', async (e) => {
      e.preventDefault();
      const viaGoogle = (session() || {}).provider === 'google';
      store.set('session', null);
      if (viaGoogle && sb) await sb.auth.signOut().catch(() => {});
      toast('Logged out'); location.hash = '#/'; route();
    });
  }

  function avatarHtml(u, cls = 'avatar') {
    const initial = esc((u.name || u.email || '?').trim()[0].toUpperCase());
    return `<span class="${cls}" title="${esc(u.name)}">${initial}${u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  function togglePmenu(open) {
    const pop = $('#pmenu-pop'), btn = $('#pmenu-btn');
    if (!pop) return;
    const show = open === undefined ? pop.hidden : open;
    pop.hidden = !show; btn.setAttribute('aria-expanded', String(show));
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.pmenu-pop')) togglePmenu(false); else if (e.target.closest('a')) togglePmenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') togglePmenu(false); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      const i = $('#nav-search input');
      if (i && i.offsetParent) { e.preventDefault(); i.focus(); }
    }
  });

  let cleanup = null;
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    $('#modal-root').innerHTML = '';
    const [path, qs] = location.hash.replace(/^#/, '').split('?');
    const parts = (path || '/').split('/').filter(Boolean);
    const params = new URLSearchParams(qs || '');
    const view = parts[0] || '';
    renderNav(view);
    window.scrollTo(0, 0);
    const views = {
      '': viewHome,
      exams: () => viewCatalog(params.get('q') || '', params.get('g') || 'All', params.get('cat') || 'All'),
      'study-material': () => viewStudy(params.get('g') || 'NISM'),
      exam: () => viewExam(parts[1]),
      login: () => viewAuth('login', params.get('next')),
      register: () => viewAuth('register', params.get('next')),
      checkout: () => { location.replace('#' + (skillById(parts[1]) ? '/skills/' + skillById(parts[1]).slug : '/exam/' + parts[1])); },
      dashboard: viewDashboard,
      profile: viewProfile,
      test: () => viewTest(parts[1], params.get('demo') === '1', Number(parts[2]) || 0),
      result: () => viewResult(parts[1]),
      admin: viewAdmin,
      skills: () => (!parts[1] ? viewSkills() : !parts[2] ? viewSkillArea(parts[1])
        : parts[3] === 'quiz' ? viewSkillQuiz(parts[1], parts[2])
        : parts[3] === 'scenario' ? viewScenario(parts[1], parts[2], Number(parts[4]) || 0)
        : viewLesson(parts[1], parts[2], params.get('view'))),
      coach: viewCoach,
      daily: () => viewDaily(params.get('exam')),
    };
    (views[view] || viewNotFound)();
    if (route.seen) {
      setTimeout(() => {
        const h1 = $('#app h1');
        track('virtual_page_view', { page_path: location.pathname + location.hash, page_location: location.href,
          page_title: (h1 ? h1.textContent.trim().replace(/\s+/g, ' ') + ' | ' : '') + 'Success4Sure' });
      }, 0);
    }
    route.seen = true;
    enhance();
  }

  function requireLogin() {
    if (currentUser()) return true;
    location.hash = '#/login?next=' + encodeURIComponent(location.hash.slice(1));
    return false;
  }

  window.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 8), { passive: true });

  // ---------- shared pieces ----------
  function examCard(e, i = 0) {
    const c = CAT[e.category];
    return `<a class="exam-card reveal" style="--c:${c.color};--d:${Math.min(i, 8) * 0.05}s" href="#/exam/${e.id}">
      <div class="ec-top">
        <span class="ec-icon">${icon(c.icon, 24)}</span>
        ${e.isNew ? '<span class="badge">New</span>' : e.popular ? `<span class="badge badge-hot">${icon('star', 12)} Popular</span>` : ''}
      </div>
      <span class="series">${esc(examCode(e))}</span>
      <h3>${esc(e.name)}</h3>
      <div class="ec-meta"><span>${icon('book', 14)} Up to ${maxMocks(e)} mocks</span><span>${icon('clock', 14)} ${e.pattern.duration} min</span><span>${icon('target', 14)} ${e.pattern.passPct}%</span></div>
      <div class="ec-foot"><span class="badge badge-success">Free</span><span class="ec-arrow">${arrow(16)}</span></div>
    </a>`;
  }

  function groupTabs(active, withCounts) {
    return ['All', ...window.GROUPS.map((g) => g.id)].map((id) => {
      const g = window.GROUPS.find((x) => x.id === id);
      const n = id === 'All' ? EXAMS.length : EXAMS.filter((e) => e.group === id).length;
      return `<button class="cat-tab ${id === active ? 'active' : ''}" data-group="${esc(id)}">${esc(g ? g.label : 'All exams')}${withCounts ? ` <span class="count">${n}</span>` : ''}</button>`;
    }).join('');
  }

  function catTabs(active, withCounts) {
    const counts = Object.fromEntries(window.CATEGORIES.map((c) => [c, EXAMS.filter((e) => e.category === c).length]));
    return ['All', ...window.CATEGORIES].map((c) => {
      const meta = CAT[c] || { icon: 'grid', color: '#2457f5' };
      const n = c === 'All' ? EXAMS.length : counts[c];
      return `<button class="cat-tab ${c === active ? 'active' : ''}" style="--c:${meta.color}" data-cat="${esc(c)}"><span class="ct-ico">${icon(meta.icon, 15)}</span>${esc(c)}${withCounts ? ` <span class="count">${n}</span>` : ''}</button>`;
    }).join('');
  }

  // ---------- home ----------
  // Homepage side panels: open government exams (left) and open NFOs (right), from js/data/live.js.
  function livePanel(kind, limit = 5) {
    const L = (window.LIVE || {})[kind] || { items: [] };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dt = (v) => (v ? new Date(v + 'T00:00:00') : null);
    const short = (v) => dt(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const left = (v) => { const n = Math.round((dt(v) - today) / DAY); return n <= 0 ? 'Last day' : n === 1 ? '1 day left' : `${n} days left`; };
    let items, title, sub, href, ic, row;
    if (kind === 'nfo') {
      items = L.items.filter((it) => !it.close_date || dt(it.close_date) >= today).sort((a, b) => (a.close_date || '9').localeCompare(b.close_date || '9'));
      title = 'New Fund Offers'; sub = 'Mutual fund NFOs open now'; href = '/nfo/'; ic = 'pie';
      row = (it) => `<li><a href="/nfo/" data-track="nfo_click" data-track-params='${esc(JSON.stringify({ item_name: it.scheme, amc: it.amc, placement: 'home_panel' }))}'><b>${esc(it.scheme)}</b><span class="small muted">${esc(it.amc)} · ${esc(it.category)}</span>
        <span class="lp-date">${dt(it.open_date) > today ? `Opens ${short(it.open_date)}` : `Closes ${short(it.close_date)}`}${it.close_date && dt(it.open_date) <= today ? ` · <em>${left(it.close_date)}</em>` : ''}</span></a></li>`;
    } else {
      const rank = { 'Application open': 0, 'Upcoming': 1, 'Notification expected': 2 };
      items = L.items.filter((it) => it.status !== 'Application open' || !it.apply_end || dt(it.apply_end) >= today)
        .sort((a, b) => rank[a.status] - rank[b.status] || (a.apply_end || a.exam_date || '9').localeCompare(b.apply_end || b.exam_date || '9'));
      title = 'Govt exams & jobs'; sub = 'Openings across government, banks and PSUs'; href = '/govt-exams/'; ic = 'bank';
      // Drop trailing advert codes like "(CRPD/SCO/2026-27/28)" in the compact panel; the full page keeps them.
      const shortTitle = (t) => t.replace(/\s*\((?:CEN|Advt|CRPD|No\.)[^)]*\)\s*$/i, '').replace(/\s*\([^)]*\/[^)]*\)\s*$/, '');
      row = (it) => `<li><a href="/govt-exams/" data-track="govt_exam_click" data-track-params='${esc(JSON.stringify({ item_name: it.title, org: it.org, placement: 'home_panel' }))}'><b>${esc(shortTitle(it.title))}</b><span class="small muted">${esc(it.org)}${it.posts ? ' · ' + esc(it.posts) + ' posts' : ''}</span>
        <span class="lp-date">${it.status === 'Application open' && it.apply_end ? `Apply by ${short(it.apply_end)} · <em>${left(it.apply_end)}</em>` : it.exam_date ? `Exam ${short(it.exam_date)}` : esc(it.status)}</span></a></li>`;
    }
    return `<div class="lp-head"><span class="lp-ico">${icon(ic, 18)}</span><div><b>${title}</b><span class="small muted">${sub}</span></div><span class="lp-live" title="Updated ${esc(L.updated || '')}">Live</span></div>
      ${items.length ? `<ul class="lp-list">${items.slice(0, limit).map(row).join('')}</ul>` : `<p class="small muted" style="margin:12px 0">Nothing open right now — check the full list.</p>`}
      <a class="lp-more" href="${href}">Show all${items.length ? ` ${items.length}` : ''} ${arrow(14)}</a>`;
  }

  function bannerTracking(link) {
    if (!link) return;
    const info = () => ({ banner_name: 'indiabulls_securities', placement: 'home_below_hero',
      creative: matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop', link_url: link.href });
    link.addEventListener('click', () => track('banner_click', info()));
    if (!('IntersectionObserver' in window)) { track('banner_view', info()); return; }
    let timer = null;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting && en.intersectionRatio >= 0.5) {
        timer = timer || setTimeout(() => { track('banner_view', info()); io.disconnect(); }, 1000);
      } else { clearTimeout(timer); timer = null; }
    }), { threshold: [0, 0.5, 1] });
    io.observe(link);
  }

  function viewHome() {
    const HERO = 'd'; // headline left, tabbed card (govt exams / NFOs) right
    const HERO_LIMIT = 5;
    const N = EXAMS.length;
    const totalQ = totalQuestions();
    const faqs = [
      ['Are these actual exam questions?', 'No. All questions are original practice questions written by our team and mapped topic by topic to each exam\'s official syllabus. They prepare you for the concepts and the format — not by leaking real exam content.'],
      ['Is Success4Sure really free?', 'Yes. Every mock test, practice question, guide, calculator and soft-skills course is free — no plans, no payment and no card details. Just create a free account to start.'],
      ['Why do I need an account?', 'A free account keeps your mock-test results, lesson progress and streaks safe and available on every device. Sign up in one click with Google.'],
      ['Where do I get the official NISM workbooks?', 'NISM publishes its workbooks free of cost. Our Study Material page links every NISM exam to NISM\'s official free workbook portal, so you always download the latest version straight from the source.'],
      ['Do mock tests follow the real exam pattern?', 'Yes — the same number of questions, time limit, passing percentage and negative marking as the real exam, so exam day feels familiar.'],
      ['Can I practise on my phone?', 'Absolutely. Success4Sure works on any phone, tablet or laptop browser — no app download needed.'],
      ['Do I need to sign up?', 'Yes, a free account is needed for full mock tests and course lessons. You can try the 3-question demo, the question of the day, free practice questions, notes, the glossary and the blog without signing up.'],
    ];
    app.innerHTML = `
      <section class="hero" data-hero="${HERO}">
        <div class="ticker" aria-label="Exams"><div class="ticker-track">${EXAMS.map((e) => `<a href="#/exam/${e.id}"><b>${esc(examCode(e).replace('NISM Series ', 'NISM '))}</b>${esc(e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name)}<span class="up">▲ ${e.pattern.passPct}% to pass</span></a>`).join('')}${EXAMS.map((e) => `<a href="#/exam/${e.id}"><b>${esc(examCode(e).replace('NISM Series ', 'NISM '))}</b>${esc(e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name)}<span class="up">▲ ${e.pattern.passPct}% to pass</span></a>`).join('')}</div></div>
        <div class="hero-blobs" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="hero-grid">
        <div class="hero-live">
          ${HERO === 'd' ? `<div class="lp-tabs" role="tablist"><button class="lp-tab active" data-k="govt" role="tab">${icon('bank', 16)} Govt exams &amp; jobs</button><button class="lp-tab" data-k="nfo" role="tab">${icon('pie', 16)} New Fund Offers</button></div>` : ''}
          <aside class="live-panel lp-govt hero-anim" style="--d:.1s" aria-label="Government exams open now">${livePanel('govt', HERO_LIMIT)}</aside>
          <aside class="live-panel lp-nfo hero-anim" style="--d:.2s" aria-label="New fund offers open now">${livePanel('nfo', HERO_LIMIT)}</aside>
        </div>
        <div class="wrap hero-center hero-anim">
          <span class="hero-kicker">${icon('sparkle', 14)} 100% free · ${N} exams · mock tests &amp; courses</span>
          <h1>Pass your exam with <span class="grad-word">confidence</span></h1>
          <p class="lead">Exam-pattern mock tests, topic-wise practice and a clear explanation for every answer — for NISM certifications, banking, SSC, MBA entrance and insurance exams.</p>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#/exams">Get started</a>
            <a class="btn btn-lg" href="#/study-material">Free study material</a>
          </div>
          <ul class="trust">
            <li>${icon('check', 16)} Free mock tests</li>
            <li>${icon('check', 16)} Real exam pattern</li>
            <li>${icon('check', 16)} Instant explanations</li>
          </ul>
        </div>

        </div>
      </section>

      <section class="wrap promo-banner reveal" aria-label="Sponsored">
        <a href="https://indiabullssecurities.onelink.me/Kaqz/success4sure" target="_blank" rel="sponsored noopener" id="promo-indiabulls">
          <picture>
            <source media="(max-width: 640px)" srcset="/assets/banners/indiabulls-securities-mobile.jpg" width="1000" height="400">
            <img src="/assets/banners/indiabulls-securities.jpg" width="2000" height="267" loading="lazy" decoding="async"
              alt="Indiabulls Securities: ₹0 account opening charges, ₹11 per executed order across all segments, 20 years of trust. Open your free account now.">
          </picture>
        </a>
        <span class="sponsored-label">Sponsored</span>
      </section>

      <section class="stats-strip wrap reveal">
        <div class="stats">
          <div class="stat"><span class="stat-ico">${icon('grid', 22)}</span><div><b data-count="${N}">0</b><span>Exams covered</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('book', 22)}</span><div><b data-count="${totalQ}" data-suffix="+">0</b><span>Practice questions</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('target', 22)}</span><div><b data-count="${window.GROUPS.length}">0</b><span>Exam categories</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('phone', 22)}</span><div><b>24×7</b><span>On any device</span></div></div>
        </div>
      </section>

      <section class="section wrap qotd-home band band-blue" id="qotd-home"></section>

      <section class="section wrap band band-white">
        <div class="section-head reveal">
          <h2>Find your exam</h2>
          <p>NISM certifications, bank and SSC recruitment, MBA entrance and insurance &amp; banking certifications — every mock test free.</p>
        </div>
        <div class="cat-tabs reveal" id="home-cats">${groupTabs('All', false)}</div>
        <div class="grid grid-4" id="home-grid"></div>
        <div class="center reveal" style="margin-top:32px"><a class="btn btn-lg" href="#/exams">View all ${N} exams ${arrow()}</a></div>
      </section>

      ${(window.SKILL_AREAS || []).length ? `<section class="section wrap band band-violet">
        <div class="section-head reveal">
          <span class="badge" style="align-self:flex-start">New</span>
          <h2 style="margin-top:10px">Soft skills for your career</h2>
          <p>${window.SKILL_AREAS.length} courses — from communication and interviews to working with AI, money skills and leadership — in bite-size lessons for freshers and finance professionals.</p>
        </div>
        <div class="grid">${(window.SKILL_AREAS.filter((x) => x.featured).length ? window.SKILL_AREAS.filter((x) => x.featured) : window.SKILL_AREAS).slice(0, 4).map((x, i) => skillCard(x, i)).join('')}</div>
        <div class="center reveal" style="margin-top:24px"><a class="btn btn-lg" href="#/skills">See all ${window.SKILL_AREAS.length} soft-skills courses ${arrow()}</a></div>
      </section>` : ''}

      <section class="section band-full band-dark">
        <div class="wrap">
          <div class="section-head reveal">
            <h2>Everything you need to pass on the first attempt</h2>
          </div>
          <div class="bento">
            <div class="card span-3 reveal">
              <div class="feat-ico">${icon('clock', 22)}</div>
              <h3>Real exam simulation</h3>
              <p>Same number of questions, time limit and negative marking as the real exam. Walk in on exam day feeling ready.</p>
              <div class="mini-timer">${icon('clock', 20)} 01:59:42</div>
            </div>
            <div class="card span-3 reveal" style="--d:.1s">
              <div class="feat-ico">${icon('chart', 22)}</div>
              <h3>Chapter-wise analytics</h3>
              <p>See exactly which chapters need more work after every test.</p>
              <div class="mini-bars"><span style="--h:55%"></span><span style="--h:82%"></span><span style="--h:38%"></span><span style="--h:92%"></span><span style="--h:68%"></span><span style="--h:76%"></span></div>
            </div>
            <div class="card span-2 reveal">
              <div class="feat-ico">${icon('bulb', 22)}</div>
              <h3>Instant explanations</h3>
              <p>Every answer comes with a short, clear explanation.</p>
              <div class="mini-explain">${icon('check', 16)} Put intrinsic value = max(strike − spot, 0)</div>
            </div>
            <div class="card span-2 reveal" style="--d:.1s">
              <div class="feat-ico">${icon('flag', 22)}</div>
              <h3>Mark for review</h3>
              <p>Flag tricky questions and come back to them — just like the real exam interface.</p>
            </div>
            <div class="card span-2 reveal" style="--d:.2s">
              <div class="feat-ico">${icon('phone', 22)}</div>
              <h3>Practise anywhere</h3>
              <p>Phone, tablet or laptop. Squeeze in a test on your commute.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section wrap band band-warm">
        <div class="section-head reveal center">
          <h2>Three steps to certification</h2>
        </div>
        <div class="steps">
          <div class="step reveal"><div class="step-num">${icon('search', 26)}<em>1</em></div><h3>Pick your exam</h3><p>Choose any of our ${N} exams — every one is free.</p></div>
          <div class="step reveal" style="--d:.12s"><div class="step-num">${icon('clock', 26)}<em>2</em></div><h3>Take mock tests</h3><p>Up to 30 full-length, timed mock tests per exam, plus chapter-wise practice.</p></div>
          <div class="step reveal" style="--d:.24s"><div class="step-num">${icon('trophy', 26)}<em>3</em></div><h3>Review &amp; pass</h3><p>Learn from explanations, fix weak chapters and walk in confident.</p></div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head reveal">
            <h2>100% free. No plans, no payment.</h2>
            <p>Every exam, every mock test and every course is free for everyone — just create a free account in one click.</p>
          </div>
          <div class="grid free-grid">
            ${[['grid', 'Up to 30 mock tests per exam', 'Full-length, timed, in the real exam pattern'], ['book', 'Chapter-wise practice', 'Free questions with answers for every chapter'], ['bulb', 'Explanations & analytics', 'Know why each answer is right and where you are weak'], ['user', 'Free soft-skills courses', 'Bite-size lessons, quizzes and scenarios']]
              .map(([ic, t, d], i) => `<div class="card reveal" style="--d:${i * 0.08}s"><span class="stat-ico">${icon(ic, 22)}</span><h3 style="margin:12px 0 4px;font-size:1.05rem">${t}</h3><p class="muted small" style="margin:0">${d}</p></div>`).join('')}
          </div>
          <div class="row" style="justify-content:center;margin-top:24px"><a class="btn btn-primary btn-lg" href="#/exams">Start practising free ${arrow()}</a></div>
        </div>
      </section>

      <section class="section wrap band band-white">
        <div class="study-teaser reveal">
          <div>
            <span class="badge badge-success">Free</span>
            <h2 style="margin-top:12px">Official study material, in one place</h2>
            <p class="muted">Every NISM exam linked to NISM's free official workbook (always the latest version), plus official syllabus and notification pages for banking, SSC, MBA and insurance exams.</p>
            <a class="btn btn-primary" href="#/study-material">Browse study material ${arrow()}</a>
          </div>
          <div class="teaser-list">
            ${window.GROUPS.map((g) => `<a href="#/study-material?g=${encodeURIComponent(g.id)}"><span class="stat-ico">${icon(GROUP_ICON[g.id], 20)}</span><span><b>${esc(g.label)}</b><small>${esc(g.blurb)}</small></span>${icon('arrow', 16)}</a>`).join('')}
          </div>
        </div>
      </section>

      <section class="section wrap band band-blue">
        <div class="section-head reveal">
          <h2>Questions? We've got answers</h2>
        </div>
        <div class="faq">
          ${faqs.map(([q, a], i) => `<details class="reveal" style="--d:${i * 0.05}s" ${i === 0 ? 'open' : ''}><summary>${esc(q)}<span class="plus">${icon('plus', 16)}</span></summary><p>${esc(a)}</p></details>`).join('')}
        </div>
      </section>

      <section class="section wrap">
        <div class="cta-band reveal">
          <h2>Ready to ace your exam?</h2>
          <p>Try a free 3-question demo, then sign up free for full mock tests.</p>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#/test/v-a?demo=1">${icon('bolt', 18)} Start free demo</a>
            <a class="btn btn-lg" href="#/exams">Browse exams ${arrow()}</a>
          </div>
        </div>
      </section>`;

    bannerTracking($('#promo-indiabulls'));
    $$('.lp-tab').forEach((b) => b.addEventListener('click', () => {
      $$('.lp-tab').forEach((x) => x.classList.toggle('active', x === b));
      $('.hero-live').dataset.show = b.dataset.k;
    }));
    renderQotd($('#qotd-home'), qotdState().exam, true);

    let cat = 'All';
    const drawGrid = () => {
      // 4 × 4: up to 16 exams — popular ones first, then the rest of the category
      const pool = cat === 'All' ? EXAMS : EXAMS.filter((e) => e.group === cat);
      const list = [...pool.filter((e) => e.popular), ...pool.filter((e) => !e.popular)].filter((e) => !e.noindex).slice(0, 16);
      $('#home-grid').innerHTML = list.map((e, i) => examCard(e, i)).join('');
      enhance();
    };
    $$('#home-cats .cat-tab').forEach((b) => b.addEventListener('click', () => {
      cat = b.dataset.group;
      $$('#home-cats .cat-tab').forEach((x) => x.classList.toggle('active', x === b));
      drawGrid();
    }));
    drawGrid();
  }

  function heroQuiz(el) {
    const pool = shuffle(EXAMS.filter((e) => e.popular).flatMap((e) => questionsFor(e.id).map((q) => ({ ...q, exam: e }))));
    let i = 0, score = 0, done = 0;
    const draw = () => {
      const q = pool[i % pool.length];
      el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
      el.innerHTML = `
        <div class="quiz-top">
          <span class="badge">${icon('target', 13)} Try it · ${esc(examCode(q.exam))}</span>
          <span class="quiz-score">${icon('trophy', 14)} ${score}/${done}</span>
        </div>
        <div class="quiz-q">${esc(q.text)}</div>
        <div>${q.options.map((o, k) => `<button class="qopt" data-k="${k}"><span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="quiz-foot" hidden></div>`;
      $$('.qopt', el).forEach((b) => b.addEventListener('click', () => {
        const k = Number(b.dataset.k);
        const ok = k === q.answer;
        done++; if (ok) score++;
        $$('.qopt', el).forEach((x, j) => {
          x.disabled = true;
          if (j === q.answer) x.classList.add('right');
          else if (j === k) x.classList.add('wrong');
        });
        $('.quiz-score', el).innerHTML = `${icon('trophy', 14)} ${score}/${done}`;
        if (ok) {
          const p = document.createElement('span');
          p.className = 'plus-one'; p.textContent = '+1';
          el.appendChild(p); setTimeout(() => p.remove(), 1000);
        }
        const foot = $('.quiz-foot', el);
        foot.hidden = false;
        foot.innerHTML = `
          <div class="explain">${icon(ok ? 'check' : 'info', 16)}<div><b>${ok ? 'Correct!' : 'Not quite.'}</b> ${esc(q.explanation)}</div></div>
          <div class="row">
            <button class="btn btn-primary btn-sm" id="quiz-next">Next question ${arrow(16)}</button>
            <a class="btn btn-ghost btn-sm" href="#/exam/${q.exam.id}">Start a free ${esc(q.exam.series)} mock test</a>
          </div>`;
        $('#quiz-next', el).addEventListener('click', () => { i++; draw(); });
      }));
    };
    draw();
  }

  // ---------- catalog ----------
  function viewCatalog(initialQ, initialGroup, initialCat) {
    let group = window.GROUPS.some((g) => g.id === initialGroup) ? initialGroup : 'All';
    let cat = window.CATEGORIES.includes(initialCat) ? initialCat : 'All';
    if (cat !== 'All') group = 'NISM';
    let q = initialQ;
    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <h1>All exams</h1>
          <p>${EXAMS.length} exams across NISM, banking, SSC, MBA entrance and insurance &amp; finance — every one with exam-pattern mock tests.</p>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="toolbar">
          <div class="search-box">${icon('search', 18)}<input type="search" value="${esc(q)}" placeholder="Search by name or code, e.g. V-A, IBPS PO, CAT…" aria-label="Search exams"></div>
          <div class="cat-tabs" id="group-tabs">${groupTabs(group, true)}</div>
          <div class="chips" id="sub-chips"></div>
        </div>
        <div class="result-count" id="count"></div>
        <div class="grid" id="exam-grid"></div>
      </div>`;
    const drawChips = () => {
      $('#sub-chips').innerHTML = group === 'NISM'
        ? ['All', ...window.CATEGORIES].map((c) => `<button class="chip ${c === cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c === 'All' ? 'All NISM' : c)}</button>`).join('')
        : '';
      $$('#sub-chips .chip').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; drawChips(); draw(); }));
    };
    const draw = () => {
      const needle = q.toLowerCase().trim();
      const codeHit = (e) => (e.series.toLowerCase().includes(needle) ? 0 : 1);
      const list = EXAMS.filter((e) => (group === 'All' || e.group === group) && (group !== 'NISM' || cat === 'All' || e.category === cat) &&
        (`${examCode(e)} ${e.name} ${e.category} ${e.group}`.toLowerCase().includes(needle)))
        .sort((a, b) => (needle ? codeHit(a) - codeHit(b) : 0));
      const g = window.GROUPS.find((x) => x.id === group);
      $('#count').textContent = `Showing ${list.length} exam${list.length === 1 ? '' : 's'}${g ? ` in ${g.label}${group === 'NISM' && cat !== 'All' ? ' · ' + cat : ''}` : ''}`;
      $('#exam-grid').innerHTML = list.length ? list.map((e, i) => examCard(e, i)).join('')
        : `<div class="empty" style="grid-column:1/-1">${icon('search', 40)}<p style="margin-top:12px">No exams match “${esc(q)}”. Try a code like <b>VIII</b> or <b>IBPS</b>.</p></div>`;
      enhance();
    };
    $('.search-box input').addEventListener('input', (e) => { q = e.target.value; draw(); });
    $$('#group-tabs .cat-tab').forEach((b) => b.addEventListener('click', () => {
      group = b.dataset.group; cat = 'All';
      $$('#group-tabs .cat-tab').forEach((x) => x.classList.toggle('active', x === b));
      drawChips(); draw();
    }));
    drawChips();
    draw();
  }

  // ---------- study material ----------
  function viewStudy(initialGroup) {
    let group = window.GROUPS.some((g) => g.id === initialGroup) ? initialGroup : 'NISM';
    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <h1>Free study material</h1>
          <p>Official, free resources for every exam we cover — linked straight to the source so you always get the latest version.</p>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="cat-tabs" id="study-tabs">${window.GROUPS.map((g) => `<button class="cat-tab ${g.id === group ? 'active' : ''}" data-group="${esc(g.id)}">${esc(g.label)}</button>`).join('')}</div>
        <div id="study-body"></div>
      </div>`;
    const draw = () => {
      const list = EXAMS.filter((e) => e.group === group);
      const intro = group === 'NISM'
        ? `<div class="card study-hero">
            <span class="stat-ico" style="background:var(--brand-50);color:var(--brand)">${icon('file', 22)}</span>
            <div style="flex:1;min-width:220px">
              <h3 style="margin:0 0 4px">NISM free workbooks — official portal</h3>
              <p class="small muted" style="margin:0">NISM gives every certification workbook free of cost. Enter your name, email and phone on NISM's portal to view or download the latest version as a PDF.</p>
            </div>
            <a class="btn btn-primary" href="https://api.nism.ac.in/cmp/" target="_blank" rel="noopener noreferrer">${icon('external', 16)} Open NISM workbook portal</a>
          </div>`
        : `<div class="notice info" style="margin-bottom:16px">${icon('info', 16)}<span>Syllabus, exam pattern and notifications are published on each exam body's official website. Always check there for the latest notification before you apply.</span></div>`;
      $('#study-body').innerHTML = intro + `
        <div class="card table-wrap" style="padding:8px 20px">
          <table class="study-table">
            <tr><th>Exam</th><th>Official resources</th><th></th></tr>
            ${list.map((e) => `<tr>
              <td><b>${esc(examCode(e))}</b><div class="small muted">${esc(e.name)}</div>${e.note ? `<div class="small" style="color:var(--warn)">${esc(e.note)}</div>` : ''}</td>
              <td><div class="link-list">${(e.links || []).map((l) => extLink(l, 'link-pill')).join('')}</div></td>
              <td style="text-align:right"><a class="btn btn-sm" href="#/exam/${e.id}">Mock tests</a></td>
            </tr>`).join('')}
          </table>
        </div>
        <p class="small muted" style="margin-top:14px">Links go to official websites. Study material is © its publishers; Success4Sure does not host or alter it.</p>`;
    };
    $$('#study-tabs .cat-tab').forEach((b) => b.addEventListener('click', () => {
      group = b.dataset.group;
      $$('#study-tabs .cat-tab').forEach((x) => x.classList.toggle('active', x === b));
      draw();
    }));
    draw();
  }

  // ---------- exam detail ----------
  function viewExam(id) {
    const e = examById(id);
    if (!e) return viewNotFound();
    const c = CAT[e.category];
    const p = e.pattern;
    const u = currentUser();
    const sub = activeSub(meId(), e.id);
    const owned = testsIn(sub);
    const status = mockStatus(meId(), e.id);
    const done = Object.keys(status).length;
    const next = nextMock(status, owned);
    const chapters = chaptersFor(e.id);

    const tile = (k) => {
      const m = status[k];
      if (k > owned) return `<div class="mock-tile locked" title="Upgrade to unlock">${icon('lock', 14)}<b>Mock ${k}</b><span>Locked</span></div>`;
      return `<a class="mock-tile ${m ? (m.passed ? 'passed' : 'tried') : ''} ${k === next ? 'next' : ''}" href="#/test/${e.id}/${k}">
        <b>Mock ${k}</b><span>${m ? `Best ${m.best.toFixed(0)}%` : k === next ? 'Start now' : 'Not started'}</span></a>`;
    };

    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <a class="crumb" href="#/exams">${icon('back', 16)} All exams</a>
          <div class="exam-hero-top">
            <span class="big-ico">${icon(c.icon, 30)}</span>
            <div>
              <div class="hero-series">${esc(examCode(e))} · ${esc(e.group === 'NISM' ? e.category : groupOf(e).label)}</div>
              <h1 style="margin:6px 0 0">${esc(e.name)}</h1>
            </div>
          </div>
          <div class="pattern-pills">
            <span>${icon('book', 16)} ${p.questions} questions per test</span>
            <span>${icon('clock', 16)} ${p.duration} minutes</span>
            <span>${icon('target', 16)} ${p.passPct}% ${passWord(e)}</span>
            <span>${icon('minus', 16)} ${p.negative ? `${+(p.negative * 100).toFixed(1)}% negative marking` : 'No negative marking'}</span>
          </div>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        ${e.note ? `<div class="notice" style="margin-bottom:16px">${icon('info', 18)}<span>${esc(e.note)}</span></div>` : ''}
        <div class="detail">
          <div class="stack">
            ${sub ? `
              <div class="card reveal" id="mocks">
                <div class="row"><h3 style="margin:0">Your mock tests</h3><span class="spacer"></span><span class="small muted">${done} of ${owned} attempted</span></div>
                <div class="meter" style="margin-bottom:16px"><span style="width:${(done / owned) * 100}%"></span></div>
                <div class="mock-grid">${Array.from({ length: maxMocks(e) }, (_, i) => tile(i + 1)).join('')}</div>

              </div>` : ''}
            <div class="card reveal">
              <h3>Exam pattern</h3>
              <div class="spec">
                <div><b>${p.questions}</b><span>Questions</span></div>
                <div><b>${p.marks}</b><span>Total marks</span></div>
                <div><b>${p.duration} min</b><span>Duration</span></div>
                <div><b>${p.passPct}%</b><span>${groupOf(e).competitive ? 'Target score (cut-offs vary)' : 'Passing score'}</span></div>
              </div>
              <div class="notice" style="margin-top:16px">${icon('info', 18)}<span>Indicative pattern — always confirm the current pattern in the latest official notification before your exam.</span></div>
            </div>
            ${(e.links || []).length ? `<div class="card reveal">
              <div class="row"><h3 style="margin:0">Free study material</h3><span class="spacer"></span><span class="badge badge-success">Official</span></div>
              <div class="stack" style="margin-top:14px">${e.links.map((l) => extLink(l)).join('')}</div>
              ${e.group === 'NISM' ? '<p class="small muted" style="margin:12px 0 0">NISM provides the latest workbook free on its portal after a short registration.</p>' : ''}
            </div>` : ''}
            <div class="card reveal">
              <div class="row"><h3 style="margin:0">${e.group === 'NISM' ? 'Chapters covered' : 'Sections covered'}</h3><span class="spacer"></span><span class="badge">${chapters.length} chapters</span></div>
              <ul class="chapter-list" style="margin-top:12px">${chapters.map((ch) => `<li>${esc(ch)}</li>`).join('')}</ul>
            </div>
            <div class="card reveal">
              <h3>What you get</h3>
              <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:12px">
                ${[['grid', `${maxMocks(e)} free mock tests`, 'Retake any, any time'], ['book', `${p.questions} questions each`, 'Full-length, exam pattern'], ['bulb', 'Explanations', 'For every question'], ['chart', 'Analytics', 'Chapter-wise scores']]
                  .map(([ic, t, s2]) => `<div class="row" style="flex-wrap:nowrap"><span class="stat-ico" style="width:42px;height:42px">${icon(ic, 20)}</span><div><b style="font-size:.95rem">${t}</b><div class="small muted">${s2}</div></div></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="stack sticky">
              <div class="card access-card reveal">
                <div class="row"><span class="badge badge-success">${icon('check', 12)} Free</span></div>
                <h3 style="margin-top:12px">All ${owned} mock tests are free</h3>
                <div class="small muted" style="margin-bottom:16px">${done ? `${done} of ${owned} attempted` : `${p.questions} questions · ${p.duration} minutes each`}</div>
                ${next ? `<a class="btn btn-primary btn-lg btn-block" href="#/test/${e.id}/${next}">${icon('bolt', 18)} Start Mock Test ${next}</a>`
                  : `<a class="btn btn-lg btn-block" href="#mocks" onclick="document.getElementById('mocks').scrollIntoView({behavior:'smooth'});return false;">All tests attempted — retake any</a>`}
                <a class="btn btn-block" style="margin-top:10px" href="#/test/${e.id}?demo=1">Quick 3-question demo</a>
              </div>
              ${u ? '' : `<div class="card reveal small" style="--d:.1s">${icon('info', 16)} <b>Free account needed.</b> <span class="muted">Sign up in one click with Google to take the mock tests and keep your results on every device.</span><a class="btn btn-sm btn-block" style="margin-top:12px" href="#/login?next=${encodeURIComponent('/exam/' + e.id)}">Sign up free</a></div>`}
              ${e.slug ? `<div class="card reveal small" style="--d:.2s"><b>Free practice</b><div class="stack" style="margin-top:10px;gap:6px"><a href="/exams/${e.slug}/practice-questions/">${icon('book', 14)} ${esc(examCode(e))} practice questions</a><a href="/tools/exam-score-calculator/?exam=${e.id}">${icon('target', 14)} Score calculator</a></div></div>` : ''}
          </div>
        </div>
      </div>`;
  }

  // ---------- auth ----------
  function viewAuth(mode, next) {
    const isReg = mode === 'register';
    const other = isReg ? 'login' : 'register';
    const nextQs = next ? '?next=' + encodeURIComponent(next) : '';
    app.innerHTML = `
      <div class="wrap">
        <div class="auth reveal">
          <div class="auth-side">
            <h2>${isReg ? 'Start practising smarter today' : 'Welcome back, future achiever'}</h2>
            <p>${isReg ? 'Create your free account to subscribe to any exam and track your progress.' : 'Log in to continue your mock tests and see how far you\'ve come.'}</p>
            <ul>
              <li><span>${icon('clock', 18)}</span>Real exam-pattern mock tests</li>
              <li><span>${icon('bulb', 18)}</span>Explanations for every answer</li>
              <li><span>${icon('chart', 18)}</span>Chapter-wise performance</li>
              <li><span>${icon('phone', 18)}</span>Practise on any device</li>
            </ul>
          </div>
          <div class="auth-form">
            <h2 style="font-size:1.7rem">${isReg ? 'Create your account' : 'Log in'}</h2>
            <p class="muted">${isReg ? 'It takes less than a minute.' : 'Enter your details to continue.'}</p>
            <button type="button" class="btn btn-google btn-lg btn-block" id="google-btn"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>
            <div class="or-divider"><span>or use email</span></div>
            <form id="auth-form" novalidate>
              ${isReg ? `<label class="field"><span>Full name</span><div class="input-ico">${icon('user', 18)}<input name="name" autocomplete="name" placeholder="Your name" required></div></label>
              <label class="field"><span>Mobile number</span><div class="input-ico">${icon('phone', 18)}<input name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="10-digit mobile" required></div></label>` : ''}
              <label class="field"><span>Email</span><div class="input-ico">${icon('mail', 18)}<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div></label>
              <label class="field"><span>Password</span><div class="input-ico">${icon('lock', 18)}<input name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="6" placeholder="At least 6 characters" required></div></label>
              <div class="error" id="auth-error"></div>
              <button class="btn btn-primary btn-lg btn-block">${isReg ? 'Create account' : 'Log in'} ${arrow()}</button>
            </form>
            <p class="center small" style="margin-top:18px">${isReg ? 'Already have an account?' : 'New to Success4Sure?'} <a href="#/${other}${nextQs}"><b>${isReg ? 'Log in' : 'Create an account'}</b></a></p>
            <div class="notice info small">${icon('info', 16)}<span>Google sign-in is secure and works across devices. Email accounts are a prototype stored only in this browser.</span></div>
          </div>
        </div>
      </div>`;
    $('#google-btn').addEventListener('click', () => googleSignIn(next));
    $('#auth-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      const err = $('#auth-error');
      const email = (f.email || '').trim().toLowerCase();
      if (isReg && !(f.name || '').trim()) return (err.textContent = 'Please enter your name.');
      if (isReg && !/^[6-9]\d{9}$/.test(f.mobile || '')) return (err.textContent = 'Please enter a valid 10-digit mobile number.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return (err.textContent = 'Please enter a valid email.');
      if ((f.password || '').length < 6) return (err.textContent = 'Password must be at least 6 characters.');
      const list = users();
      const pw = await hashPw(f.password);
      let u;
      if (isReg) {
        if (list.some((x) => x.email === email)) return (err.textContent = 'An account with this email already exists.');
        u = { id: uid(), name: f.name.trim(), mobile: f.mobile, email, pw, created: Date.now() };
        store.set('users', [...list, u]);
      } else {
        u = list.find((x) => x.email === email && x.pw === pw);
        if (!u) return (err.textContent = 'Incorrect email or password.');
      }
      store.set('session', { userId: u.id });
      claimGuest(u.id);
      track(isReg ? 'sign_up' : 'login', { method: 'email' });
      toast(isReg ? `Welcome, ${u.name.split(' ')[0]}!` : 'Logged in');
      location.hash = '#' + (next || '/dashboard');
    });
  }

  // ---------- question of the day ----------
  // Free chapter questions live in js/data/free/<examId>.js (generated), loaded on demand.
  const FREE_V = ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '';
  const freeLoads = {};
  function loadFree(id) {
    if ((window.FREE_Q || {})[id]) return Promise.resolve(window.FREE_Q[id]);
    if (!freeLoads[id]) freeLoads[id] = new Promise((ok, fail) => {
      const tag = document.createElement('script');
      tag.src = `/js/data/free/${encodeURIComponent(id)}.js?v=${FREE_V}`;
      tag.onload = () => ((window.FREE_Q || {})[id] ? ok(window.FREE_Q[id]) : fail());
      tag.onerror = () => { delete freeLoads[id]; fail(); };
      document.head.appendChild(tag);
    });
    return freeLoads[id];
  }
  const istDay = (t = Date.now()) => Math.floor((t + 5.5 * 3600000) / DAY);
  const QOTD_EXAMS = () => EXAMS.filter((e) => e.free);
  function qotdState() {
    const st = store.get('qotd', {});
    const ok = QOTD_EXAMS();
    if (!st.exam || !ok.some((e) => e.id === st.exam)) st.exam = (ok.find((e) => e.id === 'v-a') || ok[0] || {}).id;
    st.days = st.days || {};
    return st;
  }
  function qotdStreak(st) {
    let n = 0, d = istDay();
    if (!(d in st.days)) d -= 1; // today not answered yet: streak still counts up to yesterday
    while (d in st.days) { n++; d--; }
    return n;
  }
  async function renderQotd(el, examId, compact) {
    if (!el) return;
    const ex = examById(examId);
    if (!ex || !ex.free) { el.innerHTML = ''; return; }
    let data;
    try { data = await loadFree(ex.id); } catch (e) { el.innerHTML = ''; return; }
    if (!el.isConnected) return;
    const day = istDay(), q = data.qs[day % data.qs.length];
    const st = qotdState(), key = `${day}:${ex.id}`, answered = st.answers && st.answers[key];
    const streak = qotdStreak(st);
    const opts = QOTD_EXAMS().map((e) => `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${esc(examCode(e))}</option>`).join('');
    const url = `https://success4sure.in/#/daily?exam=${ex.id}`;
    const shareText = `Question of the day (${examCode(ex)}): ${q[1]}\nCan you answer it? ${url}`;
    el.innerHTML = `
      <div class="qotd card">
        <div class="qotd-top">
          <div><span class="eyebrow">${icon('bolt', 14)} Question of the day</span><h2>${compact ? 'Your daily practice question' : esc(examCode(ex)) + ' — today\'s question'}</h2></div>
          <span class="spacer"></span>
          <label class="qotd-pick"><span class="sr-only">Exam</span><select id="qotd-exam">${opts}</select></label>
          <span class="qotd-streak" title="Days in a row">🔥 ${streak} day${streak === 1 ? '' : 's'}</span>
        </div>
        <div class="small muted">${esc(examCode(ex))} · ${esc(q[0])}</div>
        <p class="qotd-q">${esc(q[1])}</p>
        <div class="qotd-opts">${q[2].map((o, i) => `<button class="qopt" data-i="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('')}</div>
        <div class="qotd-foot" ${answered ? '' : 'hidden'}></div>
      </div>`;
    const foot = $('.qotd-foot', el);
    const reveal = (pick) => {
      $$('.qopt', el).forEach((b, i) => { b.disabled = true; b.classList.toggle('ok', i === q[3]); b.classList.toggle('chosen', i === pick && pick !== q[3]); });
      const right = pick === q[3];
      foot.hidden = false;
      foot.innerHTML = `<div class="notice ${right ? 'ok' : ''}">${right ? icon('check', 16) + ' Correct!' : icon('info', 16) + ` The answer is ${'ABCD'[q[3]]}.`} <span>${esc(q[4])}</span></div>
        <div class="row" style="margin-top:12px">
          <span class="small muted">New question every day at midnight.</span><span class="spacer"></span>
          <a class="btn btn-sm" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">Share on WhatsApp</a>
          <a class="btn btn-sm" href="/exams/${ex.slug}/practice-questions/">More free ${esc(examCode(ex))} questions</a>
          <a class="btn btn-primary btn-sm" href="#/test/${ex.id}?demo=1">Take a free demo test</a>
        </div>`;
    };
    if (answered) reveal(answered.pick);
    $$('.qopt', el).forEach((b) => b.addEventListener('click', () => {
      const pick = Number(b.dataset.i), s2 = qotdState();
      s2.answers = s2.answers || {};
      if (s2.answers[key]) return;
      s2.answers[key] = { pick, right: pick === q[3] };
      track('qotd_answer', { exam_id: ex.id, correct: pick === q[3] });
      s2.days[day] = true;
      // keep storage small: drop answers older than 60 days
      Object.keys(s2.answers).forEach((k) => { if (Number(k.split(':')[0]) < day - 60) delete s2.answers[k]; });
      Object.keys(s2.days).forEach((d) => { if (Number(d) < day - 400) delete s2.days[d]; });
      store.set('qotd', s2);
      $('.qotd-streak', el).textContent = `🔥 ${qotdStreak(s2)} day${qotdStreak(s2) === 1 ? '' : 's'}`;
      reveal(pick);
      if (pick === q[3]) toast(qotdStreak(s2) > 1 ? `${qotdStreak(s2)}-day streak — keep it going!` : 'Correct! Come back tomorrow for a new one.');
    }));
    $('#qotd-exam', el).addEventListener('change', (e) => {
      const s2 = qotdState(); s2.exam = e.target.value; store.set('qotd', s2);
      if (!compact) history.replaceState(null, '', '#/daily?exam=' + s2.exam);
      renderQotd(el, s2.exam, compact);
    });
  }
  function viewDaily(examId) {
    const st = qotdState();
    if (examId && examById(examId) && examById(examId).free) { st.exam = examId; store.set('qotd', st); }
    app.innerHTML = `<div class="wrap page"><div id="qotd-page"></div>
      <div class="card" style="margin-top:20px"><h3 style="margin-top:0">How the streak works</h3><p class="muted" style="margin:0">Answer one question a day for any exam to keep your streak alive. A new question appears every day at midnight (IST). Short daily practice adds up — 30 days is 30 more concepts revised.</p></div></div>`;
    renderQotd($('#qotd-page'), st.exam, false);
  }

  // ---------- dashboard ----------
  function viewDashboard() {
    if (!requireLogin()) return;
    const u = currentUser();
    const now = Date.now();
    const myAttempts = attempts().filter((a) => a.userId === u.id && a.submittedAt && !a.demo).sort((a, b) => b.submittedAt - a.submittedAt);
    const avg = myAttempts.length ? myAttempts.reduce((s, a) => s + a.result.pct, 0) / myAttempts.length : 0;
    const passes = myAttempts.filter((a) => a.result.passed).length;
    const practised = [...new Set(myAttempts.map((a) => a.examId))].filter((id) => examById(id));
    const byExam = Object.fromEntries(practised.map((id) => [id, true]));
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const suggest = EXAMS.filter((e) => e.popular && !byExam[e.id]).slice(0, 3);

    const kpi = (ic, bg, fg, val, label, count, suffix) => `<div class="kpi reveal"><span class="kpi-ico" style="background:${bg};color:${fg}">${icon(ic, 22)}</span><div><b ${count !== undefined ? `data-count="${count}" data-suffix="${suffix || ''}"` : ''}>${val}</b><span>${label}</span></div></div>`;

    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap welcome">
          <div>
            <h1>${greet}, ${esc(u.name.split(' ')[0])}!</h1>
            <p>${practised.length ? 'Keep the momentum going — every test gets you closer.' : 'Pick your first exam and start practising today — it is all free.'}</p>
          </div>
          <a class="btn btn-lg" href="#/exams">${icon('plus', 18)} Add an exam</a>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="dash-stats">
          ${kpi('grid', 'var(--brand-50)', 'var(--brand)', 0, 'Exams practised', practised.length)}
          ${kpi('clock', '#efe9ff', '#7a5af8', 0, 'Tests taken', myAttempts.length)}
          ${kpi('chart', '#e0f5fe', '#0284c7', 0, 'Average score', Math.round(avg), '%')}
          ${kpi('trophy', 'var(--success-soft)', 'var(--success)', 0, 'Tests passed', passes)}
        </div>

        <section style="margin-top:40px">
          ${practised.length ? `<div class="row" style="margin-bottom:18px"><h2 style="margin:0;font-size:1.5rem">Continue practising</h2><span class="spacer"></span><a class="btn btn-sm" href="#/exams">${icon('plus', 16)} Add an exam</a></div><div class="grid">${practised.slice(0, 6).map((id, i) => examProgressCard(id, i)).join('')}</div>`
            : `<div class="card center reveal" style="padding:48px 24px"><span class="stat-ico" style="margin:0 auto 14px;width:60px;height:60px">${icon('book', 28)}</span><h3>No tests taken yet</h3><p class="muted">Every exam has up to 30 free mock tests. Pick one and start.</p><a class="btn btn-primary" href="#/exams">Browse exams ${arrow()}</a></div>`}
        </section>

        <section style="margin-top:48px">
          <h2 style="font-size:1.5rem">Recent mock tests</h2>
          ${myAttempts.length ? `<div class="card table-wrap reveal" style="padding:8px 16px"><table>
            <tr><th>Date</th><th>Exam</th><th style="width:30%">Score</th><th>Result</th><th></th></tr>
            ${myAttempts.slice(0, 10).map((a) => {
              const e = examById(a.examId);
              return `<tr><td>${fmtDate(a.submittedAt)}</td><td><b>${esc(e.series)}${a.mockNo ? ` · Mock ${a.mockNo}` : ''}</b><div class="small muted">${esc(e.name)}</div></td>
                <td><div class="row" style="flex-wrap:nowrap"><div class="bar"><span class="${a.result.passed ? '' : 'low'}" data-w="${a.result.pct.toFixed(0)}"></span></div><b class="small">${a.result.pct.toFixed(0)}%</b></div></td>
                <td>${a.result.passed ? `<span class="badge badge-success">${icon('check', 12)} Pass</span>` : '<span class="badge badge-danger">Not yet</span>'}</td>
                <td><a class="btn btn-sm" href="#/result/${a.id}">Review</a></td></tr>`;
            }).join('')}
          </table></div>` : '<div class="card reveal muted">No tests taken yet. Your results will appear here.</div>'}
        </section>

        ${suggest.length ? `<section style="margin-top:48px">
          <h2 style="font-size:1.5rem">Popular with other learners</h2>
          <div class="grid">${suggest.map((e, i) => examCard(e, i)).join('')}</div>
        </section>` : ''}
      </div>`;
    requestAnimationFrame(() => setTimeout(() => $$('.bar > span[data-w]').forEach((s) => { s.style.width = s.dataset.w + '%'; }), 100));
  }

  // ---------- profile ----------
  function examProgressCard(id, i) {
    const e = examById(id), c = CAT[e.category], owned = maxMocks(e);
    const st = mockStatus(meId(), id), doneN = Object.keys(st).length, nx = nextMock(st, owned);
    const best = Math.max(0, ...Object.values(st).map((m) => m.best));
    return `<div class="exam-card sub-card reveal" style="--c:${c.color};--d:${i * 0.05}s">
      <div class="ec-top"><span class="ec-icon">${icon(c.icon, 24)}</span>${doneN ? `<span class="badge">Best ${best.toFixed(0)}%</span>` : ''}</div>
      <span class="series">${esc(examCode(e))}</span><h3>${esc(e.name)}</h3>
      <div class="meter"><span style="width:${(doneN / owned) * 100}%"></span></div>
      <span class="small muted">${doneN} of ${owned} mock tests attempted</span>
      <div style="margin-top:auto;padding-top:14px">${nx ? `<a class="btn btn-primary btn-block" href="#/test/${e.id}/${nx}">${icon('bolt', 16)} Start Mock Test ${nx}</a>` : `<a class="btn btn-block" href="#/exam/${e.id}">View all mock tests</a>`}</div>
    </div>`;
  }
  function subCard(u, s, i) {
    const now = Date.now();
    if (skillById(s.examId)) {
      const a = skillById(s.examId), active = s.end > now, left = Math.ceil((s.end - now) / DAY), d = areaDone(a);
      return `<div class="exam-card sub-card reveal" style="--c:${a.color};--d:${i * 0.05}s">
        <div class="ec-top"><span class="ec-icon">${icon(a.icon, 24)}</span>${active ? `<span class="badge">${left} day${left === 1 ? '' : 's'} left</span>` : '<span class="badge badge-danger">Expired</span>'}</div>
        <span class="series">Soft skills</span><h3>${esc(a.name)}</h3>
        <div class="meter"><span style="width:${(d / a.lessons.length) * 100}%"></span></div>
        <span class="small muted">${d} of ${a.lessons.length} lessons read · ${active ? 'valid until' : 'expired on'} ${fmtDate(s.end)}</span>
        <div style="margin-top:auto;padding-top:14px"><a class="btn ${active ? 'btn-primary' : ''} btn-block" href="${skillUrl(a)}">${active ? 'Continue learning' : 'Renew'}</a></div>
      </div>`;
    }
    const e = examById(s.examId);
    const c = CAT[e.category];
    const active = s.end > now;
    const left = Math.ceil((s.end - now) / DAY);
    const owned = testsIn(s);
    const st = mockStatus(u.id, e.id);
    const doneN = Object.keys(st).filter((k) => Number(k) <= owned).length;
    const nx = nextMock(st, owned);
    const pct = (doneN / owned) * 100;
    return `<div class="exam-card sub-card reveal" style="--c:${c.color};--d:${i * 0.05}s">
      <div class="ec-top"><span class="ec-icon">${icon(c.icon, 24)}</span>${active ? `<span class="badge">${left} day${left === 1 ? '' : 's'} left</span>` : '<span class="badge badge-danger">Expired</span>'}</div>
      <span class="series">${esc(examCode(e))}</span>
      <h3>${esc(e.name)}</h3>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <span class="small muted">${doneN} of ${owned} mock tests attempted · ${active ? 'valid until' : 'expired on'} ${fmtDate(s.end)}</span>
      <div style="margin-top:auto;padding-top:14px">${active
        ? (nx ? `<a class="btn btn-primary btn-block" href="#/test/${e.id}/${nx}">${icon('bolt', 16)} Start Mock Test ${nx}</a>`
              : `<a class="btn btn-block" href="#/exam/${e.id}">View all mock tests</a>`)
        : `<a class="btn btn-block" href="#/exam/${e.id}">${icon('refresh', 16)} Renew</a>`}</div>
    </div>`;
  }

  function viewProfile() {
    if (!requireLogin()) return;
    const u = currentUser();
    const now = Date.now();
    const mine = [];
    const practised = [...new Set(attempts().filter((a) => a.userId === u.id && a.submittedAt && !a.demo).map((a) => a.examId))].filter((id) => examById(id));
    const started = (window.SKILL_AREAS || []).filter((a) => a.lessons.some((l) => lessonProgress(a, l.id).read));
    const byExam = {};
    mine.forEach((s) => { if (!byExam[s.examId] || s.end > byExam[s.examId].end) byExam[s.examId] = s; });
    const current = Object.values(byExam).sort((a, b) => b.end - a.end);
    const history = [...mine].sort((a, b) => (b.created || b.start) - (a.created || a.start));
    const status = (s) => (s.upgradedTo ? '<span class="badge">Upgraded</span>' : s.end > now ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Expired</span>');
    const viaGoogle = (session() || {}).provider === 'google' || u.provider === 'google';
    app.innerHTML = `
      <div class="wrap page">
        <div class="card profile-card reveal">
          ${avatarHtml(u, 'avatar avatar-xl')}
          <div class="profile-info">
            <h1>${esc(u.name)}</h1>
            <p class="muted">${esc(u.email || '')}${u.mobile ? ` · ${esc(u.mobile)}` : ''}</p>
            <div class="row" style="gap:8px;margin-top:10px">
              <span class="badge">${viaGoogle ? 'Signed in with Google' : 'Email account (this browser only)'}</span>
              ${u.created ? `<span class="badge">Member since ${fmtDate(u.created)}</span>` : ''}
            </div>
          </div>
          <button class="btn" id="profile-logout">${icon('back', 16)} Log out</button>
        </div>

        <section style="margin-top:40px">
          <div class="row" style="margin-bottom:18px"><h2 style="margin:0;font-size:1.5rem">My exams</h2><span class="spacer"></span><a class="btn btn-sm" href="#/exams">${icon('plus', 16)} Add an exam</a></div>
          ${practised.length ? `<div class="grid">${practised.map((id, i) => examProgressCard(id, i)).join('')}</div>`
            : `<div class="card center reveal" style="padding:48px 24px"><span class="stat-ico" style="margin:0 auto 14px;width:60px;height:60px">${icon('book', 28)}</span><h3>No mock tests yet</h3><p class="muted">Every exam has free full-length mock tests. Your results will appear here.</p><a class="btn btn-primary" href="#/exams">Browse exams ${arrow()}</a></div>`}
        </section>
        ${started.length ? `<section style="margin-top:48px"><h2 style="font-size:1.5rem">My courses</h2><div class="grid">${started.map((a, i) => skillCard(a, i)).join('')}</div></section>` : ''}
      </div>`;
    $('#profile-logout').addEventListener('click', () => $('#logout').click());
  }

  // ---------- test engine ----------
  function viewTest(examId, demo, mockNo) {
    const e = examById(examId);
    if (!e) return viewNotFound();
    const u = currentUser();
    let sub = null;
    if (!demo) {
      if (!currentUser()) { toast('Sign up free to start full mock tests'); return requireLogin(); }
      sub = activeSub(meId(), e.id);
      if (!mockNo) mockNo = nextMock(mockStatus(meId(), e.id), testsIn(sub)) || 1;
      if (mockNo > testsIn(sub) || mockNo < 1) {
        toast(`There is no Mock Test ${mockNo} for this exam`);
        location.hash = '#/exam/' + e.id;
        return;
      }
    }
    const c = CAT[e.category];
    const pool = questionsFor(e.id);
    const p = e.pattern;
    const qs = demo ? shuffle(pool).slice(0, Math.min(3, pool.length)) : mockQuestions(e, mockNo);
    const n = qs.length;
    const totalSecs = Math.max(120, Math.round((p.duration * 60 * n) / p.questions));
    const mpq = p.marks / p.questions;

    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <a class="crumb" href="#/exam/${e.id}">${icon('back', 16)} ${esc(examCode(e))}</a>
          <div class="exam-hero-top">
            <span class="big-ico">${icon(c.icon, 30)}</span>
            <div><div class="hero-series">${demo ? 'Free demo test' : `Mock Test ${mockNo} of ${testsIn(sub)}`}</div><h1 style="margin:6px 0 0">${esc(e.name)}</h1></div>
          </div>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="card intro reveal">
          <div class="spec four">
            <div><b>${n}</b><span>Questions</span></div>
            <div><b>${Math.round(totalSecs / 60)} min</b><span>Time</span></div>
            <div><b>${p.passPct}%</b><span>${groupOf(e).competitive ? 'Target' : 'To pass'}</span></div>
            <div><b>${p.negative ? '−' + +(p.negative * mpq).toFixed(2) : 'None'}</b><span>Negative / wrong</span></div>
          </div>
          ${n < p.questions ? `<div class="notice info small" style="margin-top:16px">${icon('info', 16)}<span>${demo ? 'This demo is a short sample of the full test.' : `Prototype: each mock test will have ${p.questions} questions. The sample bank has only ${pool.length} so far, so this paper is shorter and the time is scaled to match.`}</span></div>` : ''}
          <ul class="rules">
            <li>${icon('grid', 18)}<span>Use the question palette to jump to any question.</span></li>
            <li>${icon('flag', 18)}<span>“Mark for review” lets you come back to a question later.</span></li>
            <li>${icon('clock', 18)}<span>The test submits automatically when the timer reaches zero.</span></li>
          </ul>
          <button class="btn btn-primary btn-lg btn-block" id="begin">${icon('bolt', 18)} Begin test</button>
        </div>
      </div>`;
    $('#begin').addEventListener('click', () => {
      track('mock_test_start', { exam_id: e.id, exam_name: examCode(e), mock_no: demo ? 0 : mockNo, demo: !!demo });
      runTest(e, qs, totalSecs, demo, u, mockNo);
    });
  }

  function runTest(e, qs, totalSecs, demo, u, mockNo) {
    const st = { i: 0, answers: {}, marked: {}, visited: { 0: true }, startedAt: Date.now() };
    const deadline = Date.now() + totalSecs * 1000;
    let submitted = false;
    window.scrollTo(0, 0);

    app.innerHTML = `
      <div class="test-top">
        <div class="wrap test-top-inner">
          <div><b>${esc(examCode(e))}</b><div class="small muted">${demo ? 'Free demo' : `Mock Test ${mockNo}`}</div></div>
          <div class="progress">
            <div class="progress-label"><span>Progress</span><span id="prog-label"></span></div>
            <div class="bar"><span id="prog-bar"></span></div>
          </div>
          <span class="timer" id="timer">${icon('clock', 18)}<span>--:--</span></span>
          <button class="btn btn-primary" id="submit">Submit</button>
        </div>
      </div>
      <div class="wrap test-layout">
        <div class="card" id="q-card"></div>
        <aside class="card">
          <h3>Question palette</h3>
          <div class="palette" id="palette"></div>
          <div class="legend">
            <span><i style="background:var(--success);border-color:var(--success)"></i>Answered</span>
            <span><i style="background:var(--violet);border-color:var(--violet)"></i>For review</span>
            <span><i style="background:var(--danger-soft);border-color:var(--danger)"></i>Skipped</span>
            <span><i></i>Not visited</span>
          </div>
        </aside>
      </div>`;

    const draw = (animate) => {
      const q = qs[st.i];
      const card = $('#q-card');
      if (animate) { card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); }
      card.innerHTML = `
        <div class="q-head"><span class="q-num">${st.i + 1}</span><span class="muted small">of ${qs.length}</span><span class="spacer"></span><span class="badge">${esc(q.chapter)}</span>${st.marked[q.id] ? `<span class="badge" style="background:#efe9ff;color:#7a5af8">${icon('flag', 12)} Marked</span>` : ''}</div>
        <div class="q-text">${esc(q.text)}</div>
        <div role="radiogroup">
        ${q.options.map((o, k) => `<label class="option ${st.answers[q.id] === k ? 'selected' : ''}"><input type="radio" name="opt" value="${k}" ${st.answers[q.id] === k ? 'checked' : ''}><span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></label>`).join('')}
        </div>
        <div class="q-actions">
          <button class="btn" id="prev" ${st.i === 0 ? 'disabled' : ''}>${icon('back', 16)} Previous</button>
          <button class="btn btn-ghost" id="clear">Clear</button>
          <span class="spacer"></span>
          <button class="btn" id="mark">${icon('flag', 16)} ${st.marked[q.id] ? 'Unmark' : 'Mark for review'}</button>
          <button class="btn btn-primary" id="next">${st.i === qs.length - 1 ? 'Finish' : 'Save & next'} ${arrow(16)}</button>
        </div>`;
      $$('input[name=opt]').forEach((r) => r.addEventListener('change', () => { st.answers[q.id] = Number(r.value); draw(false); }));
      $('#prev').addEventListener('click', () => go(st.i - 1));
      $('#next').addEventListener('click', () => go(st.i + 1));
      $('#clear').addEventListener('click', () => { delete st.answers[q.id]; draw(false); });
      $('#mark').addEventListener('click', () => { st.marked[q.id] = !st.marked[q.id]; draw(false); });
      $('#palette').innerHTML = qs.map((x, k) => {
        const cls = ['pal-btn', st.answers[x.id] !== undefined && 'answered', st.marked[x.id] && 'marked', st.visited[k] && 'visited', k === st.i && 'current'].filter(Boolean).join(' ');
        return `<button class="${cls}" data-k="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`;
      }).join('');
      $$('.pal-btn').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.k))));
      const answered = Object.keys(st.answers).length;
      $('#prog-label').textContent = `${answered}/${qs.length} answered`;
      $('#prog-bar').style.width = (answered / qs.length) * 100 + '%';
    };
    const go = (k) => {
      if (k >= qs.length) return confirmSubmit();
      if (k < 0) return;
      st.i = k; st.visited[k] = true; draw(true);
    };

    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      const t = $('#timer');
      if (!t) return;
      const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
      $('span', t).textContent = (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      t.classList.toggle('low', left <= 60);
      if (left === 0) { toast("Time's up — submitting your test"); submit(); }
    };
    const timer = setInterval(tick, 1000);
    const warn = (ev) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    cleanup = () => { clearInterval(timer); window.removeEventListener('beforeunload', warn); };

    function confirmSubmit() {
      const answered = Object.keys(st.answers).length;
      const marked = Object.values(st.marked).filter(Boolean).length;
      modal(`
        <span class="stat-ico" style="width:56px;height:56px;margin-bottom:14px">${icon('flag', 26)}</span>
        <h2 style="font-size:1.5rem">Submit your test?</h2>
        <div class="spec" style="grid-template-columns:repeat(3,1fr);margin:16px 0 20px">
          <div><b style="color:var(--success)">${answered}</b><span>Answered</span></div>
          <div><b style="color:var(--danger)">${qs.length - answered}</b><span>Unanswered</span></div>
          <div><b style="color:var(--violet)">${marked}</b><span>For review</span></div>
        </div>
        <div class="row"><button class="btn" data-close style="flex:1">Keep working</button><button class="btn btn-primary" data-ok style="flex:1">Submit ${arrow(16)}</button></div>`,
      (m, close) => {
        $('[data-close]', m).addEventListener('click', close);
        $('[data-ok]', m).addEventListener('click', () => { close(); submit(); });
      });
    }

    function submit() {
      if (submitted) return;
      submitted = true;
      cleanup && cleanup(); cleanup = null;
      const p = e.pattern;
      const mpq = p.marks / p.questions;
      let correct = 0, wrong = 0;
      const chapters = {};
      qs.forEach((q) => {
        const c = (chapters[q.chapter] ||= { total: 0, correct: 0 });
        c.total++;
        const a = st.answers[q.id];
        if (a === undefined) return;
        if (a === q.answer) { correct++; c.correct++; } else wrong++;
      });
      const max = qs.length * mpq;
      const score = correct * mpq - wrong * mpq * p.negative;
      const pct = Math.max(0, (score / max) * 100);
      const attempt = {
        id: uid(), userId: meId(), examId: e.id, demo, mockNo: demo ? null : mockNo,
        questionIds: qs.map((q) => q.id), answers: st.answers,
        startedAt: st.startedAt, submittedAt: Date.now(),
        result: { correct, wrong, unanswered: qs.length - correct - wrong, score, max, pct, passed: pct >= p.passPct, chapters },
      };
      store.set('attempts', [...attempts(), attempt]);
      track('mock_test_complete', { exam_id: e.id, exam_name: examCode(e), mock_no: demo ? 0 : mockNo, demo: !!demo,
        score_pct: Math.round(pct), passed: pct >= p.passPct, answered: correct + wrong, total_questions: qs.length });
      sessionStorageSafeSet('s4s_celebrate', attempt.id);
      location.hash = '#/result/' + attempt.id;
    }

    $('#submit').addEventListener('click', confirmSubmit);
    draw(true);
    tick();
  }

  function sessionStorageSafeSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  function sessionStorageSafeTake(k) {
    let v = null;
    try { v = sessionStorage.getItem(k); sessionStorage.removeItem(k); } catch (e) { v = mem[k] || null; }
    delete mem[k];
    return v;
  }

  // ---------- results ----------
  function resultActions(a, e) {
    const sub = activeSub(meId(), e.id);
    if (!a.mockNo) return `<a class="btn btn-primary" href="#/test/${e.id}/1">Take full Mock Test 1 — free ${arrow()}</a><a class="btn" href="#/exam/${e.id}">All mock tests</a>`;
    const owned = testsIn(sub);
    const nx = nextMock(mockStatus(meId(), e.id), owned);
    return [
      nx ? `<a class="btn btn-primary" href="#/test/${e.id}/${nx}">Next: Mock Test ${nx} ${arrow()}</a>` : '',
      `<a class="btn" href="#/test/${e.id}/${a.mockNo}">${icon('refresh', 16)} Retake Mock ${a.mockNo}</a>`,
      `<a class="btn btn-ghost" href="#/exam/${e.id}">All mock tests</a>`,
    ].join('');
  }

  function viewResult(id) {
    const a = attempts().find((x) => x.id === id);
    if (!a) return viewNotFound();
    const e = examById(a.examId);
    const r = a.result;
    const byId = allQuestionsById(a.examId);
    const mins = Math.max(1, Math.round((a.submittedAt - a.startedAt) / 60000));
    const R = 68, C = 2 * Math.PI * R;
    let filter = 'all';

    app.innerHTML = `
      <section class="page-hero result-hero ${r.passed ? 'pass' : ''}">
        <div class="wrap">
          <a class="crumb" href="#/exam/${e.id}">${icon('back', 16)} ${esc(examCode(e))}</a>
          <div class="result-head">
            <div class="ring">
              <svg width="160" height="160" viewBox="0 0 160 160"><circle class="track" cx="80" cy="80" r="${R}"/><circle class="val" id="ring-val" cx="80" cy="80" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
              <div class="ring-label"><div><b data-count="${Math.round(r.pct)}" data-suffix="%">0%</b><small>your score</small></div></div>
            </div>
            <div>
              <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">${r.passed ? `${icon('trophy', 12)} ${groupOf(e).competitive ? 'TARGET MET' : 'PASSED'}` : 'NOT YET'}</span>
              <h1 style="margin:10px 0 6px">${r.passed ? (groupOf(e).competitive ? 'Brilliant — target score reached!' : 'Brilliant — you passed!') : 'Good effort — keep going!'}</h1>
              <p>${a.demo ? 'Free demo · ' : a.mockNo ? `Mock Test ${a.mockNo} · ` : ''}${esc(examCode(e))} · ${groupOf(e).competitive ? 'target' : 'pass mark'} ${e.pattern.passPct}% · ${r.passed ? 'You\'re on track for the real exam.' : 'Review the explanations below and try again.'}</p>
              <div class="row">
                ${a.demo
                  ? `<a class="btn btn-primary" href="#/exam/${e.id}">Unlock full mock tests ${arrow()}</a>`
                  : resultActions(a, e)}
              </div>
            </div>
          </div>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="kpis">
          <div class="kpi reveal"><span class="kpi-ico" style="background:var(--brand-50);color:var(--brand)">${icon('target', 22)}</span><div><b>${r.score.toFixed(2)}/${r.max}</b><span>Marks scored</span></div></div>
          <div class="kpi reveal" style="--d:.05s"><span class="kpi-ico" style="background:var(--success-soft);color:var(--success)">${icon('check', 22)}</span><div><b>${r.correct}</b><span>Correct</span></div></div>
          <div class="kpi reveal" style="--d:.1s"><span class="kpi-ico" style="background:var(--danger-soft);color:var(--danger)">${icon('x', 22)}</span><div><b>${r.wrong}</b><span>Wrong${e.pattern.negative ? ' (−ve marked)' : ''}</span></div></div>
          <div class="kpi reveal" style="--d:.15s"><span class="kpi-ico" style="background:#efe9ff;color:#7a5af8">${icon('clock', 22)}</span><div><b>${mins} min</b><span>${r.unanswered} unanswered</span></div></div>
        </div>

        <section style="margin-top:40px">
          <h2 style="font-size:1.5rem">Chapter-wise performance</h2>
          <div class="card reveal" style="padding:8px 20px">
            <div class="table-wrap"><table>
              <tr><th>Chapter</th><th>Score</th><th style="width:45%">Accuracy</th></tr>
              ${Object.entries(r.chapters).map(([ch, v]) => {
                const pc = Math.round((v.correct / v.total) * 100);
                return `<tr><td><b>${esc(ch)}</b></td><td>${v.correct}/${v.total}</td><td><div class="row" style="flex-wrap:nowrap"><div class="bar"><span class="${pc < 50 ? 'low' : ''}" data-w="${pc}"></span></div><b class="small" style="width:40px;text-align:right">${pc}%</b></div></td></tr>`;
              }).join('')}
            </table></div>
          </div>
        </section>

        <section style="margin-top:40px">
          <h2 style="font-size:1.5rem">Answer review</h2>
          <div class="tabs" id="review-tabs">
            <button class="tab active" data-f="all">All (${a.questionIds.length})</button>
            <button class="tab" data-f="wrong">Wrong (${r.wrong})</button>
            <button class="tab" data-f="skipped">Unanswered (${r.unanswered})</button>
            <button class="tab" data-f="correct">Correct (${r.correct})</button>
          </div>
          <div id="review-list"></div>
        </section>
      </div>`;

    const drawReview = () => {
      const items = a.questionIds.map((qid, k) => {
        const q = byId[qid];
        if (!q) return '';
        const mine = a.answers[qid];
        const state = mine === undefined ? 'skipped' : mine === q.answer ? 'correct' : 'wrong';
        if (filter !== 'all' && filter !== state) return '';
        const label = { skipped: '<span class="badge badge-warn">Unanswered</span>', correct: `<span class="badge badge-success">${icon('check', 12)} Correct</span>`, wrong: `<span class="badge badge-danger">${icon('x', 12)} Wrong</span>` }[state];
        return `<div class="review-item ${state}">
          <div class="row small muted"><b>Q${k + 1}</b><span>${esc(q.chapter)}</span><span class="spacer"></span>${label}</div>
          <p style="font-weight:700;margin:10px 0">${esc(q.text)}</p>
          ${q.options.map((o, j) => `<div class="opt ${j === q.answer ? 'right' : ''} ${j === mine && j !== q.answer ? 'mine-wrong' : ''}"><span class="letter">${LETTERS[j]}</span><span>${esc(o)}${j === mine ? ' <span class="small muted">· your answer</span>' : ''}</span></div>`).join('')}
          <div class="explain">${icon('bulb', 16)}<div><b>Explanation:</b> ${esc(q.explanation)}</div></div>
        </div>`;
      }).join('');
      $('#review-list').innerHTML = items || '<div class="card center muted">Nothing here — nice!</div>';
    };
    $$('#review-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.f;
      $$('#review-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      drawReview();
    }));
    drawReview();

    requestAnimationFrame(() => setTimeout(() => {
      const ring = $('#ring-val');
      if (ring) ring.style.strokeDashoffset = C * (1 - r.pct / 100);
      $$('.bar > span[data-w]').forEach((s) => { s.style.width = s.dataset.w + '%'; });
    }, 150));
    if (r.passed && sessionStorageSafeTake('s4s_celebrate') === a.id) setTimeout(confetti, 500);
  }

  // ---------- soft skills ----------
  const SKILLS = window.SKILL_AREAS || [];
  const skillBySlug = (slug) => SKILLS.find((a) => a.slug === slug);
  const skillById = (id) => SKILLS.find((a) => a.id === id);
  const productById = (id) => examById(id) || skillById(id);
  const TRACK_LABEL = { core: 'Everyone', fresher: 'Freshers', professional: 'Finance professionals' };
  const progressKey = () => (currentUser() ? currentUser().id : 'guest');
  function lessonProgress(area, lessonId) {
    return (store.get('skill_progress', {})[progressKey()] || {})[area.slug + '/' + lessonId] || {};
  }
  function saveLessonProgress(area, lessonId, patch) {
    const all = store.get('skill_progress', {});
    const mine = all[progressKey()] || (all[progressKey()] = {});
    const key = area.slug + '/' + lessonId;
    if (patch.read && !(mine[key] || {}).read) track('lesson_complete', { course: area.slug, lesson: lessonId });
    mine[key] = { ...(mine[key] || {}), ...patch };
    store.set('skill_progress', all);
  }
  const skillAccess = () => true;
  const lessonFree = (i) => i === 0;
  const canOpenLesson = (area, i) => lessonFree(i) || skillAccess(area);
  const areaDone = (area) => area.lessons.filter((l) => lessonProgress(area, l.id).read).length;
  const scenarioCount = (area) => area.lessons.reduce((s, l) => s + (l.scenarios ? l.scenarios.length : l.nScen || 0), 0);
  // Lesson bodies live in one file per course (js/data/softskills/<slug>.js), fetched the first time a lesson is opened.
  const SKILL_DATA_V = ((document.querySelector('script[src*="softskills.js"]') || {}).src || '').split('v=')[1] || '';
  function withFullCourse(a) {
    app.innerHTML = '<div class="wrap page"><p class="muted">Loading lesson…</p></div>';
    const tag = document.createElement('script');
    tag.src = `/js/data/softskills/${a.slug}.js?v=${SKILL_DATA_V}`;
    tag.onload = () => {
      const full = (window.SKILL_FULL || {})[a.slug];
      if (!full) { app.innerHTML = '<div class="wrap page"><p class="muted">Sorry, this lesson could not be loaded.</p></div>'; return; }
      a.lessons = full; a.full = true; route();
    };
    tag.onerror = () => { app.innerHTML = `<div class="wrap page"><div class="card center"><p>Couldn't load this lesson. Check your connection and try again.</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></div></div>`; };
    document.head.appendChild(tag);
  }
  const skillUrl = (a, ...rest) => '#/skills/' + [a.slug, ...rest].join('/');

  function skillCard(a, i = 0) {
    const n = a.lessons.length, done = areaDone(a);
    return `<a class="exam-card reveal" style="--c:${a.color};--d:${Math.min(i, 8) * 0.05}s" href="${skillUrl(a)}">
      <div class="ec-top"><span class="ec-icon">${icon(a.icon, 24)}</span>${skillAccess(a) ? '<span class="badge badge-success">Free</span>' : '<span class="badge">First lesson free</span>'}</div>
      <span class="series">Soft skills</span>
      <h3>${esc(a.name)}</h3>
      <p class="small muted" style="margin:2px 0 0">${esc(a.blurb)}</p>
      <div class="ec-meta"><span>${icon('book', 14)} ${n} lessons</span><span>${icon('target', 14)} ${n * 10} quiz Qs</span><span>${icon('flag', 14)} ${scenarioCount(a)} scenarios</span></div>
      ${done ? `<div class="meter"><span style="width:${(done / n) * 100}%"></span></div>` : ''}
      <div class="ec-foot"><span class="badge badge-success">Free</span><span class="ec-arrow">${arrow(16)}</span></div>
    </a>`;
  }

  function viewSkills() {
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <span class="badge">New</span>
        <h1 style="margin-top:10px">Soft skills for your career</h1>
        <p>${SKILLS.length} courses of short lessons, quizzes and real workplace scenarios to improve how you communicate, interview, present yourself and work with others — with tracks for freshers and finance professionals.</p>
      </div></section>
      <div class="wrap page" style="padding-top:0">
        ${SKILLS.length ? (window.SKILL_GROUPS || [{ id: null, label: '' }]).map((g) => {
          const list = SKILLS.filter((a) => !g.id || a.group === g.id);
          return list.length ? `<section class="skill-group"><div class="row" style="align-items:baseline;gap:10px;margin-bottom:14px"><h2 style="font-size:1.4rem;margin:0">${esc(g.label)}</h2><span class="small muted">${esc(g.blurb || '')}</span></div><div class="grid">${list.map(skillCard).join('')}</div></section>` : '';
        }).join('') : '<div class="card muted">Lessons are being prepared.</div>'}
        <section style="margin-top:56px">
          <h2 style="font-size:1.5rem">How it works</h2>
          <div class="steps">
            <div class="step reveal"><div class="step-num">${icon('book', 22)}<em>1</em></div><h3>Read a short lesson</h3><p>5–8 minute lessons with examples, sample phrases and do's and don'ts.</p></div>
            <div class="step reveal" style="--d:.1s"><div class="step-num">${icon('target', 22)}<em>2</em></div><h3>Check yourself</h3><p>A 10-question quiz after every lesson, with an explanation for each answer.</p></div>
            <div class="step reveal" style="--d:.2s"><div class="step-num">${icon('flag', 22)}<em>3</em></div><h3>Practise real situations</h3><p>Choose what you'd say in realistic workplace scenarios and see why it works — or doesn't.</p></div>
          </div>
        </section>
        <section style="margin-top:48px">
          <div class="card coach-teaser reveal">
            <span class="stat-ico" style="background:var(--brand-50);color:var(--brand)">${icon('sparkle', 22)}</span>
            <div style="flex:1;min-width:220px"><div class="row" style="gap:8px"><h3 style="margin:0">AI Coach</h3><span class="badge badge-warn">Coming soon</span></div>
              <p class="small muted" style="margin:6px 0 0">Type your answer to "Tell me about yourself", a client email or an objection, and get personal feedback with an improved version.</p></div>
            <a class="btn" href="#/coach">See how it works ${arrow(16)}</a>
          </div>
        </section>
      </div>`;
  }

  function viewSkillArea(slug) {
    const a = skillBySlug(slug);
    if (!a) return viewNotFound();
    const u = currentUser();
    let track = 'all';
    const nextIdx = a.lessons.findIndex((l) => !lessonProgress(a, l.id).read);
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <a class="crumb" href="#/skills">${icon('back', 16)} Soft skills</a>
        <div class="exam-hero-top">
          <span class="big-ico" style="background:color-mix(in srgb, ${a.color} 12%, transparent);color:${a.color}">${icon(a.icon, 30)}</span>
          <div><div class="hero-series">Soft skills · ${a.lessons.length} lessons · ${a.lessons.length * 10} quiz questions · ${scenarioCount(a)} scenarios</div><h1 style="margin:6px 0 0">${esc(a.name)}</h1></div>
        </div>
        <p style="margin-top:14px">${esc(a.blurb)}</p>
      </div></section>
      <div class="wrap page" style="padding-top:0">
        ${a.note ? `<div class="notice" style="margin-bottom:16px">${icon('info', 16)}<span>${esc(a.note)}</span></div>` : ''}
        <div class="detail">
          <div class="stack">
            <div class="card">
              <div class="row"><h3 style="margin:0">Lessons</h3><span class="spacer"></span><span class="small muted">${areaDone(a)} of ${a.lessons.length} read</span></div>
              <div class="tabs" id="track-tabs" style="margin-top:12px">${['all', 'core', 'fresher', 'professional'].map((t) => `<button class="tab ${t === 'all' ? 'active' : ''}" data-t="${t}">${t === 'all' ? 'All lessons' : TRACK_LABEL[t]}</button>`).join('')}</div>
              <div id="lesson-list"></div>
            </div>
          </div>
          <div class="stack sticky">
              <div class="card access-card">
                <span class="badge badge-success">${icon('check', 12)} Free course</span>
                <h3 style="margin-top:12px">All ${a.lessons.length} lessons are free</h3>
                <div class="meter"><span style="width:${(areaDone(a) / a.lessons.length) * 100}%"></span></div>
                <div class="small muted" style="margin-bottom:16px">${areaDone(a)} of ${a.lessons.length} read · ${a.lessons.length * 10} quiz questions · ${scenarioCount(a)} scenarios</div>
                <a class="btn btn-primary btn-lg btn-block" href="${skillUrl(a, a.lessons[nextIdx < 0 ? 0 : nextIdx].id)}">${icon('book', 18)} ${nextIdx < 0 ? 'Review lessons' : areaDone(a) ? 'Continue learning' : 'Start learning'}</a>
              </div>
              ${u ? '' : `<div class="card small">${icon('info', 16)} <b>Free account needed.</b> <span class="muted">Sign up in one click with Google to read the lessons and keep your progress.</span><a class="btn btn-sm btn-block" style="margin-top:12px" href="#/login?next=${encodeURIComponent('/skills/' + a.slug)}">Sign up free</a></div>`}
          </div>
        </div>
      </div>`;
    const drawList = () => {
      $('#lesson-list').innerHTML = a.lessons.map((l, i) => ({ l, i })).filter(({ l }) => track === 'all' || l.track === track).map(({ l, i }) => {
        const open = canOpenLesson(a, i), p = lessonProgress(a, l.id);
        return `<a class="lesson-row ${open ? '' : 'locked'}" href="${skillUrl(a, l.id)}">
          <span class="lesson-num ${p.read ? 'done' : ''}">${p.read ? icon('check', 16) : i + 1}</span>
          <span class="lesson-main"><b>${esc(l.title)}</b><span class="small muted">${l.minutes} min read · ${TRACK_LABEL[l.track]}${p.quizBest != null ? ` · quiz best ${p.quizBest}%` : ''}</span></span>
          ${arrow(16)}
        </a>`;
      }).join('') || '<p class="muted small">No lessons in this track.</p>';
    };
    $$('#track-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      track = b.dataset.t;
      $$('#track-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      drawList();
    }));
    drawList();
  }

  function lessonSection(s) {
    const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `<section class="lesson-sec"><h2>${esc(s.heading)}</h2>${String(s.body).split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${s.do || s.dont ? `<div class="dodont">${s.do ? `<div class="do"><b>${icon('check', 14)} Do</b>${list(s.do)}</div>` : ''}${s.dont ? `<div class="dont"><b>${icon('x', 14)} Don't</b>${list(s.dont)}</div>` : ''}</div>` : ''}</section>`;
  }

  function findLesson(slug, lessonId) {
    const a = skillBySlug(slug);
    const i = a ? a.lessons.findIndex((l) => l.id === lessonId) : -1;
    return i < 0 ? null : { a, i, l: a.lessons[i] };
  }

  // Bite-size card player: one idea per card, story-style progress, swipe/tap/keys to move.
  function viewLessonCards(a, i, l) {
    const cards = l.cards;
    let k = 0;
    const ticked = new Set();
    const next = a.lessons[i + 1];
    const cardHtml = (c) => {
      const body = c.text ? `<p class="lc-text">${esc(c.text)}</p>` : '';
      if (c.kind === 'compare') return body + `
        <div class="lc-compare">
          <div class="lc-bad"><span>${icon('x', 14)} Instead of</span><p>${esc(c.bad)}</p></div>
          <div class="lc-good"><span>${icon('check', 14)} Try</span><p>${esc(c.good)}</p></div>
        </div>`;
      if (c.kind === 'tip') return body + (c.example ? `<div class="lc-good"><span>${icon('check', 14)} Example</span><p>${esc(c.example)}</p></div>` : '');
      if (c.kind === 'checklist') return body + `
        <div class="lc-checklist">${c.items.map((it, j) => `<button class="lc-check ${ticked.has(j) ? 'on' : ''}" data-j="${j}"><span class="lc-box">${icon('check', 14)}</span><span>${esc(it)}</span></button>`).join('')}</div>
        ${c.tip ? `<div class="lc-tip">${icon('info', 16)}<span>${esc(c.tip)}</span></div>` : ''}`;
      if (c.kind === 'recap') return body + `
        <ol class="lc-recap">${l.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
        <div class="lc-actions">
          <a class="btn btn-primary btn-block" href="${skillUrl(a, l.id, 'quiz')}">${icon('target', 16)} Take the 2-minute quiz</a>
          <a class="btn btn-block" href="${skillUrl(a, l.id, 'scenario', 0)}">${icon('flag', 16)} Practise a real scenario</a>
          ${next ? `<a class="btn btn-ghost btn-block" href="${skillUrl(a, next.id)}">Next lesson: ${esc(next.title)} ${arrow(16)}</a>` : ''}
        </div>`;
      return body;
    };
    app.innerHTML = `
      <div class="lc-wrap">
        <div class="lc-top">
          <div class="lc-progress">${cards.map((_, j) => `<span data-j="${j}"><i></i></span>`).join('')}</div>
          <div class="lc-meta"><a href="${skillUrl(a)}" class="lc-close" aria-label="Close lesson">${icon('x', 18)}</a><span class="small muted">${esc(l.title)}</span><span class="spacer"></span><a class="small lc-article" href="${skillUrl(a, l.id)}?view=article">Full article</a></div>
        </div>
        ${a.note ? `<div class="lc-tip" style="margin-bottom:12px">${icon('info', 16)}<span>${esc(a.note)}</span></div>` : ''}
        <div class="lc-stage" id="lc-stage" aria-live="polite"></div>
        <div class="lc-nav">
          <button class="btn" id="lc-prev">${icon('back', 16)} Back</button>
          <span class="small muted" id="lc-count"></span>
          <button class="btn btn-primary" id="lc-next">Next ${arrow(16)}</button>
        </div>
      </div>`;
    const stage = $('#lc-stage');
    const draw = (dir = 0) => {
      const c = cards[k];
      stage.innerHTML = `<article class="lc-card ${c.kind === 'intro' || c.kind === 'recap' ? 'lc-hero' : ''} ${dir > 0 ? 'in-right' : dir < 0 ? 'in-left' : ''}">
          <span class="lc-icon">${icon(c.icon || 'book', 22)}</span>
          ${c.kind === 'intro' ? `<div class="small lc-kicker">${l.minutes > 3 ? '2-minute lesson' : 'Quick lesson'} · ${cards.length} cards</div>` : ''}
          <h2>${esc(c.title)}</h2>
          ${cardHtml(c)}
        </article>`;
      $$('.lc-progress span').forEach((s, j) => s.className = j < k ? 'done' : j === k ? 'now' : '');
      $('#lc-count').textContent = `${k + 1} / ${cards.length}`;
      $('#lc-prev').disabled = k === 0;
      $('#lc-next').hidden = k === cards.length - 1;
      $$('.lc-check', stage).forEach((b) => b.addEventListener('click', () => {
        const j = Number(b.dataset.j);
        ticked.has(j) ? ticked.delete(j) : ticked.add(j);
        b.classList.toggle('on');
        if (ticked.size === cards[k].items.length) toast('All checked — ready to send!');
      }));
      if (k === cards.length - 1) { saveLessonProgress(a, l.id, { read: true }); }
    };
    const go = (d) => { const n = k + d; if (n < 0 || n >= cards.length) return; k = n; draw(d); };
    $('#lc-next').addEventListener('click', () => go(1));
    $('#lc-prev').addEventListener('click', () => go(-1));
    $$('.lc-progress span').forEach((s) => s.addEventListener('click', () => { const j = Number(s.dataset.j); if (j !== k) { const d = j > k ? 1 : -1; k = j; draw(d); } }));
    // Tap the left/right edge of the card, or swipe, like stories.
    stage.addEventListener('click', (ev) => {
      if (ev.target.closest('a, button')) return;
      const r = stage.getBoundingClientRect();
      const x = ev.clientX - r.left;
      if (x > r.width * 0.65) go(1); else if (x < r.width * 0.35) go(-1);
    });
    let sx = null, sy = null;
    stage.addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', (ev) => {
      if (sx == null) return;
      const dx = ev.changedTouches[0].clientX - sx, dy = ev.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      sx = null;
    }, { passive: true });
    const onKey = (ev) => { if (ev.key === 'ArrowRight') go(1); if (ev.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', onKey);
    cleanup = () => document.removeEventListener('keydown', onKey);
    draw();
  }

  function viewLesson(slug, lessonId, view) {
    const f = findLesson(slug, lessonId);
    if (!f) return viewNotFound();
    if (!currentUser()) { toast('Sign up free to read the lessons'); return requireLogin(); }
    if (!f.a.full) return withFullCourse(f.a);
    const { a, i, l } = f;
    const open = canOpenLesson(a, i);
    if (open && l.cards && l.cards.length && view !== 'article') return viewLessonCards(a, i, l);
    const next = a.lessons[i + 1];
    const practice = `
      <section class="lesson-sec"><h2>Practise what you learned</h2>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
          <a class="card practice-card" href="${skillUrl(a, l.id, 'quiz')}"><span class="stat-ico">${icon('target', 22)}</span><b>Quiz · 10 questions</b><span class="small muted">${lessonProgress(a, l.id).quizBest != null ? `Your best: ${lessonProgress(a, l.id).quizBest}%` : 'Check your understanding'}</span></a>
          ${l.scenarios.map((sc, k) => `<a class="card practice-card" href="${skillUrl(a, l.id, 'scenario', k)}"><span class="stat-ico">${icon('flag', 22)}</span><b>Scenario ${k + 1}: ${esc(sc.title)}</b><span class="small muted">${(lessonProgress(a, l.id).scen || {})[k] ? 'Done — try again' : 'What would you do?'}</span></a>`).join('')}
        </div>
      </section>
      ${next ? `<div class="row" style="margin-top:8px"><span class="spacer"></span><a class="btn btn-primary" href="${skillUrl(a, next.id)}">Next lesson: ${esc(next.title)} ${arrow(16)}</a></div>` : ''}`;
    const paywall = `
      <div class="card paywall">
        <span class="stat-ico" style="background:var(--brand-50);color:var(--brand)">${icon('lock', 22)}</span>
        <h3>Unlock the full lesson</h3>
        <p class="muted">Get every lesson in ${esc(a.name)}, with its quiz and practice scenarios, on any plan from ${inr(window.PLANS[0].price)}.</p>
        <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${skillUrl(a)}">See plans</a><a class="btn" href="${skillUrl(a, a.lessons[0].id)}">Read lesson 1 free</a></div>
      </div>`;
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <a class="crumb" href="${skillUrl(a)}">${icon('back', 16)} ${esc(a.name)}</a>
        <div class="hero-series">Lesson ${i + 1} of ${a.lessons.length} · ${l.minutes} min read · ${TRACK_LABEL[l.track]}${lessonFree(i) ? ' · Free' : ''}</div>
        <h1 style="margin:6px 0 10px">${esc(l.title)}</h1>
        <p>${esc(l.summary)}</p>
      </div></section>
      <div class="wrap page lesson" style="padding-top:0">
        ${open
          ? l.sections.map(lessonSection).join('') + `<section class="lesson-sec takeaways"><h2>Key takeaways</h2><ul>${l.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` + practice
          : lessonSection(l.sections[0]) + paywall}
      </div>`;
    if (open) saveLessonProgress(a, l.id, { read: true });
  }

  function gateLesson(f) {
    if (!currentUser()) { toast('Sign up free to practise'); requireLogin(); return false; }
    if (canOpenLesson(f.a, f.i)) return true;
    toast('Unlock this lesson to practise it');
    location.hash = skillUrl(f.a, f.l.id);
    return false;
  }

  function viewSkillQuiz(slug, lessonId) {
    const f = findLesson(slug, lessonId);
    if (!f) return viewNotFound();
    if (!f.a.full) return withFullCourse(f.a);
    if (!gateLesson(f)) return;
    const { a, l } = f;
    const qs = l.quiz;
    let k = 0, score = 0;
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <a class="crumb" href="${skillUrl(a, l.id)}">${icon('back', 16)} ${esc(l.title)}</a>
        <div class="hero-series">Quiz · ${qs.length} questions</div><h1 style="margin:6px 0 0">${esc(l.title)}</h1>
      </div></section>
      <div class="wrap page" style="padding-top:0"><div class="card intro" id="sq"></div></div>`;
    const el = $('#sq');
    const finish = () => {
      const pct = Math.round((score / qs.length) * 100);
      const best = Math.max(pct, lessonProgress(a, l.id).quizBest || 0);
      saveLessonProgress(a, l.id, { quizBest: best });
      if (pct >= 80) confetti();
      el.innerHTML = `
        <div class="center"><span class="stat-ico" style="margin:0 auto 12px;width:60px;height:60px;background:${pct >= 80 ? 'var(--success-soft)' : 'var(--brand-50)'};color:${pct >= 80 ? 'var(--success)' : 'var(--brand)'}">${icon(pct >= 80 ? 'trophy' : 'target', 28)}</span>
        <h2>You scored ${score}/${qs.length} (${pct}%)</h2>
        <p class="muted">${pct >= 80 ? 'Great work — you have this lesson down.' : 'Re-read the lesson sections you missed, then try again.'} Your best: ${best}%.</p>
        <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${skillUrl(a, l.id, 'scenario', 0)}">Practise scenarios ${arrow(16)}</a><button class="btn" id="sq-retry">${icon('refresh', 16)} Retake quiz</button><a class="btn btn-ghost" href="${skillUrl(a, l.id)}">Back to lesson</a></div></div>`;
      $('#sq-retry').addEventListener('click', () => { k = 0; score = 0; draw(); });
    };
    const draw = () => {
      if (k >= qs.length) return finish();
      const [text, opts, ans, expl] = qs[k];
      el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
      el.innerHTML = `
        <div class="progress-label"><span>Question ${k + 1} of ${qs.length}</span><span>Score ${score}</span></div>
        <div class="bar"><span style="width:${(k / qs.length) * 100}%"></span></div>
        <div class="q-text" style="margin-top:20px">${esc(text)}</div>
        <div>${opts.map((o, j) => `<button class="qopt" data-j="${j}"><span class="letter">${LETTERS[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="quiz-foot" hidden></div>`;
      $$('.qopt', el).forEach((b) => b.addEventListener('click', () => {
        const j = Number(b.dataset.j), ok = j === ans;
        if (ok) score++;
        $$('.qopt', el).forEach((x, m) => { x.disabled = true; if (m === ans) x.classList.add('right'); else if (m === j) x.classList.add('wrong'); });
        const foot = $('.quiz-foot', el);
        foot.hidden = false;
        foot.innerHTML = `<div class="explain">${icon(ok ? 'check' : 'info', 16)}<div><b>${ok ? 'Correct!' : 'Not quite.'}</b> ${esc(expl)}</div></div>
          <div class="row"><span class="spacer"></span><button class="btn btn-primary" id="sq-next">${k === qs.length - 1 ? 'See result' : 'Next question'} ${arrow(16)}</button></div>`;
        $('#sq-next').addEventListener('click', () => { k++; draw(); });
      }));
    };
    draw();
  }

  const RATING = { best: { label: 'Best response', cls: 'right' }, good: { label: 'Reasonable, but not the best', cls: 'ok' }, poor: { label: 'Poor response', cls: 'wrong' } };

  function viewScenario(slug, lessonId, idx) {
    const f = findLesson(slug, lessonId);
    if (!f) return viewNotFound();
    if (!f.a.full) return withFullCourse(f.a);
    if (!gateLesson(f)) return;
    const { a, l } = f;
    const sc = l.scenarios[idx];
    if (!sc) return viewNotFound();
    const nextLink = idx + 1 < l.scenarios.length ? skillUrl(a, l.id, 'scenario', idx + 1) : skillUrl(a, l.id);
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <a class="crumb" href="${skillUrl(a, l.id)}">${icon('back', 16)} ${esc(l.title)}</a>
        <div class="hero-series">Scenario ${idx + 1} of ${l.scenarios.length}</div><h1 style="margin:6px 0 0">${esc(sc.title)}</h1>
      </div></section>
      <div class="wrap page" style="padding-top:0">
        <div class="card intro">
          <p class="scenario-situation">${esc(sc.situation)}</p>
          <h3 style="margin:18px 0 12px">What would you do?</h3>
          <div id="sc-opts">${sc.options.map((o, j) => `<div class="scen-opt"><button class="qopt" data-j="${j}"><span class="letter">${LETTERS[j]}</span><span>${esc(o.text)}</span></button><div class="scen-fb" hidden></div></div>`).join('')}</div>
          <div class="row" id="sc-next" hidden style="margin-top:16px"><span class="spacer"></span><a class="btn btn-primary" href="${nextLink}">${idx + 1 < l.scenarios.length ? 'Next scenario' : 'Back to lesson'} ${arrow(16)}</a></div>
        </div>
      </div>`;
    $$('#sc-opts .qopt').forEach((b) => b.addEventListener('click', () => {
      const j = Number(b.dataset.j);
      $$('#sc-opts .scen-opt').forEach((wrap, m) => {
        const o = sc.options[m], r = RATING[o.rating] || RATING.poor;
        const btn = $('.qopt', wrap);
        btn.disabled = true;
        btn.classList.add(r.cls);
        if (m === j) btn.classList.add('chosen');
        const fb = $('.scen-fb', wrap);
        fb.hidden = false;
        fb.innerHTML = `<span class="badge ${r.cls === 'right' ? 'badge-success' : r.cls === 'ok' ? 'badge-warn' : 'badge-danger'}">${m === j ? 'Your choice · ' : ''}${r.label}</span> ${esc(o.feedback)}`;
      });
      const scen = { ...(lessonProgress(a, l.id).scen || {}) };
      scen[idx] = sc.options[j].rating;
      saveLessonProgress(a, l.id, { scen });
      $('#sc-next').hidden = false;
    }));
  }

  // ---------- AI coach (demo: switched off until accounts & payments are live) ----------
  const COACH_TASKS = [
    { id: 'intro', title: 'Tell me about yourself', area: 'Interview & Career',
      prompt: 'You are in a job interview for an entry-level role at a bank. The interviewer says: "Tell me about yourself." Type your answer as you would say it.', hint: 'About 60–150 words',
      sample: { score: 6, summary: 'A clear start, but it reads like a list of facts rather than a story about why you fit this role.',
        strengths: ['You introduce your education and recent work clearly.', 'The tone is polite and confident.'],
        improvements: ['Open with one line on who you are professionally, not your hometown.', 'Pick one achievement and give a number or result.', 'End by linking your skills to this bank role.'],
        improved_version: 'I recently completed my B.Com and cleared NISM Series V-A while preparing for banking exams. During my internship at a cooperative bank, I handled walk-in customer queries and helped reduce the account-opening backlog by setting up a simple checklist. I enjoy explaining financial products clearly, which is why this customer-facing role at your bank appeals to me.' } },
    { id: 'email', title: 'Reply to a worried client', area: 'Communication',
      prompt: 'A client writes: "My SIP has lost 8% this year. Why should I continue? I am thinking of stopping it." Write your reply email.', hint: 'About 80–200 words',
      sample: { score: 7, summary: 'Calm and respectful, but it leans on reassurance instead of helping the client decide.',
        strengths: ['You acknowledge the client\'s concern before explaining.', 'You avoid promising future returns.'],
        improvements: ['Remind the client of their original goal and time horizon.', 'Offer a short call to review whether the SIP still suits them.', 'Keep paragraphs to two or three sentences.'],
        improved_version: 'Dear Mr Rao,\n\nThank you for writing — an 8% fall is understandably worrying. Your SIP was set up for your daughter\'s education in 2034, so it has nine more years to recover from short-term swings. Market-linked funds can fall in some years, and I can\'t promise how they will move.\n\nBefore you decide, could we have a 15-minute call this week to check whether this goal and fund still suit you? If your situation has changed, we can adjust the plan together.\n\nWarm regards,\nPriya' } },
    { id: 'objection', title: 'Handle a fee objection', area: 'Workplace',
      prompt: 'A prospective client says: "Your fees are too high. Another adviser charges much less." Write what you would say.', hint: 'About 60–150 words',
      sample: { score: 5, summary: 'You defend your price, but you don\'t find out what the client values first.',
        strengths: ['You stay polite and don\'t criticise the other adviser.'],
        improvements: ['Ask what the other adviser\'s fee includes before comparing.', 'Explain the specific services behind your fee.', 'Respect the client\'s right to choose.'],
        improved_version: 'That\'s a fair question, and comparing is sensible. May I ask what the other adviser\'s fee includes — for example, a written financial plan and regular reviews? My fee covers a full plan, quarterly reviews and help with tax-efficient withdrawals. If those services matter to you, I\'m happy to walk you through them. If not, a lower-cost option may suit you better, and that\'s completely fine.' } },
  ];

  function coachFeedbackHtml(fb, demo) {
    const list = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `
      ${demo ? `<div class="notice info">${icon('info', 16)}<span><b>AI Coach is coming soon.</b> Here is an example of the feedback it gives for this task.</span></div>` : ''}
      <div class="row" style="margin:16px 0 8px"><span class="coach-score">${fb.score}<small>/10</small></span><p style="margin:0;flex:1;min-width:200px"><b>${esc(fb.summary)}</b></p></div>
      <div class="dodont"><div class="do"><b>${icon('check', 14)} What works</b>${list(fb.strengths)}</div><div class="dont"><b>${icon('flag', 14)} To improve</b>${list(fb.improvements)}</div></div>
      <div class="explain" style="margin-top:16px">${icon('sparkle', 16)}<div><b>Improved version</b><p style="white-space:pre-line;margin:6px 0 0">${esc(fb.improved_version)}</p></div></div>`;
  }

  function viewCoach() {
    let task = COACH_TASKS[0];
    app.innerHTML = `
      <section class="page-hero"><div class="wrap">
        <a class="crumb" href="#/skills">${icon('back', 16)} Soft skills</a>
        <div class="row" style="gap:10px"><h1 style="margin:0">AI Coach</h1><span class="badge badge-warn">Coming soon</span></div>
        <p style="margin-top:10px">Practise real answers and get instant, personal feedback — what works, what to improve and a stronger version of your answer.</p>
      </div></section>
      <div class="wrap page" style="padding-top:0">
        <div class="tabs" id="coach-tabs">${COACH_TASKS.map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-id="${t.id}">${esc(t.title)}</button>`).join('')}</div>
        <div class="card intro" id="coach-card"></div>
      </div>`;
    const draw = () => {
      $('#coach-card').innerHTML = `
        <span class="badge">${esc(task.area)}</span>
        <p class="scenario-situation" style="margin-top:12px">${esc(task.prompt)}</p>
        <label class="field" style="margin-top:12px"><span>Your answer <span class="muted small">(${esc(task.hint)})</span></span>
          <textarea id="coach-answer" rows="7" maxlength="3000" placeholder="Type your answer here…"></textarea></label>
        <div class="row" style="margin-top:12px"><span class="small muted" id="coach-count">0 words</span><span class="spacer"></span><button class="btn btn-primary" id="coach-go">${icon('sparkle', 16)} Get feedback</button></div>
        <div id="coach-out"></div>`;
      const ta = $('#coach-answer');
      ta.addEventListener('input', () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; $('#coach-count').textContent = `${n} word${n === 1 ? '' : 's'}`; });
      $('#coach-go').addEventListener('click', async (ev) => {
        const answer = ta.value.trim();
        if (answer.split(/\s+/).length < 15) { toast('Write at least a few sentences first'); return; }
        const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Reviewing…';
        let fb = null;
        try {
          const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: task.id, answer }) });
          if (res.ok) fb = (await res.json()).feedback;
        } catch (e) { /* coach unavailable */ }
        $('#coach-out').innerHTML = coachFeedbackHtml(fb || task.sample, !fb);
        btn.disabled = false; btn.innerHTML = `${icon('sparkle', 16)} Get feedback`;
      });
    };
    $$('#coach-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      task = COACH_TASKS.find((t) => t.id === b.dataset.id);
      $$('#coach-tabs .tab').forEach((x) => x.classList.toggle('active', x === b));
      draw();
    }));
    draw();
  }

  // ---------- admin ----------
  function viewAdmin() {
    const now = Date.now();
    const us = users();
    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap">
          <h1>Admin panel</h1>
          <p>Prototype: this page is open to anyone. The live site will restrict it to admin accounts.</p>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="dash-stats">
          <div class="kpi"><span class="kpi-ico" style="background:var(--brand-50);color:var(--brand)">${icon('user', 22)}</span><div><b>${us.length}</b><span>Registered users</span></div></div>
          <div class="kpi"><span class="kpi-ico" style="background:#efe9ff;color:#7a5af8">${icon('clock', 22)}</span><div><b>${attempts().filter((a) => a.submittedAt).length}</b><span>Tests taken</span></div></div>
        </div>
        <section style="margin-top:40px">
          <h2 style="font-size:1.5rem">Add a question</h2>
          <form class="card" id="q-form">
            <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
              <label class="field" style="margin:0"><span>Exam</span><select name="examId">${EXAMS.map((e) => `<option value="${e.id}">${esc(e.series)} — ${esc(e.name)}</option>`).join('')}</select></label>
              <label class="field" style="margin:0"><span>Chapter</span><input name="chapter" list="chapter-list" required><datalist id="chapter-list"></datalist></label>
            </div>
            <label class="field" style="margin-top:16px"><span>Question</span><textarea name="text" rows="2" required></textarea></label>
            <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-top:16px">
              ${[0, 1, 2, 3].map((k) => `<label class="field" style="margin:0"><span>Option ${LETTERS[k]}</span><input name="o${k}" required></label>`).join('')}
            </div>
            <div class="grid" style="grid-template-columns:minmax(140px,200px) 1fr;margin-top:16px">
              <label class="field" style="margin:0"><span>Correct option</span><select name="answer">${[0, 1, 2, 3].map((k) => `<option value="${k}">${LETTERS[k]}</option>`).join('')}</select></label>
              <label class="field" style="margin:0"><span>Explanation</span><input name="explanation" required></label>
            </div>
            <div class="error" id="q-error"></div>
            <button class="btn btn-primary">${icon('plus', 16)} Add question</button>
          </form>
        </section>
        <section style="margin-top:40px">
          <h2 style="font-size:1.5rem">Question bank</h2>
          <div class="card table-wrap" style="padding:8px 20px"><table>
            <tr><th>Series</th><th>Exam</th><th>Questions</th><th>Chapters</th></tr>
            ${EXAMS.map((e) => `<tr><td><b>${esc(e.series)}</b></td><td>${esc(e.name)}</td><td>${questionsFor(e.id).length}</td><td>${chaptersFor(e.id).length}</td></tr>`).join('')}
          </table></div>
        </section>
        <section style="margin-top:40px">
          <h2 style="font-size:1.5rem">Users</h2>
          <div class="card table-wrap" style="padding:8px 20px">${us.length ? `<table>
            <tr><th>Name</th><th>Email</th><th>Mobile</th><th>Activity</th></tr>
            ${us.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.email)}</td><td>${esc(x.mobile || '')}</td><td>${attempts().filter((t) => t.userId === x.id && t.submittedAt).length} tests</td></tr>`).join('')}
          </table>` : '<p class="muted" style="padding:16px 0">No users yet.</p>'}</div>
        </section>
      </div>`;
    const form = $('#q-form');
    const fillChapters = () => { $('#chapter-list').innerHTML = chaptersFor(form.examId.value).map((ch) => `<option value="${esc(ch)}">`).join(''); };
    form.examId.addEventListener('change', fillChapters);
    fillChapters();
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const opts = [f.o0, f.o1, f.o2, f.o3].map((s) => (s || '').trim());
      if (![f.chapter, f.text, f.explanation].every((s) => (s || '').trim()) || opts.some((o) => !o)) {
        $('#q-error').textContent = 'Please fill in every field.';
        return;
      }
      const q = { id: 'c-' + uid(), examId: f.examId, chapter: f.chapter.trim(), text: f.text.trim(), options: opts, answer: Number(f.answer), explanation: f.explanation.trim() };
      store.set('custom_questions', [...store.get('custom_questions', []), q]);
      toast('Question added');
      viewAdmin();
    });
  }

  function viewNotFound() {
    app.innerHTML = `<div class="wrap page"><div class="card center" style="max-width:520px;margin:40px auto;padding:48px 24px"><span class="stat-ico" style="margin:0 auto 14px;width:60px;height:60px">${icon('search', 28)}</span><h1 style="font-size:2rem">Page not found</h1><p class="muted">The page you're looking for doesn't exist.</p><a class="btn btn-primary" href="#/">Go home ${arrow()}</a></div></div>`;
  }

  window.addEventListener('hashchange', route);
  route();
})();
