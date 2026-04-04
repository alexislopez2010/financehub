# Lopez Family Finances

Private household finance dashboard for Alexis & Marilyn. React + Vite + Supabase, protected by email/password login + TOTP multi-factor auth. Deployed on Vercel.

## Stack

- **Frontend:** React 18 + Vite 5 + Tailwind + recharts + lucide-react
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Hosting:** Vercel (auto SSL, custom domain)
- **Data shape:** one shared `households` row, both users belong to it via `household_members`. RLS guarantees only members can read/write.

---

## Phase 1 setup — one-time

### 1. Create the Supabase project

1. Go to https://supabase.com → **New Project**. Pick a strong DB password; save it.
2. Open **SQL Editor** → **New query** → paste the contents of `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: disable "Confirm email" for faster testing, or leave it on and confirm the signup emails.
4. **Authentication → Policies → Multi-Factor Auth**: enable **TOTP**.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key. You'll also need the **service_role** key for the data migration (keep it secret).

### 2. Migrate existing Excel data

```bash
pip install openpyxl supabase
export SUPABASE_URL=https://<your-project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service-role key, NOT the anon key
python supabase/migrate_from_excel.py "/path/to/Family_Finance_Dashboard_2026.xlsx"
```

Add `--fresh` to wipe existing rows first. Re-run this any time you update the spreadsheet.

### 3. Configure the frontend locally

```bash
cd Lopez-Finances-App
cp .env.example .env
# edit .env:
#   VITE_SUPABASE_URL=https://<your-project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon public key>
npm install
npm run dev
```

Open http://localhost:5173. Create your account, set up TOTP with Google Authenticator / Authy / 1Password, and you'll land on the dashboard.

### 4. Push to GitHub

```bash
cd Lopez-Finances-App
git init
git add .
git commit -m "Initial commit — Lopez family finance dashboard"
gh repo create lopez-finances --private --source=. --push
```

### 5. Deploy to Vercel

1. Go to https://vercel.com → **Add New → Project** → import the `lopez-finances` repo.
2. Framework preset: **Vite** (auto-detected).
3. **Environment variables** (Production + Preview + Development):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Deploy. You'll get `https://lopez-finances.vercel.app`.

### 6. Custom domain

- **Vercel → Project → Settings → Domains → Add** → enter your domain (e.g. `finances.lopezfamily.com`).
- Vercel will show you DNS records. Add them at your registrar (GoDaddy, Namecheap, Cloudflare, etc.). SSL is auto-provisioned.

### 7. Add Marilyn

Marilyn visits the deployed URL → **Create account** → confirms email → sets up her own TOTP. The database trigger `handle_new_user` auto-adds her to the Lopez household as a `member`. She immediately sees the same dashboard.

---

## Local development

```bash
npm run dev       # dev server on :5173
npm run build     # production build in dist/
npm run preview   # preview the production build locally
```

## Project layout

```
Lopez-Finances-App/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── supabase/
│   ├── schema.sql              # run this in Supabase SQL editor
│   └── migrate_from_excel.py   # imports xlsx → Supabase
└── src/
    ├── main.jsx
    ├── App.jsx                 # auth router: login → MFA enroll → MFA challenge → dashboard
    ├── index.css
    ├── lib/supabase.js
    ├── hooks/useFinanceData.js
    └── components/
        ├── Auth/
        │   ├── AuthShell.jsx
        │   ├── Login.jsx
        │   ├── Signup.jsx
        │   ├── MFAEnroll.jsx
        │   └── MFAChallenge.jsx
        └── Dashboard/
            └── Dashboard.jsx
```

## Security model

- **Row Level Security** on every table. `is_household_member()` is the gate.
- Clients hold the **anon key** only — it gives no DB access without an authenticated session.
- The **service_role key** is used only by the migration script on your machine; it never leaves your laptop.
- **TOTP MFA is required** for every session (enforced in `App.jsx` — if `aal1` and `nextLevel = aal2`, the user is routed to `MFAChallenge`).
- To remove a family member's access: delete them from **Supabase → Authentication → Users**. They're immediately locked out; data stays intact.

## Phase 2 — Claude natural-language layer (next)

Planned but not built yet. Will add a `/api/ask` Vercel Edge Function that takes a prompt, queries Supabase with the user's JWT (so RLS still applies), passes the results to Claude Sonnet 4.6, and streams the answer back. Questions like "what did we spend on groceries in March?" or "where can we trim to save $2k?" will work end-to-end.
