// Proof Rider rules engine + SHA-256. Pasted into n8n Code nodes by build.mjs (everything above the EXPORTS line).
// Sections verified against the Act texts (PRS copies). Items with verified:false come from one secondary source.

const DAY = 86400000;
const toDate = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => isoDate(new Date(toDate(s).getTime() + n * DAY));

function addWorkingDays(dateStr, n) {
  // shortcut: skips Sundays only, no public-holiday list — add one before real use
  let d = toDate(dateStr), added = 0;
  while (added < n) { d = new Date(d.getTime() + DAY); if (d.getUTCDay() !== 0) added++; }
  return isoDate(d);
}

const LAW = {
  TG: { act: 'Telangana Platform Based Gig Workers Act 2026', noticeDays: 7, noticeSec: 'section 14', exception: 'a threat to the customer', changeSec: 'section 13(2)', deductSec: 'section 15(1)' },
  KA: { act: 'Karnataka Platform Based Gig Workers Act 2025', noticeDays: 14, noticeSec: 'section 14(2)', exception: 'bodily harm', changeSec: 'section 12(3)', deductSec: 'section 15(1)' },
};
const EXCEPTION_HINT = /harm|assault|violen|threat|attack|abuse|safety|misbehav/i;
const GENERIC_REASON = /policy|violation|terms|guideline|not specified|complaints?\b/i;

function checkDeactivation({ state, deact, notices = [], today }) {
  const L = LAW[state] || LAW.TG;
  const blocked = (deact && deact.date) || today;
  const prior = notices.map((n) => n.date).filter((d) => d && d <= blocked).sort();
  const lastNotice = prior[prior.length - 1] || null;
  const gap = lastNotice ? Math.round((toDate(blocked) - toDate(lastNotice)) / DAY) : null;
  const reason = ((deact && (deact.stated_reason_en || deact.stated_reason)) || '').trim();
  const exceptionLikely = EXCEPTION_HINT.test(reason);
  const findings = [];

  if (gap === null || gap < L.noticeDays) {
    findings.push({
      rule: gap === null ? 'No prior notice found' : `Notice given only ${gap} days before the block`,
      law: `${L.act}, ${L.noticeSec}`,
      requires: `${L.noticeDays} days' prior notice with valid reasons in writing`,
      verified: !exceptionLikely,
      note: exceptionLikely ? `The stated reason may fall under the exception for ${L.exception}, where immediate action is allowed.` : null,
    });
  }
  if (!reason || (GENERIC_REASON.test(reason) && reason.length < 60)) {
    findings.push({ rule: 'No specific written reason given', law: `${L.act}, ${L.noticeSec}`, requires: 'valid reasons in writing', verified: true, note: null });
  }

  let deadline = null;
  if (state === 'KA') {
    findings.push({ rule: 'Where to complain', law: `${L.act}, section 22`, requires: 'The Internal Dispute Resolution Committee must finish within 14 days with a written Action Taken Report; if not, the grievance goes to the Board', verified: true, note: null });
  } else {
    deadline = addWorkingDays(blocked, 7);
    findings.push({ rule: 'Complaint deadline', law: 'Telangana Platform Based Gig Workers Rules 2026', requires: 'complaint within 7 working days of the dispute', deadline, verified: false, note: null });
  }
  const violation = findings.some((f) => f.rule.startsWith('No prior') || f.rule.startsWith('Notice given only'));
  return { blocked_on: blocked, last_notice: lastNotice, notice_gap_days: gap, findings, deadline, violation };
}

function calcUnderpay({ rateCard, screen }) {
  const out = { orders_checked: 0, orders_underpaid: 0, expected_total: 0, paid_total: 0, order_shortfall: 0, slab_shortfall: 0, shortfall: 0, unexplained_deductions: [] };
  const rc = rateCard;
  for (const o of (screen.orders || [])) {
    if (!rc || o.km == null || o.paid == null) continue;
    const expected = Number(rc.base_per_order || 0) + Number(rc.per_km || 0) * Math.max(0, o.km - Number(rc.included_km || 0));
    out.orders_checked++; out.expected_total += expected; out.paid_total += o.paid;
    if (o.paid < expected - 0.5) { out.orders_underpaid++; out.order_shortfall += expected - o.paid; }
  }
  const p = screen.payout;
  if (p) {
    out.unexplained_deductions = (p.deductions || []).filter((d) => d.amount && !(d.reason && d.reason.trim()));
    const slabs = (rc && rc.slabs) || [];
    const earned = slabs.filter((s) => p.orders_count != null && p.orders_count >= s.min_orders).sort((a, b) => b.bonus - a.bonus)[0];
    if (earned && p.incentive != null && p.incentive < earned.bonus) out.slab_shortfall = earned.bonus - p.incentive;
  }
  for (const k of ['expected_total', 'paid_total', 'order_shortfall', 'slab_shortfall']) out[k] = Math.round(out[k]);
  out.shortfall = out.order_shortfall + out.slab_shortfall;
  return out;
}

function detectRateChange({ prev, next, notices = [], today }) {
  if (!prev) return { first_card: true, changed: [], violation: false };
  const LABELS = { base_per_order: 'base pay per order', per_km: 'pay per km', included_km: 'km included in base pay' };
  const changed = [];
  for (const [k, label] of Object.entries(LABELS)) {
    if (next[k] != null && prev[k] != null && Number(next[k]) !== Number(prev[k])) changed.push({ field: label, old: Number(prev[k]), new: Number(next[k]) });
  }
  if (next.slabs && prev.slabs && JSON.stringify(next.slabs) !== JSON.stringify(prev.slabs)) changed.push({ field: 'incentive slabs', old: prev.slabs, new: next.slabs });
  const changedOn = next.effective_from || today;
  const noticeFound = notices.some((n) => n.date && n.date <= addDays(changedOn, -14));
  return { first_card: false, changed, changed_on: changedOn, notice_found: noticeFound, violation: changed.length > 0 && !noticeFound };
}

function sha256Hex(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length, total = Math.ceil((len + 9) / 64) * 64;
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const bits = len * 8, dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000)); dv.setUint32(total - 4, bits >>> 0);
  const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i-15], 7) ^ r(w[i-15], 18) ^ (w[i-15] >>> 3), s1 = r(w[i-2], 17) ^ r(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

// EXPORTS
if (typeof module !== 'undefined') module.exports = { addWorkingDays, checkDeactivation, calcUnderpay, detectRateChange, sha256Hex };
