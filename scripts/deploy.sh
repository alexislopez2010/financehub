#!/bin/bash
# ============================================================
# FinanceHub Deployment Script
# Run this from the personal-finance-platform directory
# ============================================================

set -e
echo ""
echo "🚀 FinanceHub Deployment Helper"
echo "================================"
echo ""

# ── Step 1: GitHub ───────────────────────────────────────────
echo "📦 STEP 1: Push to GitHub"
echo "─────────────────────────"
read -p "Enter your GitHub username: " GH_USER
read -p "Enter the repo name (e.g., financehub): " REPO_NAME

echo ""
echo "→ Go to https://github.com/new"
echo "→ Create a NEW repo named: $REPO_NAME"
echo "→ Keep it Public, do NOT initialize with README"
echo ""
read -p "Press Enter when you've created the empty repo on GitHub..."

git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git" 2>/dev/null || git remote set-url origin "https://github.com/$GH_USER/$REPO_NAME.git"
git push -u origin main

echo "✅ Code pushed to https://github.com/$GH_USER/$REPO_NAME"
echo ""

# ── Step 2: Supabase ────────────────────────────────────────
echo "🗄️  STEP 2: Set up Supabase"
echo "───────────────────────────"
echo ""
echo "→ Go to https://supabase.com/dashboard/projects"
echo "→ Click 'New Project'"
echo "→ Name: FinanceHub (or whatever you like)"
echo "→ Set a database password (save it!)"
echo "→ Pick the region closest to you"
echo "→ Wait for it to provision (~2 min)"
echo ""
echo "→ Then go to: Settings → API"
echo "→ Copy your Project URL and anon key"
echo ""
read -p "Paste your Supabase Project URL: " SUPA_URL
read -p "Paste your Supabase anon (public) key: " SUPA_ANON

# Save .env
cat > .env << EOF
VITE_SUPABASE_URL=$SUPA_URL
VITE_SUPABASE_ANON_KEY=$SUPA_ANON
EOF
echo "✅ .env file created"
echo ""

echo "→ Now go to Supabase → SQL Editor → New Query"
echo "→ Paste the contents of: supabase/migrations/001_personal_finance_schema.sql"
echo "→ Click 'Run'"
echo ""
read -p "Press Enter when you've run the migration..."
echo "✅ Database schema created"
echo ""

# ── Step 3: Create user & seed data ─────────────────────────
echo "👤 STEP 3: Create user & seed data"
echo "───────────────────────────────────"
echo ""
echo "→ In Supabase → Authentication → Users → Add User"
echo "→ Enter your email and a password"
echo "→ Copy the UUID of the created user"
echo ""
read -p "Paste the user UUID: " USER_UUID
read -p "Paste your Supabase service_role key (Settings → API): " SUPA_SERVICE

echo ""
echo "Seeding your Excel data..."
pip install pandas openpyxl supabase 2>/dev/null

export SUPABASE_URL="$SUPA_URL"
export SUPABASE_SERVICE_KEY="$SUPA_SERVICE"
export SEED_USER_ID="$USER_UUID"

# Try to find the Excel file
EXCEL_FILE=""
for f in "../Family_Finance_Dashboard_2026.xlsx" "Family_Finance_Dashboard_2026.xlsx"; do
  if [ -f "$f" ]; then
    EXCEL_FILE="$f"
    break
  fi
done

if [ -z "$EXCEL_FILE" ]; then
  read -p "Path to Family_Finance_Dashboard_2026.xlsx: " EXCEL_FILE
fi

python scripts/seed_from_excel.py "$EXCEL_FILE"
echo "✅ Data seeded into Supabase"
echo ""

# ── Step 4: Vercel ──────────────────────────────────────────
echo "🌐 STEP 4: Deploy to Vercel"
echo "───────────────────────────"
echo ""
echo "→ Go to https://vercel.com → Sign up with GitHub"
echo "→ Click 'Add New' → 'Project'"
echo "→ Import your '$REPO_NAME' repository"
echo "→ In 'Environment Variables', add:"
echo "    VITE_SUPABASE_URL = $SUPA_URL"
echo "    VITE_SUPABASE_ANON_KEY = $SUPA_ANON"
echo "→ Click 'Deploy'"
echo ""
read -p "Paste your live Vercel URL when done: " VERCEL_URL
echo ""

# ── Step 5: Update Supabase auth ────────────────────────────
echo "🔒 STEP 5: Update Supabase auth redirect"
echo "──────────────────────────────────────────"
echo ""
echo "→ In Supabase → Authentication → URL Configuration"
echo "→ Set Site URL to: $VERCEL_URL"
echo ""
read -p "Press Enter when done..."

echo ""
echo "============================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "Your app is live at: $VERCEL_URL"
echo ""
echo "Login with the email/password you created in Supabase."
echo "Your Excel data (transactions, bills, budgets, etc.) is all loaded."
echo ""
