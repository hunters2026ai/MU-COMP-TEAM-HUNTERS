# Proof Rider — 6-Hour Build Plan (v3)

> "Your screenshots are your payslip, your evidence and your union."
> **WhatsApp chatbot only.** n8n (every workflow) · Claude API · Sarvam API · Supabase · Google Docs (petition PDF)
> 5 hours build · 1 hour presentation

---

## 1. What we build (and what we don't)

| Layer | Feature we BUILD | Why it wins |
|---|---|---|
| Core | Screenshot → evidence receipt (SHA-256) → legal check → voice reply in rider's language | The Mirror constraint: screenshot in, action out |
| Layer 2 | **#6 Underpayment calculator** — rate card + order screenshots → "₹312 short this week" | A concrete ₹ claim |
| Layer 2 | **#7 Silent rate-change detector** — pooled rate cards change without 14-day notice → collective case | "Your union" promise; verified law in both states |
| Layer 3 | **#8 Voice interview** — 4 Telugu/Hindi voice questions build the case timeline | Shows Sarvam deeply; fills gaps a screenshot can't |
| Output | Grievance PDF + case alert to union case-worker on WhatsApp | Something the process can act on |

**Slides only (not built):** tamper check, Merkle/anchoring, UI fingerprinting, redaction, dashboard, reminders, triage score, outcome learning, worker data trust (#11 — business model slide).

---

## 2. Before the clock starts (do the day before if allowed)

- [ ] Meta developer app + WhatsApp Cloud API **test number**; add up to 5 verified recipients (2 judges' phones? → use team phones + 1 "union" phone)
- [ ] Permanent access token (System User) — temp tokens expire in 24h
- [ ] n8n Cloud account (public webhook URL, no ngrok)
- [ ] Claude API key · Sarvam API key · Supabase project · Google account for Docs/Drive
- [ ] Google Doc petition template with `{{placeholders}}`
- [ ] 8–10 **mock screenshots** of a fictional platform ("ZipDrop") in real quick-commerce UI style: 2 deactivation (Telugu + Hindi), 2 rate cards (old/new), 4 order earnings, 1 weekly payout. Built as HTML by frontend lead, screenshotted on phone.

> **No templates needed in the demo:** every recipient (rider phones, union phone) messages the bot first, so we're inside the 24-hour window. Have the union phone send "hi" before the pitch.

---

## 3. Architecture

```
Rider WhatsApp ─► WF0 ROUTER (WhatsApp Trigger)
                     │ dedupe wa_message_id · rider lookup
                     ├─ unknown rider ───────────► WF1 ONBOARD
                     ├─ active interview? ───────► WF4 INTERVIEW (voice/text answers)
                     ├─ image ───────────────────► WF2 EVIDENCE + EXTRACT
                     │                               └─ switch screen_type
                     │                                   ├─ deactivation ─► WF3 RULES ─► WF4 INTERVIEW ─► WF7 PETITION
                     │                                   ├─ order/payout ─► WF5 UNDERPAY
                     │                                   └─ rate_card ────► WF6 RATE-CHANGE ─► union alert
                     └─ text/voice ──────────────► WF8 ASK (status · my evidence · help)

Shared sub-workflow: SPEAK (text + lang → Sarvam TTS → send audio + text)
Storage: Supabase Postgres + private bucket
```

---

## 4. Workflows (n8n)

### WF0 Router
WhatsApp Trigger → Supabase: `wa_message_id` exists? stop → get rider by phone → Switch (order matters): unknown → WF1 · `interviews.status='active'` → WF4 · image → WF2 · audio → Sarvam STT → WF8 · text → WF8.

### WF1 Onboard (once)
List reply: language (te-IN / hi-IN / kn-IN / en-IN) → buttons: state (TG / KA) → consent text ("We store your screenshots as evidence; only anonymous totals are shared; reply DELETE anytime") → buttons: **Agree** · **Share cases with my union? Yes/No** → insert `riders`.

### WF2 Evidence + Extract
1. WhatsApp Media → Download (binary)
2. **Crypto node → SHA-256**; same hash exists → reply "Already saved as #PR-xxxx", stop
3. Upload original to private bucket `evidence/{phone}/{id}.jpg`
4. Insert `evidence` (PR-id, sha256, received_at server time, wa_message_id, phone, path)
5. **Reply instantly:** `🧾 Evidence #PR-0412 saved · SHA-256 3f9a…c21 · 19 Nov 14:32`
6. Claude vision (`claude-opus-5-5`, effort medium — prompt P1 in CLAUDE_PROMPTS.md) → JSON → insert `screens`
7. Switch on `screen_type`

### WF3 Rules check (deactivation)
Code node, rule pack §5 → `findings[]` (rule, citation, verified, deadline) → Claude writes 3–4 spoken sentences in rider's language → **SPEAK** → then "Main 4 sawaal poochunga, aapka case mazboot hoga" → start WF4.

### WF4 Voice interview (#8)
State in `interviews(phone, case_id, step, answers jsonb, status)`. Fixed questions (stable > free agent):

| Step | Question (spoken, rider's language) | Extracted field |
|---|---|---|
| 1 | When did your ID get blocked? | `blocked_at` |
| 2 | Did you get any notice or message before that? | `notice_received` (bool + date) |
| 3 | Any customer complaint or incident that day? | `incident` |
| 4 | How much did you earn in a normal week? | `weekly_income` |

Each answer: voice → **Sarvam STT** (text → as-is) → Claude (P3, effort low) extracts the field → save → next question via SPEAK. After step 4: Claude builds a dated timeline + first-person statement → rerun WF3 with interview facts (e.g. "no notice" confirmed by rider) → WF7.

### WF5 Underpayment calculator (#6)
Order/payout screen → fetch latest `rate_cards` for rider's store → Code node:
`expected = base + per_km × max(0, km − included_km)` (+ slab bonus if orders ≥ threshold) → `shortfall = Σ(expected − paid)` over the week → reply: "Is hafte ₹312 kam mila — 4 orders rate card se kam. Evidence #PR-0415–0418." → add to rider's open case if any.

### WF6 Silent rate-change detector (#7)
Rate card screen → insert `rate_cards(store, platform, effective_from, base, per_km, slabs, evidence_id)` → compare with previous card for same store → any field changed? → any `notice` screen for that store in the 14 days before? (pooled across riders) → if none: **violation** (KA s.12(3) / TG s.13(2)) → Supabase count of riders at that store (≥5 to show) →
- rider: "Ye rate card bina 14 din notice ke badla — aap akele nahi, 38 riders affected."
- **union phone:** "⚠️ Collective case: ZipDrop Madhapur, base ₹25→₹20 on 12 Nov, no notice, 38 riders, est. ₹X/week lost." + collective petition PDF (WF7).

### WF7 Petition + union alert
Insert `cases` → Google Drive copy template → Docs batchUpdate fill (rider facts, findings with citations, interview timeline, underpayment total, evidence annex: ID · time · SHA-256) → Drive export PDF → send PDF on WhatsApp → if `union_share`: send case summary + PDF to union phone. Footer: "Draft for review — not legal advice. Consult union / legal aid."

### WF8 Ask
Claude (P6, effort low) picks one intent: `case_status` · `my_evidence` · `resend_petition` · `delete_my_data` (confirm button → delete rows + files) · `help` → reply via SPEAK.

### SPEAK (shared)
HTTP → Sarvam TTS (`target_language_code`, speaker, model) → base64 → Convert to File → WhatsApp send audio → WhatsApp send text. **Fallback:** if WhatsApp rejects the audio format, send it as a document.

---

## 5. Rule pack (verified against the Acts — PRS copies)

| ID | Rule | KA | TG | Verified |
|---|---|---|---|---|
| NOTICE | Deactivation needs written reasons + prior notice | s.14(2): **14 days** (exception: bodily harm) | s.14: **7 days** + due enquiry (exception: threat to consumer) | ✅ |
| DEDUCT | Reason for each deduction must be given | s.15(1) (in the invoice) | s.15(1) | ✅ |
| CHANGE | Contract terms changed only with **14 days' notice** | s.12(3) | s.13(2) (also covers automated-system changes) | ✅ |
| GRIEVANCE | Where to file | s.22: IDRC must finish in 14 days, else → Board | Rules: 7 working days to file (single source) | KA ✅ / TG ❌ |

Unverified rules are phrased "may" in replies. Never say "void".

**Tests (Code node, run before demo):** KA no notice → violation · KA 15-day notice → OK · TG 6-day notice → violation · rate change with notice 14 days before → OK · underpayment math on 3 sample orders.

---

## 6. Claude extraction schema (WF2)

```json
{
  "screen_type": "deactivation|order_earnings|weekly_payout|rate_card|notice|penalty|other",
  "platform": "", "store": "", "zone": "", "date": "YYYY-MM-DD",
  "language_on_screen": "te|hi|kn|en",
  "deactivation": {"date": "", "stated_reason": "", "stated_reason_en": "", "notice_mentioned": false},
  "order": {"order_id": "", "km": 0, "paid": 0},
  "payout": {"week": "", "base": 0, "incentive": 0, "deductions": [{"amount": 0, "reason": ""}], "orders": 0},
  "rate_card": {"effective_from": "", "base": 0, "per_km": 0, "included_km": 0, "slabs": [{"orders": 0, "bonus": 0}]},
  "confidence": 0.0
}
```

---

## 7. Supabase tables

`riders(phone pk, lang, state, store, union_share, consent_at)` ·
`evidence(id, phone, sha256 unique, received_at, wa_message_id unique, path)` ·
`screens(id, evidence_id, screen_type, data jsonb, synthetic)` ·
`rate_cards(id, store, platform, effective_from, base, per_km, included_km, slabs, evidence_id, synthetic)` ·
`cases(id, phone, type, findings jsonb, timeline jsonb, shortfall, pdf_url, status)` ·
`interviews(phone, case_id, step, answers jsonb, status)`

**Seed (SQL):** 40 riders at "ZipDrop Madhapur", old rate card (base ₹25) dated 1 Nov, 6 weeks of order rows. Live demo sends the *new* rate card (₹20) → triggers WF6. All seeded rows `synthetic = true` — say so on stage.

---

## 8. Team split (4 people) & timeline

| Role | Owns |
|---|---|
| **A — n8n lead** | WF0, WF1, WF2, SPEAK, wiring everything |
| **B — AI/logic** | Claude prompts + schema, rule pack + tests, WF5 math, WF4 extraction prompts |
| **C — Data + PDF** | Supabase schema + seed, WF6 SQL, WF7 Google Docs petition |
| **D — Frontend/pitch (you)** | Mock screenshots, Sarvam voice checks, demo script, slides, backup video |

| Time | A | B | C | D |
|---|---|---|---|---|
| 0:00–0:30 | Trigger echo bot live | Prompt on 3 mock screens | Tables + bucket | Screens ready; **test Sarvam TTS → WhatsApp audio + STT on a WhatsApp voice note** |
| 0:30–1:30 | WF2 + SPEAK | Schema stable · rule pack + tests | Seed data · petition template | Slides skeleton |
| 1:30–2:30 | WF3 + WF1 | WF5 calculator | WF6 detector SQL | Test every screen in all languages |
| 2:30–3:30 | WF4 interview | Interview prompts · timeline/statement | WF7 PDF | Demo script v1 |
| 3:30–4:15 | WF6 + WF7 wiring · WF8 | Fix extraction misses | Union alert | Full run-through #1 |
| **4:15–5:00** | **FREEZE features.** Run-through ×3, fix bugs only | | | **Record backup video** |
| 5:00–6:00 | Presentation: rehearse, each person owns 1 Q&A topic | | | |

**Cut order if behind:** WF8 → union alert PDF (text only) → WF4 to 2 questions → WF5 → never cut WF2/WF3/SPEAK.

---

## 9. Demo script (4 min)

1. **Hook (20s)** — "Blinkit keeps 6 months, Instamart 1 month, BigBasket 2 weeks. After that, a rider's only pay record is their gallery."
2. **Receipt (30s)** — Judge forwards a payout screenshot → `🧾 Evidence #PR-0412 saved`.
3. **Underpayment (30s)** — Order screenshots → "₹312 short this week."
4. **WOW: deactivation (75s)** — Telugu deactivation pop-up → Telugu voice: "No 7-day notice detected. Telangana Gig Workers Act s.14 requires 7 days' written notice with reasons." → bot asks 2 voice questions → rider answers by voice → petition PDF arrives.
5. **Collective (45s)** — Forward the new rate card → "Changed without 14 days' notice — 38 riders affected" → union phone buzzes on the projector with the collective case.
6. **Close (20s)** — "They still screenshot. We made every screenshot count."

---

## 10. Pitch fact sheet (verified)

- TGPWU (10,000+ members): 25–30 deactivation cases a week — TechCrunch, Jan 2023
- ~52% lost IDs over false client complaints (~1,200 workers) — VVGNLI via Business Standard, 2025
- 83% drivers / 87% delivery workers hit by ID blocking — "Prisoners on Wheels?", PAIGAM + IFAT with UPenn, 2024
- Blinkit 6 months, Instamart 1 month, BigBasket 2 weeks of history — Internet Research Lab, arXiv 2609.13178
- A Delhi pilot found incentives ≈ 23.5% of earnings — same paper ("a pilot found")
- Karnataka HC refused to stay the Act, 3 July 2026 — LiveLaw
- NITI Aayog projects 23.5M gig workers by 2029–30
- BSA s.63(4): e-evidence certificate needs a hash value (SC upheld, 2026); SHA-256 accepted — we generate the Part A draft

**Don't say:** "Karnataka 7-working-day window", "the block is void", WP 19746/2026.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Sarvam audio format rejected by WhatsApp | Test at 0:00; fallback send as document |
| WhatsApp voice note (ogg/opus) not accepted by Sarvam STT | Test at 0:00; fallback rider types the answer |
| Claude misreads a screen | Mock screens are clean; confidence < 0.6 → ask rider |
| Wi-Fi / Meta outage on stage | Backup video |
| Token expiry | Permanent System User token |
| "Is this real data?" | Seeded rows flagged synthetic; say it upfront |
