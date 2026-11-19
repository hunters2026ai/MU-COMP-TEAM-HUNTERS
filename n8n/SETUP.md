# Proof Rider — n8n setup (≈30 min)

All 12 workflows are already on the server, named `PR – …`:
https://pgp27-n8n.mesaschool.co.in — open **PR – 01 ROUTER** to see the whole flow.

| Workflow | Job |
|---|---|
| PR – 01 ROUTER | WhatsApp in → dedupe → find rider → send to the right sub-workflow |
| PR – ONBOARD | Language list → state buttons → consent buttons |
| PR – EVIDENCE | Download → SHA-256 → store original → receipt → Claude reads the screen |
| PR – RULES | Deactivation vs the Act → case → voice reply → starts interview |
| PR – INTERVIEW | 4 voice questions → timeline + statement → petition |
| PR – UNDERPAY | Orders/payout vs rate card → "₹312 short" |
| PR – RATECHANGE | New rate card vs old → no 14-day notice → collective case + union alert |
| PR – PETITION | Claude letter → Google Doc → PDF → WhatsApp (rider + union) |
| PR – ASK | Voice/text questions, language change, delete my data |
| PR – SPEAK | Every reply: WhatsApp text + Sarvam voice note |
| PR – TRANSCRIBE | Voice note → Sarvam STT → text |
| PR – 00 Credentials | Pick each credential once (see step 3) |

---

## 1. Supabase (5 min)

1. Create a project at supabase.com.
2. **SQL Editor → New query** → paste all of `n8n/schema.sql` → **Run**. This creates the tables, the private `evidence` bucket and 40 demo riders at "ZipDrop Madhapur".
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key (secret — only goes into n8n).

> Mock screenshots must show the store as exactly **ZipDrop Madhapur**, or the rate-change and pay checks won't find the seeded data.

## 2. WhatsApp (Meta) (10 min)

In developers.facebook.com → your app → **WhatsApp → API Setup**:
- Note the **Phone number ID** (not the phone number).
- Add up to 5 test recipients: your team's phones + the "union" phone.
- Create a **permanent token**: Business Settings → System users → add → generate token with `whatsapp_business_messaging` + `whatsapp_business_management`.
- **App settings → Basic**: note the **App ID** and **App Secret** (for the trigger).

## 3. Credentials in n8n (10 min)

**Settings → Credentials → Add credential.** Create these six:

| Name | Type | Fields |
|---|---|---|
| `PR Claude` | Header Auth | Name `x-api-key` · Value = Claude API key |
| `PR Sarvam` | Header Auth | Name `api-subscription-key` · Value = Sarvam key |
| `PR WhatsApp Bearer` | Header Auth | Name `Authorization` · Value = `Bearer <permanent token>` |
| `PR Supabase` | Custom Auth | JSON below |
| `PR WhatsApp Trigger` | WhatsApp OAuth API | App ID + App Secret |
| `PR Google Drive` | Google Drive OAuth2 API | Google Cloud OAuth client ID + secret, then **Sign in** |

Supabase Custom Auth JSON:
```json
{ "headers": { "apikey": "SERVICE_ROLE_KEY", "Authorization": "Bearer SERVICE_ROLE_KEY" } }
```

Then open **PR – 00 Credentials (pick once)**, click each of the 6 nodes, choose the matching credential, and **Save**. Tell Claude "credentials picked" — it copies them into every node of every PR workflow (≈60 nodes), so nobody clicks through them by hand.

## 4. Settings (1 min)

Edit `n8n/config.json` (or tell Claude the values — none are secret):
```json
{ "SUPABASE_URL": "https://xxxx.supabase.co", "WA_PHONE_NUMBER_ID": "1234567890", "UNION_PHONE": "9198xxxxxxxx" }
```
Phone numbers are in international format without `+`.

## 5. Apply + switch on

```bash
node n8n/build.mjs --pick-creds
```
```bash
node n8n/build.mjs
```
Then open **PR – 01 ROUTER** → toggle **Active**. Only the router needs to be active; the others run when it calls them. Activating registers the webhook with Meta automatically.

## 6. Smoke test (in this order)

1. Send "hi" from a test phone → language list → Telangana → Agree + union → welcome **voice note**.
2. Send a weekly payout screenshot → `🧾 Evidence #PR-0001 saved` → pay-check voice note.
3. Send the same screenshot again → "Already saved as #PR-0001".
4. Send the deactivation screenshot → legal check voice note → question 1/4 → answer the 4 questions **by voice** → complaint PDF arrives (rider + union phone).
5. Send the new rate card (base ₹20) → "changed without 14 days' notice — 41 riders affected" → union phone gets the alert + collective PDF.

If a step fails: n8n → **Executions** → open the red run → the failing node shows the error. The usual suspects are a missing credential, a wrong `WA_PHONE_NUMBER_ID`, or Supabase URL typos.

## Rebuilding

`node n8n/build.mjs` re-creates every PR workflow from code — **edits made by hand in the n8n UI are overwritten**. Make changes in `n8n/build.mjs` (or ask Claude), not in the canvas, once the team is using it.
