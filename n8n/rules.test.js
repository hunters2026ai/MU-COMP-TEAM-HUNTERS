// Run: node n8n/rules.test.js
const assert = require('node:assert');
const crypto = require('node:crypto');
const R = require('./rules.js');

// Working days skip Sundays: Mon 2026-11-16 + 7 working days → Tue 2026-11-24
assert.strictEqual(R.addWorkingDays('2026-11-16', 7), '2026-11-24');

// TG, no notice → violation + deadline
let r = R.checkDeactivation({ state: 'TG', deact: { date: '2026-11-17', stated_reason_en: 'Multiple customer complaints' }, notices: [], today: '2026-11-19' });
assert.ok(r.violation); assert.strictEqual(r.deadline, '2026-11-25');
assert.ok(r.findings.find((f) => f.rule === 'No specific written reason given'));

// TG, 6-day notice → violation; 7-day notice → OK
assert.ok(R.checkDeactivation({ state: 'TG', deact: { date: '2026-11-17', stated_reason_en: 'Late deliveries on 12 orders in October' }, notices: [{ date: '2026-11-11' }] }).violation);
assert.ok(!R.checkDeactivation({ state: 'TG', deact: { date: '2026-11-17', stated_reason_en: 'Late deliveries on 12 orders in October' }, notices: [{ date: '2026-11-10' }] }).violation);

// KA needs 14 days; no filing deadline in the Act
r = R.checkDeactivation({ state: 'KA', deact: { date: '2026-11-17', stated_reason_en: 'Late deliveries on 12 orders in October' }, notices: [{ date: '2026-11-05' }] });
assert.ok(r.violation); assert.strictEqual(r.deadline, null);

// Bodily-harm style reason → finding stays but is marked unverified ("may")
r = R.checkDeactivation({ state: 'KA', deact: { date: '2026-11-17', stated_reason_en: 'Physical assault on customer reported' }, notices: [] });
assert.strictEqual(r.findings[0].verified, false);

// Underpayment: base 25 + 6/km over 2 km
const rc = { base_per_order: 25, per_km: 6, included_km: 2, slabs: [{ min_orders: 60, bonus: 500 }] };
const u = R.calcUnderpay({ rateCard: rc, screen: { orders: [{ km: 4, paid: 37 }, { km: 5, paid: 30 }, { km: 1, paid: 25 }] } });
assert.strictEqual(u.orders_underpaid, 1); assert.strictEqual(u.shortfall, 13);
const s = R.calcUnderpay({ rateCard: rc, screen: { payout: { orders_count: 64, incentive: 200, deductions: [{ amount: 180, reason: null }] } } });
assert.strictEqual(s.slab_shortfall, 300); assert.strictEqual(s.unexplained_deductions.length, 1);

// Rate change without 14-day notice → violation; with it → OK
const prev = { base_per_order: 25, per_km: 6, included_km: 2, slabs: rc.slabs };
const next = { base_per_order: 20, per_km: 6, included_km: 2, slabs: rc.slabs, effective_from: '2026-11-12' };
assert.ok(R.detectRateChange({ prev, next, notices: [] }).violation);
assert.ok(!R.detectRateChange({ prev, next, notices: [{ date: '2026-10-28' }] }).violation);
assert.ok(R.detectRateChange({ prev: null, next }).first_card);

// SHA-256 matches Node's crypto on several sizes
for (const n of [0, 3, 55, 56, 64, 1000, 250000]) {
  const buf = crypto.randomBytes(n);
  assert.strictEqual(R.sha256Hex(buf), crypto.createHash('sha256').update(buf).digest('hex'));
}
console.log('all rules tests passed');
