# Bas Bhej Do · Proof Rider

**"Your screenshots are your payslip, your evidence and your union."**

A WhatsApp bot for delivery riders. A rider forwards any app screenshot and gets back:

- **An evidence receipt.** The original is stored unchanged with a SHA-256 fingerprint and the time it arrived.
- **A check against the law.** Karnataka Gig Workers Act 2025 and Telangana Gig Workers Act 2026: notice before deactivation, reasons for deductions, 14 days' notice before pay-rule changes.
- **A pay check** against the rider's rate card ("₹312 short this week").
- **A voice reply** in Telugu, Hindi, Kannada or English, then a short voice interview.
- **A ready-to-sign complaint PDF**, also sent to the union.
- **A collective alert** when many riders at one store see the same unannounced pay cut.

## Stack
WhatsApp Cloud API · n8n (every workflow) · Claude API (reads screenshots, writes replies) · Sarvam AI (Telugu, Hindi and Kannada speech) · Supabase (Postgres + private storage) · Google Drive (PDF)

## Repo
| Path | What |
|---|---|
| `demo/index.html` | Self-playing demo (rider phone + union phone, real Telugu voice clips). Press → or Space to skip a voice note. |
| `n8n/build.mjs` | Builds all `PR –` n8n workflows through the n8n API |
| `n8n/rules.js` | Legal rules engine, pay calculator, rate-change detector, SHA-256 (tested: `node n8n/rules.test.js`) |
| `n8n/schema.sql` | Supabase tables, private bucket, demo seed |
| `n8n/SETUP.md` | Setup guide |
| `docs/` | Build plan, verified sources, Claude prompts |

## Honest status
The pipeline runs end-to-end up to WhatsApp delivery: receiving messages, onboarding, evidence hashing and storage, and Claude extraction. Claude prompts and Sarvam voice are tested with real keys. Outgoing WhatsApp replies are waiting on Meta's display-name approval for the business number. "ZipDrop" is a fictional platform, and the 41-rider store data in the demo is simulated.

Secrets (API keys, tokens) are **not** in this repo. They live in n8n credentials and local files listed in `.gitignore`.
