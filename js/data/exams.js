// Exam catalog. Patterns are indicative placeholders — verify each against the
// official body's latest notification before going live.
// pattern: questions, total marks, duration (minutes), pass/target %, negative (fraction of a question's marks)
// One mock test unlocked per day of the plan; each mock test is a fixed paper in the exam's pattern.
// Prices are placeholders.
window.PLANS = [
  { days: 10, tests: 10, price: 199, label: '10 Days' },
  { days: 15, tests: 15, price: 279, label: '15 Days' },
  { days: 20, tests: 20, price: 349, label: '20 Days', tag: 'Popular' },
  { days: 30, tests: 30, price: 449, label: '30 Days', tag: 'Best value' },
];
window.MAX_TESTS = 30;

// Top-level exam groups. `competitive` exams have cut-offs rather than a fixed pass mark,
// so their passPct is shown as a target score.
window.GROUPS = [
  { id: 'NISM', label: 'NISM', blurb: 'SEBI-mandated securities market certifications' },
  { id: 'Banking', label: 'Banking', blurb: 'IBPS, SBI and RBI recruitment exams', competitive: true },
  { id: 'SSC', label: 'SSC', blurb: 'Staff Selection Commission exams', competitive: true },
  { id: 'MBA', label: 'MBA Entrance', blurb: 'CAT, CMAT and MAT', competitive: true },
  { id: 'Insurance & Finance', label: 'Insurance & Finance', blurb: 'IRDAI, NSE and IIBF certifications' },
];

// NISM sub-categories (used as a secondary filter inside the NISM group).
window.CATEGORIES = [
  'Mutual Funds',
  'Derivatives',
  'Advisory & Research',
  'Operations & Compliance',
  'AIF & PMS',
  'Foundation',
];

const P = (questions, marks, duration, passPct, negative) => ({ questions, marks, duration, passPct, negative });
const NISM_PORTAL = 'https://api.nism.ac.in/cmp/';
const nism = (path) => 'https://www.nism.ac.in/' + path;

// Official study material / information links. NISM workbooks are free from NISM's own portal
// (students register there); we link rather than re-host, so the latest version is always served.
const N = (id, series, name, category, pattern, page, extra = {}) => ({
  id, series, name, category, group: 'NISM', pattern,
  links: [
    { label: 'Free official workbook (PDF)', url: NISM_PORTAL, kind: 'pdf' },
    { label: 'Exam details & test objectives', url: nism(page), kind: 'info' },
  ],
  ...extra,
});

window.EXAMS = [
  // ---------- NISM ----------
  N('i', 'Series I', 'Currency Derivatives', 'Derivatives', P(100, 100, 120, 60, 0.25), 'currency-derivatives'),
  N('ii-a', 'Series II-A', 'Registrars to an Issue and Share Transfer Agents – Corporate', 'Operations & Compliance', P(100, 100, 120, 50, 0.25), 'rta-corporate'),
  N('ii-b', 'Series II-B', 'Registrars to an Issue and Share Transfer Agents – Mutual Fund', 'Operations & Compliance', P(100, 100, 120, 50, 0.25), 'rta-mutual-fund'),
  N('iii-a', 'Series III-A', 'Securities Intermediaries Compliance (Non-Fund)', 'Operations & Compliance', P(100, 100, 120, 60, 0.25), 'securities-intermediaries-compliance-non-fund'),
  N('iii-c', 'Series III-C', 'Securities Intermediaries Compliance (Fund)', 'Operations & Compliance', P(100, 100, 120, 60, 0.25), 'nism-series-iii-c-securities-intermediaries-compliance-fund'),
  N('iv', 'Series IV', 'Interest Rate Derivatives', 'Derivatives', P(100, 100, 120, 60, 0.25), 'interest-rate-derivatives'),
  N('v-a', 'Series V-A', 'Mutual Fund Distributors', 'Mutual Funds', P(100, 100, 120, 50, 0.25), 'mutual-fund-distributors', { popular: true }),
  N('v-b', 'Series V-B', 'Mutual Fund Foundation', 'Mutual Funds', P(50, 50, 60, 50, 0), 'mutual-fund-foundation'),
  N('v-c', 'Series V-C', 'Mutual Fund Distributors (Level 2)', 'Mutual Funds', P(100, 100, 120, 60, 0.25), 'certifications', { note: 'This exam is not in NISM\'s current list of certifications. Check nism.ac.in before you prepare for it.' }),
  N('v-d', 'Series V-D', 'Mutual Fund – Specialized Investment Fund (SIF) Distributors', 'Mutual Funds', P(100, 100, 120, 60, 0.25), 'certification-exams/specialized-investment-fund-distributors', { isNew: true }),
  N('vi', 'Series VI', 'Depository Operations', 'Operations & Compliance', P(100, 100, 120, 60, 0.25), 'depository-operations'),
  N('vii', 'Series VII', 'Securities Operations and Risk Management', 'Operations & Compliance', P(100, 100, 120, 50, 0.25), 'securities-operations-and-risk-management', { popular: true }),
  N('viii', 'Series VIII', 'Equity Derivatives', 'Derivatives', P(100, 100, 120, 60, 0.25), 'equity-derivatives', { popular: true }),
  N('ix', 'Series IX', 'Merchant Banking', 'Operations & Compliance', P(100, 100, 120, 60, 0.25), 'merchant-banking'),
  N('x-a', 'Series X-A', 'Investment Adviser (Level 1)', 'Advisory & Research', P(100, 100, 180, 60, 0.25), 'investment-adviser-level-1', { popular: true }),
  N('x-b', 'Series X-B', 'Investment Adviser (Level 2)', 'Advisory & Research', P(100, 100, 180, 60, 0.25), 'investment-advisors-level-2'),
  N('xii', 'Series XII', 'Securities Markets Foundation', 'Foundation', P(100, 100, 120, 60, 0), 'securities-markets-foundation'),
  N('xiii', 'Series XIII', 'Common Derivatives', 'Derivatives', P(100, 100, 120, 60, 0.25), 'common-derivatives-certification-examination'),
  N('xv', 'Series XV', 'Research Analyst', 'Advisory & Research', P(100, 100, 180, 60, 0.25), 'research-analyst-certification-examination', { popular: true }),
  N('xvi', 'Series XVI', 'Commodity Derivatives', 'Derivatives', P(100, 100, 120, 60, 0.25), 'commodity-derivatives-certification-examination'),
  N('xvii', 'Series XVII', 'Retirement Adviser', 'Advisory & Research', P(100, 100, 120, 60, 0.25), 'retirement-adviser-certification-examination'),
  N('xix-a', 'Series XIX-A', 'Alternative Investment Funds (Category I and II) Distributors', 'AIF & PMS', P(100, 100, 120, 60, 0.25), 'certifications/nism-series-xix-a-alternative-investment-funds-category-i-and-ii-distributors'),
  N('xix-b', 'Series XIX-B', 'Alternative Investment Funds (Category III) Distributors', 'AIF & PMS', P(100, 100, 120, 60, 0.25), 'nism-series-xix-b-alternative-investment-funds-category-iii-distributors'),
  N('xix-c', 'Series XIX-C', 'Alternative Investment Fund Managers', 'AIF & PMS', P(100, 100, 180, 60, 0.25), 'nism-series-xix-c-alternative-investment-fund-managers'),
  N('xix-d', 'Series XIX-D', 'Category I and II Alternative Investment Fund Managers', 'AIF & PMS', P(100, 100, 180, 60, 0.25), 'certifications/nism-series-xix-d-category-i-and-ii-alternative-investment-fund-managers', { isNew: true }),
  N('xix-e', 'Series XIX-E', 'Category III Alternative Investment Fund Managers', 'AIF & PMS', P(100, 100, 180, 60, 0.25), 'nism-series-xix-e-category-iii-alternative-investment-fund-managers-certification-examination', { isNew: true }),
  N('xxi-a', 'Series XXI-A', 'Portfolio Management Services (PMS) Distributors', 'AIF & PMS', P(100, 100, 120, 60, 0.25), 'about-portfolio-management-services-pms-distributors-certification-examination', { popular: true }),
  N('xxi-b', 'Series XXI-B', 'Portfolio Managers', 'AIF & PMS', P(100, 100, 180, 60, 0.25), 'certifications/nism-series-xxi-b-portfolio-managers-certification-examination'),
  N('xxii', 'Series XXII', 'Fixed Income Securities', 'Foundation', P(100, 100, 120, 60, 0.25), 'certifications', { note: 'This exam is not in NISM\'s current list of certifications. Check nism.ac.in before you prepare for it.' }),
  N('xxiii', 'Series XXIII', 'Social Impact Assessors', 'Advisory & Research', P(100, 100, 120, 60, 0.25), 'nism-series-xxiii-social-auditors-certification-examination'),
  N('xxiv', 'Series XXIV', 'AML and CFT Provisions in Securities Markets', 'Operations & Compliance', P(100, 100, 120, 60, 0.25), 'nism-series-xxiv-aml-and-cft-provisions-in-securities-markets-certification-examination', { isNew: true }),
  N('xxv-a', 'Series XXV-A', 'Persons Associated with Research Services (Sales and Other Non-Core Services)', 'Advisory & Research', P(100, 100, 120, 60, 0.25), 'nism-series-xxv-a-persons-associated-with-research-services-sales-and-other-non-core-services-certification-examination', { isNew: true }),
  N('xxv-b', 'Series XXV-B', 'Persons Associated with Investment Advice (Sales and Other Non-Core Services)', 'Advisory & Research', P(100, 100, 120, 60, 0.25), 'nism-series-xxv-b-persons-associated-with-investment-advice-sales-and-other-non-core-services-certification-examination', { isNew: true }),

  // ---------- Banking ----------
  { id: 'ibps-po', series: 'IBPS PO', name: 'IBPS Probationary Officer (Prelims)', group: 'Banking', category: 'Banking', pattern: P(100, 100, 60, 45, 0.25), popular: true,
    links: [{ label: 'Official notifications & syllabus', url: 'https://www.ibps.in/', kind: 'info' }] },
  { id: 'ibps-clerk', series: 'IBPS Clerk', name: 'IBPS Clerk (Prelims)', group: 'Banking', category: 'Banking', pattern: P(100, 100, 60, 45, 0.25),
    links: [{ label: 'Official notifications & syllabus', url: 'https://www.ibps.in/', kind: 'info' }] },
  { id: 'sbi-po', series: 'SBI PO', name: 'SBI Probationary Officer (Prelims)', group: 'Banking', category: 'Banking', pattern: P(100, 100, 60, 45, 0.25),
    links: [{ label: 'Official careers page', url: 'https://sbi.co.in/web/careers', kind: 'info' }] },
  { id: 'sbi-clerk', series: 'SBI Clerk', name: 'SBI Junior Associate (Prelims)', group: 'Banking', category: 'Banking', pattern: P(100, 100, 60, 45, 0.25),
    links: [{ label: 'Official careers page', url: 'https://sbi.co.in/web/careers', kind: 'info' }] },
  { id: 'rbi-b', series: 'RBI Grade B', name: 'RBI Grade B Officer (Phase I)', group: 'Banking', category: 'Banking', pattern: P(200, 200, 120, 40, 0.25),
    links: [{ label: 'RBI recruitment notices', url: 'https://opportunities.rbi.org.in/', kind: 'info' }] },

  // ---------- SSC ----------
  { id: 'ssc-cgl', series: 'SSC CGL', name: 'Combined Graduate Level (Tier 1)', group: 'SSC', category: 'SSC', pattern: P(100, 200, 60, 40, 0.25), popular: true,
    links: [{ label: 'Official notices & syllabus', url: 'https://ssc.gov.in/', kind: 'info' }] },
  { id: 'ssc-chsl', series: 'SSC CHSL', name: 'Combined Higher Secondary Level (Tier 1)', group: 'SSC', category: 'SSC', pattern: P(100, 200, 60, 40, 0.25),
    links: [{ label: 'Official notices & syllabus', url: 'https://ssc.gov.in/', kind: 'info' }] },
  { id: 'ssc-mts', series: 'SSC MTS', name: 'Multi-Tasking (Non-Technical) Staff', group: 'SSC', category: 'SSC', pattern: P(90, 270, 90, 40, 1 / 3),
    links: [{ label: 'Official notices & syllabus', url: 'https://ssc.gov.in/', kind: 'info' }] },

  // ---------- MBA entrance ----------
  { id: 'cat', series: 'CAT', name: 'Common Admission Test', group: 'MBA', category: 'MBA', pattern: P(66, 198, 120, 50, 1 / 3), popular: true,
    links: [{ label: 'Official CAT website', url: 'https://iimcat.ac.in/', kind: 'info' }] },
  { id: 'cmat', series: 'CMAT', name: 'Common Management Admission Test', group: 'MBA', category: 'MBA', pattern: P(100, 400, 180, 50, 0.25),
    links: [{ label: 'Official CMAT website (NTA)', url: 'https://exams.nta.ac.in/CMAT/', kind: 'info' }] },
  { id: 'mat', series: 'MAT', name: 'Management Aptitude Test', group: 'MBA', category: 'MBA', pattern: P(150, 150, 120, 50, 0.25),
    links: [{ label: 'Official MAT website (AIMA)', url: 'https://mat.aima.in/', kind: 'info' }] },

  // ---------- Insurance & finance ----------
  { id: 'ic-38', series: 'IRDAI IC-38', name: 'Insurance Agents Pre-Recruitment Exam', group: 'Insurance & Finance', category: 'Insurance & Finance', pattern: P(50, 50, 60, 35, 0), popular: true,
    links: [{ label: 'Insurance Institute of India', url: 'https://www.insuranceinstituteofindia.com/', kind: 'info' }, { label: 'IRDAI (regulator)', url: 'https://irdai.gov.in/', kind: 'info' }] },
  { id: 'ncfm-cmd', series: 'NCFM', name: 'Capital Market (Dealers) Module', group: 'Insurance & Finance', category: 'Insurance & Finance', pattern: P(60, 100, 105, 50, 0.25),
    links: [{ label: 'NSE Academy', url: 'https://www.nseacademy.co.in/', kind: 'info' }] },
  { id: 'jaiib', series: 'JAIIB', name: 'Junior Associate of the Indian Institute of Bankers (per paper)', group: 'Insurance & Finance', category: 'Insurance & Finance', pattern: P(100, 100, 120, 50, 0),
    links: [{ label: 'IIBF — syllabus & study material', url: 'https://www.iibf.org.in/', kind: 'info' }] },
  { id: 'caiib', series: 'CAIIB', name: 'Certified Associate of the Indian Institute of Bankers (per paper)', group: 'Insurance & Finance', category: 'Insurance & Finance', pattern: P(100, 100, 120, 50, 0),
    links: [{ label: 'IIBF — syllabus & study material', url: 'https://www.iibf.org.in/', kind: 'info' }] },
];
