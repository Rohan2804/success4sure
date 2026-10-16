/* Success4Sure prototype — single-page app with hash routing.
   Data lives in localStorage for now; each store maps to a future database table
   (users, subscriptions, attempts, questions). */
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
    'Operations & Compliance': { icon: 'shield', color: '#2e90fa' },
    'AIF & PMS': { icon: 'briefcase', color: '#6172f3' },
    'Foundation': { icon: 'book', color: '#f79009' },
    'Banking': { icon: 'bank', color: '#2457f5' },
    'SSC': { icon: 'flag', color: '#0ea5e9' },
    'MBA': { icon: 'trophy', color: '#7a5af8' },
    'Insurance & Finance': { icon: 'shield', color: '#00a87e' },
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

  const users = () => store.get('users', []);
  const session = () => store.get('session', null);
  const currentUser = () => { const s = session(); return s ? users().find((u) => u.id === s.userId) || null : null; };
  const subs = () => store.get('subs', []);
  const attempts = () => store.get('attempts', []);

  function activeSub(userId, examId) {
    const now = Date.now();
    return subs().filter((s) => s.userId === userId && s.examId === examId && s.end > now).sort((a, b) => b.end - a.end)[0] || null;
  }
  const testsIn = (sub) => sub.tests || sub.days;
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
        ${link('#/study-material', 'Study Material', 'study-material', 'nav-study')}
      </div>
      <form class="nav-search" id="nav-search" role="search">
        ${icon('search', 16)}<input type="search" placeholder="Search exams, e.g. NISM V-A, IBPS PO…" aria-label="Search exams"><kbd>⌘K</kbd>
      </form>
      <div class="nav-right">
        ${u ? `${link('#/dashboard', 'Dashboard', 'dashboard')}<a href="#/" id="logout">Log out</a><span class="avatar" title="${esc(u.name)}">${esc(u.name.trim()[0].toUpperCase())}</span>`
            : `<a href="#/login" class="btn btn-primary btn-sm">Login / Sign up</a>`}
      </div>`;
    $('#nav-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('input', e.currentTarget).value.trim();
      location.hash = '#/exams' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    const lo = $('#logout');
    lo && lo.addEventListener('click', (e) => { e.preventDefault(); store.set('session', null); toast('Logged out'); location.hash = '#/'; route(); });
  }

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
      checkout: () => viewCheckout(parts[1], Number(parts[2])),
      dashboard: viewDashboard,
      test: () => viewTest(parts[1], params.get('demo') === '1', Number(parts[2]) || 0),
      result: () => viewResult(parts[1]),
      admin: viewAdmin,
    };
    (views[view] || viewNotFound)();
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
      <div class="ec-meta"><span>${icon('book', 14)} Up to ${window.MAX_TESTS} mocks</span><span>${icon('clock', 14)} ${e.pattern.duration} min</span><span>${icon('target', 14)} ${e.pattern.passPct}%</span></div>
      <div class="ec-foot"><span>from <b>${inr(window.PLANS[0].price)}</b></span><span class="ec-arrow">${arrow(16)}</span></div>
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
  function viewHome() {
    const N = EXAMS.length;
    const totalQ = totalQuestions();
    const faqs = [
      ['Are these actual exam questions?', 'No. All questions are original practice questions written by our team and mapped topic by topic to each exam\'s official syllabus. They prepare you for the concepts and the format — not by leaking real exam content.'],
      ['How does a subscription work?', 'Pick an exam and a plan of 10, 15, 20 or 30 days. Each day of your plan unlocks one full-length mock test of 100 questions — so a 10-day plan gives you 10 mock tests (1,000 questions) and a 30-day plan gives you 30 (3,000 questions). You can retake any unlocked test until your plan ends.'],
      ['Can I upgrade my plan?', 'Yes. While a plan is active you can upgrade to a longer one to unlock more mock tests. The maximum plan is 30 days.'],
      ['Where do I get the official NISM workbooks?', 'NISM publishes its workbooks free of cost. Our Study Material page links every NISM exam to NISM\'s official free workbook portal, so you always download the latest version straight from the source.'],
      ['Do mock tests follow the real exam pattern?', 'Yes — the same number of questions, time limit, passing percentage and negative marking as the real exam, so exam day feels familiar.'],
      ['Can I practise on my phone?', 'Absolutely. Success4Sure works on any phone, tablet or laptop browser — no app download needed.'],
      ['How do I pay?', 'UPI, debit/credit cards and net banking via a secure payment gateway. You receive a GST invoice for every purchase.'],
    ];
    app.innerHTML = `
      <section class="hero">
        <div class="ticker" aria-label="Exams"><div class="ticker-track">${EXAMS.map((e) => `<a href="#/exam/${e.id}"><b>${esc(examCode(e).replace('NISM Series ', 'NISM '))}</b>${esc(e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name)}<span class="up">▲ ${e.pattern.passPct}% to pass</span></a>`).join('')}${EXAMS.map((e) => `<a href="#/exam/${e.id}"><b>${esc(examCode(e).replace('NISM Series ', 'NISM '))}</b>${esc(e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name)}<span class="up">▲ ${e.pattern.passPct}% to pass</span></a>`).join('')}</div></div>
        <div class="wrap hero-center hero-anim">
          <h1>Pass your exam with confidence</h1>
          <p class="lead">Exam-pattern mock tests, topic-wise practice and a clear explanation for every answer — for NISM certifications, banking, SSC, MBA entrance and insurance exams.</p>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#/exams">Get started</a>
            <a class="btn btn-lg" href="#/study-material">Free study material</a>
          </div>
          <ul class="trust">
            <li>${icon('check', 16)} No sign-up for demo</li>
            <li>${icon('check', 16)} Real exam pattern</li>
            <li>${icon('check', 16)} Instant explanations</li>
          </ul>
        </div>
        <div class="wrap">
          <div class="quiz-wrap hero-anim" style="--d:.15s">
            <div class="quiz-label">Try a question — no sign-up needed</div>
            <div class="quiz-card" id="hero-quiz"></div>
          </div>
        </div>
      </section>

      <section class="stats-strip wrap reveal">
        <div class="stats">
          <div class="stat"><span class="stat-ico">${icon('grid', 22)}</span><div><b data-count="${N}">0</b><span>Exams covered</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('book', 22)}</span><div><b data-count="${totalQ}" data-suffix="+">0</b><span>Practice questions</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('target', 22)}</span><div><b data-count="${window.GROUPS.length}">0</b><span>Exam categories</span></div></div>
          <div class="stat"><span class="stat-ico">${icon('phone', 22)}</span><div><b>24×7</b><span>On any device</span></div></div>
        </div>
      </section>

      <section class="section wrap">
        <div class="section-head reveal">
          <h2>Find your exam</h2>
          <p>NISM certifications, bank and SSC recruitment, MBA entrance and insurance &amp; banking certifications — all on the same simple plans.</p>
        </div>
        <div class="cat-tabs reveal" id="home-cats">${groupTabs('All', false)}</div>
        <div class="grid" id="home-grid"></div>
        <div class="center reveal" style="margin-top:32px"><a class="btn btn-lg" href="#/exams">View all ${N} exams ${arrow()}</a></div>
      </section>

      <section class="section section-alt">
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

      <section class="section wrap">
        <div class="section-head reveal">
          <h2>Three steps to certification</h2>
        </div>
        <div class="steps">
          <div class="step reveal"><div class="step-num">${icon('search', 26)}<em>1</em></div><h3>Pick your exam</h3><p>Choose any exam and a plan of 10, 15, 20 or 30 days.</p></div>
          <div class="step reveal" style="--d:.12s"><div class="step-num">${icon('clock', 26)}<em>2</em></div><h3>Take mock tests</h3><p>One full-length, timed mock test unlocked for every day of your plan.</p></div>
          <div class="step reveal" style="--d:.24s"><div class="step-num">${icon('trophy', 26)}<em>3</em></div><h3>Review &amp; pass</h3><p>Learn from explanations, fix weak chapters and walk in confident.</p></div>
        </div>
      </section>

      <section class="section section-alt">
        <div class="wrap">
          <div class="section-head reveal">
            <h2>Simple pricing, per exam</h2>
            <p>One mock test of 100 questions for every day of your plan. Prices include GST.</p>
          </div>
          <div class="pricing">
            ${window.PLANS.map((p, i) => {
              const featured = !!p.tag && p.tag === 'Popular';
              return `<div class="price-card ${featured ? 'featured' : ''} reveal" style="--d:${i * 0.1}s">
                ${p.tag ? `<span class="ribbon">${esc(p.tag)}</span>` : ''}
                <h3>${esc(p.label)}</h3>
                <div class="amount">${inr(p.price)}</div>
                <div class="per-day muted">≈ ${inr((p.price / p.days).toFixed(1))} per day</div>
                <ul>
                  <li>${icon('check', 16)} ${p.days} days of access</li>
                  <li>${icon('check', 16)} <b>${p.tests} mock tests</b></li>
                  <li>${icon('check', 16)} ${num(p.tests * 100)} questions</li>
                  <li>${icon('check', 16)} Explanations &amp; analytics</li>
                </ul>
                <a class="btn ${featured ? 'btn-primary' : ''} btn-block" href="#/exams">Choose exam ${arrow()}</a>
              </div>`;
            }).join('')}
          </div>
        </div>
      </section>

      <section class="section wrap">
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

      <section class="section wrap" style="padding-top:0">
        <div class="section-head reveal">
          <h2>Questions? We've got answers</h2>
        </div>
        <div class="faq">
          ${faqs.map(([q, a], i) => `<details class="reveal" style="--d:${i * 0.05}s" ${i === 0 ? 'open' : ''}><summary>${esc(q)}<span class="plus">${icon('plus', 16)}</span></summary><p>${esc(a)}</p></details>`).join('')}
        </div>
      </section>

      <section class="wrap" style="padding-bottom:40px">
        <div class="cta-band reveal">
          <h2>Ready to ace your exam?</h2>
          <p>Try a free demo test right now — no sign-up needed.</p>
          <div class="row">
            <a class="btn btn-primary btn-lg" href="#/test/v-a?demo=1">${icon('bolt', 18)} Start free demo</a>
            <a class="btn btn-lg" href="#/exams">Browse exams ${arrow()}</a>
          </div>
        </div>
      </section>`;

    heroQuiz($('#hero-quiz'));

    let cat = 'All';
    const drawGrid = () => {
      const list = (cat === 'All' ? EXAMS.filter((e) => e.popular) : EXAMS.filter((e) => e.group === cat)).slice(0, 6);
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
            <a class="btn btn-ghost btn-sm" href="#/exam/${q.exam.id}">See ${esc(q.exam.series)} plans</a>
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
    const sub = u && activeSub(u.id, e.id);
    const owned = sub ? testsIn(sub) : 0;
    const status = sub ? mockStatus(u.id, e.id) : {};
    const done = Object.keys(status).length;
    const next = sub ? nextMock(status, owned) : null;
    const chapters = chaptersFor(e.id);
    const offer = window.PLANS.filter((pl) => pl.tests > owned);
    let selected = (offer.find((pl) => pl.tag === 'Popular') || offer[0] || {}).days;

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
                <div class="mock-grid">${Array.from({ length: window.MAX_TESTS }, (_, i) => tile(i + 1)).join('')}</div>
                ${owned < window.MAX_TESTS ? `<p class="small muted" style="margin:14px 0 0">${icon('lock', 14)} Mock tests ${owned + 1}–${window.MAX_TESTS} unlock when you upgrade your plan.</p>` : ''}
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
                ${[['grid', 'Up to 30 mock tests', 'One per day of your plan'], ['book', `${p.questions} questions each`, 'Full-length, exam pattern'], ['bulb', 'Explanations', 'For every question'], ['chart', 'Analytics', 'Chapter-wise scores']]
                  .map(([ic, t, s2]) => `<div class="row" style="flex-wrap:nowrap"><span class="stat-ico" style="width:42px;height:42px">${icon(ic, 20)}</span><div><b style="font-size:.95rem">${t}</b><div class="small muted">${s2}</div></div></div>`).join('')}
              </div>
            </div>
          </div>
          <div class="stack sticky">
            ${sub ? `
              <div class="card access-card reveal">
                <div class="row"><span class="badge badge-success">${icon('check', 12)} ${esc(sub.label || sub.days + ' Days')} plan active</span></div>
                <h3 style="margin-top:12px">${owned} mock tests unlocked</h3>
                <div class="meter"><span style="width:${Math.max(4, Math.min(100, ((sub.end - Date.now()) / (sub.end - sub.start)) * 100))}%"></span></div>
                <div class="small muted" style="margin-bottom:16px">${Math.ceil((sub.end - Date.now()) / DAY)} days left · until ${fmtDate(sub.end)}</div>
                ${next ? `<a class="btn btn-primary btn-lg btn-block" href="#/test/${e.id}/${next}">${icon('bolt', 18)} Start Mock Test ${next}</a>`
                  : `<a class="btn btn-lg btn-block" href="#mocks" onclick="document.getElementById('mocks').scrollIntoView({behavior:'smooth'});return false;">All tests attempted — retake any</a>`}
              </div>` : ''}
            ${offer.length ? `
              <div class="card reveal" style="--d:.1s">
                <h3>${sub ? 'Upgrade for more mock tests' : 'Choose your plan'}</h3>
                <div id="plans" style="margin-top:14px">
                  ${offer.map((pl) => `
                    <label class="plan-opt ${pl.days === selected ? 'selected' : ''}">
                      <input type="radio" name="plan" value="${pl.days}" ${pl.days === selected ? 'checked' : ''}>
                      <span class="radio"></span>
                      <div><b>${esc(pl.label)}</b> ${pl.tag ? `<span class="badge">${esc(pl.tag)}</span>` : ''}<div class="small muted">${pl.tests} mock tests · ${num(pl.tests * p.questions)} questions</div></div>
                      <div class="p-price">${inr(pl.price)}<small>incl. GST</small></div>
                    </label>`).join('')}
                </div>
                <a class="btn btn-primary btn-lg btn-block" id="buy" href="#/checkout/${e.id}/${selected}">${sub ? 'Upgrade' : 'Continue'} ${arrow()}</a>
                <p class="center small muted" style="margin:12px 0 0">${icon('lock', 14)} Secure payment · instant access</p>
              </div>` : `
              <div class="card reveal small muted">${icon('trophy', 16)} You're on the maximum 30-day plan with all ${window.MAX_TESTS} mock tests unlocked.</div>`}
            ${sub ? '' : `
              <div class="card reveal" style="--d:.2s">
                <div class="row" style="flex-wrap:nowrap"><span class="stat-ico">${icon('bolt', 22)}</span><div><b>Not sure yet?</b><div class="small muted">Try a free 3-question demo. No sign-up.</div></div></div>
                <a class="btn btn-block" style="margin-top:14px" href="#/test/${e.id}?demo=1">Try free demo ${arrow()}</a>
              </div>`}
          </div>
        </div>
      </div>`;
    $$('#plans input').forEach((r) => r.addEventListener('change', () => {
      selected = Number(r.value);
      $$('#plans .plan-opt').forEach((l) => l.classList.toggle('selected', l.contains(r)));
      $('#buy').href = `#/checkout/${e.id}/${selected}`;
    }));
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
            <form id="auth-form" novalidate>
              ${isReg ? `<label class="field"><span>Full name</span><div class="input-ico">${icon('user', 18)}<input name="name" autocomplete="name" placeholder="Your name" required></div></label>
              <label class="field"><span>Mobile number</span><div class="input-ico">${icon('phone', 18)}<input name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="10-digit mobile" required></div></label>` : ''}
              <label class="field"><span>Email</span><div class="input-ico">${icon('mail', 18)}<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div></label>
              <label class="field"><span>Password</span><div class="input-ico">${icon('lock', 18)}<input name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="6" placeholder="At least 6 characters" required></div></label>
              <div class="error" id="auth-error"></div>
              <button class="btn btn-primary btn-lg btn-block">${isReg ? 'Create account' : 'Log in'} ${arrow()}</button>
            </form>
            <p class="center small" style="margin-top:18px">${isReg ? 'Already have an account?' : 'New to Success4Sure?'} <a href="#/${other}${nextQs}"><b>${isReg ? 'Log in' : 'Create an account'}</b></a></p>
            <div class="notice info small">${icon('info', 16)}<span>Prototype: accounts are stored only in this browser. The live site will use secure server-side login.</span></div>
          </div>
        </div>
      </div>`;
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
      toast(isReg ? `Welcome, ${u.name.split(' ')[0]}!` : 'Logged in');
      location.hash = '#' + (next || '/dashboard');
    });
  }

  // ---------- checkout ----------
  function viewCheckout(examId, days) {
    const e = examById(examId);
    const plan = window.PLANS.find((p) => p.days === days);
    if (!e || !plan) return viewNotFound();
    if (!requireLogin()) return;
    const u = currentUser();
    const c = CAT[e.category];
    const existing = activeSub(u.id, e.id);
    if (existing && plan.tests <= testsIn(existing)) {
      toast(`You already have ${testsIn(existing)} mock tests — pick a bigger plan to upgrade`);
      location.hash = '#/exam/' + e.id;
      return;
    }
    const base = plan.price / 1.18;
    // Plans never stack: an upgrade replaces the current plan, starting today (max 30 days).
    const start = Date.now();
    const end = start + plan.days * DAY;
    app.innerHTML = `
      <div class="wrap page">
        <a class="small" href="#/exam/${e.id}">${icon('back', 16)} Back to exam</a>
        <h1 style="font-size:2rem;margin-top:12px">Checkout</h1>
        <div class="checkout">
          <div class="card reveal">
            <div class="row" style="flex-wrap:nowrap">
              <span class="ec-icon" style="--c:${c.color};display:grid;place-items:center;width:52px;height:52px;border-radius:16px;color:${c.color};background:color-mix(in srgb, ${c.color} 12%, transparent)">${icon(c.icon, 24)}</span>
              <div><div class="small muted"><b>${esc(examCode(e))}</b></div><h3 style="margin:2px 0 0">${esc(e.name)}</h3></div>
            </div>
            <div style="margin-top:20px">
              <div class="summary-row"><span>Plan</span><b>${esc(plan.label)}</b></div>
              <div class="summary-row"><span>Mock tests</span><b>${plan.tests} tests × ${e.pattern.questions} questions</b></div>
              <div class="summary-row"><span>Total questions</span><b>${num(plan.tests * e.pattern.questions)}</b></div>
              <div class="summary-row"><span>Access</span><b>${fmtDate(start)} → ${fmtDate(end)}</b></div>
              ${existing ? `<div class="notice ok small" style="margin-top:8px">${icon('check', 16)}<span>Upgrade: this replaces your current ${testsIn(existing)}-test plan and starts today. Your past results are kept.</span></div>` : ''}
            </div>
          </div>
          <div class="card reveal" style="--d:.1s">
            <h3>Order summary</h3>
            <div class="summary-row"><span>Price</span><b>${inr(base.toFixed(2))}</b></div>
            <div class="summary-row"><span>GST (18%)</span><b>${inr((plan.price - base).toFixed(2))}</b></div>
            <div class="summary-total"><span>Total</span><span class="grad-text">${inr(plan.price)}</span></div>
            <div class="pay-methods"><span>UPI</span><span>Cards</span><span>Net banking</span></div>
            <button class="btn btn-primary btn-lg btn-block" id="pay">${icon('lock', 18)} Pay ${inr(plan.price)}</button>
            <div class="notice small" style="margin-top:14px">${icon('info', 16)}<span>Prototype: no real payment is taken. The live site will open a payment gateway here.</span></div>
          </div>
        </div>
      </div>`;
    $('#pay').addEventListener('click', (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.innerHTML = 'Processing…';
      setTimeout(() => {
        const now = Date.now();
        const s = { id: uid(), userId: u.id, examId: e.id, days: plan.days, tests: plan.tests, label: plan.label, price: plan.price, start, end, paymentRef: 'DEMO-' + uid().toUpperCase(), created: now };
        const all = subs().map((x) => (existing && x.id === existing.id ? { ...x, end: now, upgradedTo: s.id } : x));
        store.set('subs', [...all, s]);
        toast(existing ? `Upgraded — ${plan.tests} mock tests unlocked` : `Payment successful — ${plan.tests} mock tests unlocked`);
        confetti();
        location.hash = '#/exam/' + e.id;
      }, 700);
    });
  }

  // ---------- dashboard ----------
  function viewDashboard() {
    if (!requireLogin()) return;
    const u = currentUser();
    const now = Date.now();
    const mySubs = subs().filter((s) => s.userId === u.id);
    const byExam = {};
    mySubs.forEach((s) => { if (!byExam[s.examId] || s.end > byExam[s.examId].end) byExam[s.examId] = s; });
    const latest = Object.values(byExam).sort((a, b) => b.end - a.end);
    const myAttempts = attempts().filter((a) => a.userId === u.id && a.submittedAt && !a.demo).sort((a, b) => b.submittedAt - a.submittedAt);
    const avg = myAttempts.length ? myAttempts.reduce((s, a) => s + a.result.pct, 0) / myAttempts.length : 0;
    const passes = myAttempts.filter((a) => a.result.passed).length;
    const activeCount = latest.filter((s) => s.end > now).length;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const suggest = EXAMS.filter((e) => e.popular && !byExam[e.id]).slice(0, 3);

    const kpi = (ic, bg, fg, val, label, count, suffix) => `<div class="kpi reveal"><span class="kpi-ico" style="background:${bg};color:${fg}">${icon(ic, 22)}</span><div><b ${count !== undefined ? `data-count="${count}" data-suffix="${suffix || ''}"` : ''}>${val}</b><span>${label}</span></div></div>`;

    app.innerHTML = `
      <section class="page-hero">
        <div class="wrap welcome">
          <div>
            <h1>${greet}, ${esc(u.name.split(' ')[0])}!</h1>
            <p>${activeCount ? 'Keep the momentum going — every test gets you closer.' : 'Pick your first exam and start practising today.'}</p>
          </div>
          <a class="btn btn-lg" href="#/exams">${icon('plus', 18)} Add an exam</a>
        </div>
      </section>
      <div class="wrap page" style="padding-top:0">
        <div class="dash-stats">
          ${kpi('grid', 'var(--brand-50)', 'var(--brand)', 0, 'Active subscriptions', activeCount)}
          ${kpi('clock', '#efe9ff', '#7a5af8', 0, 'Tests taken', myAttempts.length)}
          ${kpi('chart', '#e0f5fe', '#0284c7', 0, 'Average score', Math.round(avg), '%')}
          ${kpi('trophy', 'var(--success-soft)', 'var(--success)', 0, 'Tests passed', passes)}
        </div>

        <section style="margin-top:40px">
          <div class="row" style="margin-bottom:18px"><h2 style="margin:0;font-size:1.5rem">My subscriptions</h2></div>
          ${latest.length ? `<div class="grid">${latest.map((s, i) => {
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
          }).join('')}</div>` : `<div class="card center reveal" style="padding:48px 24px"><span class="stat-ico" style="margin:0 auto 14px;width:60px;height:60px">${icon('book', 28)}</span><h3>No subscriptions yet</h3><p class="muted">Choose an exam and a plan to unlock up to 30 mock tests.</p><a class="btn btn-primary" href="#/exams">Browse exams ${arrow()}</a></div>`}
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

  // ---------- test engine ----------
  function viewTest(examId, demo, mockNo) {
    const e = examById(examId);
    if (!e) return viewNotFound();
    const u = currentUser();
    let sub = null;
    if (!demo) {
      if (!requireLogin()) return;
      sub = activeSub(u.id, e.id);
      if (!sub) {
        toast('Your subscription for this exam is not active');
        location.hash = '#/exam/' + e.id;
        return;
      }
      if (!mockNo) mockNo = nextMock(mockStatus(u.id, e.id), testsIn(sub)) || 1;
      if (mockNo > testsIn(sub) || mockNo < 1) {
        toast(`Mock Test ${mockNo} is locked — upgrade your plan to unlock it`);
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
    $('#begin').addEventListener('click', () => runTest(e, qs, totalSecs, demo, u, mockNo));
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
        id: uid(), userId: u ? u.id : null, examId: e.id, demo, mockNo: demo ? null : mockNo,
        questionIds: qs.map((q) => q.id), answers: st.answers,
        startedAt: st.startedAt, submittedAt: Date.now(),
        result: { correct, wrong, unanswered: qs.length - correct - wrong, score, max, pct, passed: pct >= p.passPct, chapters },
      };
      store.set('attempts', [...attempts(), attempt]);
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
    const u = currentUser();
    const sub = u && activeSub(u.id, e.id);
    if (!sub || !a.mockNo) return `<a class="btn btn-primary" href="#/exam/${e.id}">View plans ${arrow()}</a><a class="btn" href="#/dashboard">Dashboard</a>`;
    const owned = testsIn(sub);
    const nx = nextMock(mockStatus(u.id, e.id), owned);
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

  // ---------- admin ----------
  function viewAdmin() {
    const now = Date.now();
    const allSubs = subs();
    const revenue = allSubs.reduce((s, x) => s + x.price, 0);
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
          <div class="kpi"><span class="kpi-ico" style="background:var(--success-soft);color:var(--success)">${icon('check', 22)}</span><div><b>${allSubs.filter((s) => s.end > now).length}</b><span>Active subscriptions</span></div></div>
          <div class="kpi"><span class="kpi-ico" style="background:#fff5e0;color:#b76e00">${icon('chart', 22)}</span><div><b>${inr(revenue)}</b><span>Revenue (demo)</span></div></div>
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
          <h2 style="font-size:1.5rem">Users &amp; subscriptions</h2>
          <div class="card table-wrap" style="padding:8px 20px">${us.length ? `<table>
            <tr><th>Name</th><th>Email</th><th>Mobile</th><th>Subscriptions</th></tr>
            ${us.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.email)}</td><td>${esc(x.mobile)}</td><td>${allSubs.filter((s) => s.userId === x.id).map((s) => `${esc(examById(s.examId).series)} <span class="badge ${s.end > now ? '' : 'badge-danger'}">${s.end > now ? 'until ' + fmtDate(s.end) : 'expired'}</span>`).join('<br>') || '<span class="muted">—</span>'}</td></tr>`).join('')}
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
