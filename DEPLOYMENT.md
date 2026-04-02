# FinanceHub — Deployment Guide

## What You Need

| Step | Service | Cost | Time |
|------|---------|------|------|
| 1. Supabase project | supabase.com | Free tier (500MB DB, 50K auth users) | 5 min |
| 2. Run DB migration | Supabase SQL Editor | — | 2 min |
| 3. Seed Excel data | Python script | — | 2 min |
| 4. Configure .env | — | — | 1 min |
| 5. Deploy to Vercel | vercel.com | Free tier (100GB bandwidth) | 5 min |
| 6. Custom domain (optional) | Any registrar | ~$12/yr | 10 min |

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → Sign up / Log in
2. Click **New Project**
3. Choose a name (e.g., `financehub`), set a DB password, pick a region close to you
4. Wait ~2 minutes for provisioning
5. Go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon / public** key
   - **service_role** key (for seeding only — never expose this in frontend)

## Step 2: Run the Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the contents of `supabase/migrations/001_personal_finance_schema.sql`
4. Click **Run** — this creates all 7 tables, indexes, RLS policies, and triggers

## Step 3: Create Your First User

1. In Supabase dashboard, go to **Authentication → Users**
2. Click **Add User → Create New User**
3. Enter your email and password
4. Copy the user's **UUID** from the table (you'll need it for seeding)

## Step 4: Seed Your Excel Data

On your local machine:

```bash
# Install Python dependencies
pip install pandas openpyxl supabase

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
export SEED_USER_ID="your-user-uuid-from-step-3"

# Run the seeder
python scripts/seed_from_excel.py "Family_Finance_Dashboard_2026.xlsx"
```

This imports:
- **~80 expense/income categories** from the Settings sheet
- **~15 accounts** (Citibank, Amex, Apple Card, Costco, etc.)
- **~629 transactions** with dates, amounts, categories, accounts
- **~30+ bills** with due dates, frequencies, budget amounts
- **~300+ budget entries** (monthly budget vs actual per category)
- **8 debts** (mortgage, car loans, student loans, credit cards)
- **10 investment accounts** (401k, IRA, brokerage, HSA, crypto)

## Step 5: Configure the Frontend

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Test locally:
```bash
npm install
npm run dev
```

Log in with the email/password you created in Step 3.

## Step 6: Deploy to Vercel (Free)

### Option A: GitHub + Vercel (recommended)

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit: FinanceHub personal finance platform"
git remote add origin https://github.com/YOUR_USER/financehub.git
git push -u origin main
```

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New → Project** → Import your repo
3. Add environment variables:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy** — done in ~60 seconds
5. Your app is live at `https://financehub.vercel.app` (or similar)

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel --prod
# Follow prompts, add env vars when asked
```

## Step 7: Custom Domain (Optional)

1. Buy a domain (Namecheap, Cloudflare, Google Domains)
2. In Vercel dashboard → Project → **Settings → Domains**
3. Add your domain (e.g., `finance.lopezfamily.com`)
4. Update DNS records as instructed by Vercel
5. SSL is automatic

## Step 8: Enable Supabase Auth for Production

In Supabase dashboard → **Authentication → URL Configuration**:

1. Set **Site URL** to your Vercel URL (e.g., `https://financehub.vercel.app`)
2. Add redirect URLs for login callbacks
3. (Optional) Enable Google/GitHub OAuth under **Providers**

---

## Security Checklist

- [ ] RLS is enabled on all tables (done by migration)
- [ ] Only the `anon` key is used in the frontend (never `service_role`)
- [ ] `.env` is in `.gitignore` (never commit keys)
- [ ] Supabase email confirmation is enabled in production
- [ ] Consider enabling MFA in Supabase Auth settings

## Ongoing: Importing New Transactions

You can re-run the seed script with new Excel exports, or build a CSV import
feature directly into the app (the Import Log sheet shows this is already
part of your workflow).

## Cost Summary

| Service | Free Tier Limits | When You'd Upgrade |
|---------|-----------------|-------------------|
| Supabase | 500MB DB, 1GB storage, 50K auth users | $25/mo Pro if you exceed |
| Vercel | 100GB bandwidth, serverless functions | $20/mo Pro for team features |
| Domain | N/A | ~$12/yr |

**Total to go live: $0** (on free tiers)
