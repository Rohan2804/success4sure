/* Success4Sure free calculators — runs on the static /tools/ pages. Each tool looks for its own form by id. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const num = (el) => { const v = parseFloat(String(el.value).replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  // Report one tool_use event per page, on the visitor's first real interaction with the calculator.
  let used = false;
  const usedOnce = (form) => { if (used) return; used = true; if (window.s4sTrack) window.s4sTrack('tool_use', { tool_name: form.id.replace(/-form$/, '') }); };
  const bind = (form, fn) => { form.addEventListener('input', () => { usedOnce(form); fn(); }); form.addEventListener('change', () => { usedOnce(form); fn(); }); form.addEventListener('submit', (e) => { e.preventDefault(); usedOnce(form); fn(); }); fn(); };

  // ---------- CTC to in-hand salary (new tax regime) ----------
  // New-regime slabs and rules as applied for FY 2026-27: standard deduction ₹75,000, section 87A rebate up to
  // ₹12 lakh taxable income (with marginal relief), surcharge above ₹50 lakh, 4% health & education cess.
  const SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  function slabTax(income) {
    let tax = 0, prev = 0;
    for (const [upto, rate] of SLABS) { if (income > prev) tax += (Math.min(income, upto) - prev) * rate; prev = upto; }
    return tax;
  }
  function newRegimeTax(taxable) {
    let tax = slabTax(taxable);
    if (taxable <= 1200000) tax = 0;
    else tax = Math.min(tax, taxable - 1200000); // marginal relief just above the rebate limit
    let sur = 0;
    if (taxable > 20000000) sur = 0.25; else if (taxable > 10000000) sur = 0.15; else if (taxable > 5000000) sur = 0.10;
    tax += tax * sur;
    return tax * 1.04;
  }
  const ctc = $('#ctc-form');
  if (ctc) bind(ctc, () => {
    const f = ctc.elements;
    const total = num(f.ctc), variable = Math.min(num(f.variable), total);
    const basic = (total - variable) * num(f.basicPct) / 100;
    const pfBase = f.pfCap.checked ? Math.min(basic, 15000 * 12) : basic;
    const pf = f.pfInCtc.checked ? pfBase * 0.12 : 0;
    const gratuity = f.gratuity.checked ? basic * 0.0481 : 0;
    const grossFixed = Math.max(0, total - variable - pf - gratuity);
    const employeePf = pfBase * 0.12;
    const pt = num(f.pt);
    const taxable = Math.max(0, grossFixed + variable - 75000);
    const tax = newRegimeTax(taxable);
    const inHandYear = grossFixed + variable - employeePf - pt - tax;
    const monthly = (grossFixed - employeePf - pt - tax * (grossFixed / Math.max(1, grossFixed + variable))) / 12;
    $('#ctc-out').innerHTML = `
      <div class="tool-result"><span>Estimated monthly in-hand salary</span><b>${inr(Math.max(0, monthly))}</b>
      <small>${variable ? `plus about ${inr(variable - tax * (variable / Math.max(1, grossFixed + variable)))} variable pay after tax, when paid` : 'per month, after PF, professional tax and income tax'}</small></div>
      <div class="table-wrap"><table>
        <tr><th>Annual CTC</th><td>${inr(total)}</td></tr>
        <tr><th>Less: employer PF${f.pfInCtc.checked ? '' : ' (not in CTC)'}</th><td>${inr(pf)}</td></tr>
        <tr><th>Less: gratuity${f.gratuity.checked ? '' : ' (not in CTC)'}</th><td>${inr(gratuity)}</td></tr>
        <tr><th>Less: variable / bonus</th><td>${inr(variable)}</td></tr>
        <tr><th>Gross fixed salary</th><td><b>${inr(grossFixed)}</b></td></tr>
        <tr><th>Less: employee PF (12% of basic)</th><td>${inr(employeePf)}</td></tr>
        <tr><th>Less: professional tax</th><td>${inr(pt)}</td></tr>
        <tr><th>Taxable income (after ₹75,000 standard deduction)</th><td>${inr(taxable)}</td></tr>
        <tr><th>Less: income tax incl. cess (new regime)</th><td>${inr(tax)}</td></tr>
        <tr><th>Take-home for the year (incl. variable)</th><td><b>${inr(inHandYear)}</b></td></tr>
      </table></div>`;
  });

  // ---------- SIP ----------
  const sip = $('#sip-form');
  if (sip) bind(sip, () => {
    const f = sip.elements;
    let monthly = num(f.amount); const years = Math.min(50, Math.max(1, Math.round(num(f.years))));
    const i = num(f.rate) / 100 / 12, step = num(f.stepup) / 100;
    let value = 0, invested = 0; const rows = [];
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) { value = (value + monthly) * (1 + i); invested += monthly; }
      rows.push([y, invested, value]);
      monthly *= 1 + step;
    }
    $('#sip-out').innerHTML = `
      <div class="tool-result"><span>Estimated value after ${years} years</span><b>${inr(value)}</b><small>Invested ${inr(invested)} · estimated gains ${inr(value - invested)}</small></div>
      <div class="tool-bar"><span style="width:${(invested / Math.max(1, value)) * 100}%"></span></div>
      <div class="tool-legend small muted"><span><i class="dot"></i>Invested</span><span><i class="dot dot-2"></i>Estimated gains</span></div>
      <details class="faq-item"><summary>Year-by-year table</summary><div class="table-wrap"><table><tr><th>Year</th><th>Invested</th><th>Estimated value</th></tr>
        ${rows.map(([y, inv, v]) => `<tr><td>${y}</td><td>${inr(inv)}</td><td>${inr(v)}</td></tr>`).join('')}</table></div></details>`;
  });

  // ---------- EMI ----------
  const emi = $('#emi-form');
  if (emi) bind(emi, () => {
    const f = emi.elements;
    const P = num(f.principal), r = num(f.rate) / 100 / 12, n = Math.max(1, Math.round(num(f.years) * 12));
    const e = r ? (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P / n;
    let bal = P; const rows = [];
    for (let m = 1; m <= n; m++) {
      const int = bal * r; bal = Math.max(0, bal - (e - int));
      if (m % 12 === 0 || m === n) rows.push([Math.ceil(m / 12), bal]);
    }
    const total = e * n;
    $('#emi-out').innerHTML = `
      <div class="tool-result"><span>Monthly EMI</span><b>${inr(e)}</b><small>Total interest ${inr(total - P)} · total payment ${inr(total)}</small></div>
      <div class="tool-bar"><span style="width:${(P / Math.max(1, total)) * 100}%"></span></div>
      <div class="tool-legend small muted"><span><i class="dot"></i>Principal</span><span><i class="dot dot-2"></i>Interest</span></div>
      <details class="faq-item"><summary>Outstanding balance by year</summary><div class="table-wrap"><table><tr><th>End of year</th><th>Balance left</th></tr>
        ${rows.map(([y, b]) => `<tr><td>${y}</td><td>${inr(b)}</td></tr>`).join('')}</table></div></details>`;
  });

  // ---------- Exam score ----------
  const score = $('#score-form');
  if (score && window.EXAMS) {
    const sel = score.elements.exam;
    const exams = window.EXAMS.filter((x) => x.pattern);
    const code = (x) => (x.group === 'NISM' ? 'NISM ' + x.series : x.series);
    sel.innerHTML = exams.map((x) => `<option value="${esc(x.id)}">${esc(code(x))} — ${esc(x.name)}</option>`).join('');
    const want = new URLSearchParams(location.search).get('exam');
    if (want && exams.some((x) => x.id === want)) sel.value = want;
    bind(score, () => {
      const f = score.elements, x = exams.find((y) => y.id === sel.value), p = x.pattern;
      const right = Math.min(p.questions, Math.max(0, Math.round(num(f.right))));
      const wrong = Math.min(p.questions - right, Math.max(0, Math.round(num(f.wrong))));
      f.right.max = p.questions; f.wrong.max = p.questions;
      const per = p.marks / p.questions, cut = per * (p.negative || 0);
      const marks = right * per - wrong * cut, pct = (marks / p.marks) * 100;
      const pass = pct >= p.passPct;
      $('#score-pattern').textContent = `${p.questions} questions · ${p.marks} marks · ${p.duration} min · ${p.negative ? `−${+(cut).toFixed(2)} per wrong answer` : 'no negative marking'}`;
      $('#score-out').innerHTML = `
        <div class="tool-result"><span>Your estimated score</span><b>${+marks.toFixed(2)} / ${p.marks}</b>
        <small>${pct.toFixed(1)}% · ${right} right, ${wrong} wrong, ${p.questions - right - wrong} not attempted${wrong && p.negative ? ` · ${+(wrong * cut).toFixed(2)} marks lost to negative marking` : ''}</small></div>
        <div class="notice ${pass ? 'ok' : ''}">${pass ? `Above the ${p.passPct}% ${x.group === 'NISM' || x.group === 'Insurance & Finance' ? 'pass mark' : 'target score'}.` : `Below the ${p.passPct}% ${x.group === 'NISM' || x.group === 'Insurance & Finance' ? 'pass mark' : 'target score'} — you need about ${Math.ceil(((p.passPct / 100) * p.marks - marks) / per)} more correct answers.`}</div>
        <p class="small"><a href="/exams/${esc(x.slug)}/">${esc(code(x))} mock tests</a> · <a href="/exams/${esc(x.slug)}/practice-questions/">Free ${esc(code(x))} practice questions</a></p>`;
    });
  }

  // ---------- NISM certificate validity ----------
  const nism = $('#nism-form');
  if (nism && window.EXAMS) {
    const sel = nism.elements.series;
    const list = window.EXAMS.filter((x) => x.group === 'NISM');
    sel.innerHTML = list.map((x) => `<option value="${esc(x.id)}">NISM ${esc(x.series)} — ${esc(x.name)}</option>`).join('');
    const today = new Date(); nism.elements.passed.max = today.toISOString().slice(0, 10);
    bind(nism, () => {
      const f = nism.elements, x = list.find((y) => y.id === sel.value);
      if (!f.passed.value) { $('#nism-out').innerHTML = '<p class="muted">Enter the date you passed the exam.</p>'; return; }
      const passed = new Date(f.passed.value + 'T00:00:00');
      const expiry = new Date(passed); expiry.setFullYear(expiry.getFullYear() + 3); expiry.setDate(expiry.getDate() - 1);
      const days = Math.ceil((expiry - new Date(today.toDateString())) / 86400000);
      const planFrom = new Date(expiry); planFrom.setMonth(planFrom.getMonth() - 3);
      const status = days < 0 ? `<div class="notice">Expired ${Math.abs(days)} days ago. Re-certify before you continue in a role that requires NISM ${esc(x.series)}.</div>`
        : days <= 90 ? `<div class="notice">Expires in ${days} days — start your renewal now.</div>`
        : `<div class="notice ok">Valid — ${days} days left.</div>`;
      $('#nism-out').innerHTML = `
        <div class="tool-result"><span>NISM ${esc(x.series)} certificate valid until</span><b>${fmtDate(expiry)}</b><small>Passed on ${fmtDate(passed)} · 3-year validity</small></div>
        ${status}
        <p>Plan your renewal from <b>${fmtDate(planFrom)}</b>. You can renew by passing the certification exam again, or — where NISM offers one for this series — by completing an NISM-accredited Continuing Professional Education (CPE) programme before the certificate expires. Confirm the current rules on <a href="https://www.nism.ac.in/" rel="noopener" target="_blank">nism.ac.in</a>.</p>
        <p class="small"><a href="/exams/${esc(x.slug)}/">NISM ${esc(x.series)} mock tests</a> · <a href="/exams/${esc(x.slug)}/practice-questions/">Free practice questions</a></p>`;
    });
  }
})();
