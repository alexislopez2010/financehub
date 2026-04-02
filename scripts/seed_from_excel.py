"""
Seed Supabase from Family_Finance_Dashboard_2026.xlsx

Usage:
  1. pip install pandas openpyxl supabase
  2. Set environment variables:
       export SUPABASE_URL=https://your-project.supabase.co
       export SUPABASE_SERVICE_KEY=your-service-role-key   # NOT anon key
  3. python scripts/seed_from_excel.py path/to/Family_Finance_Dashboard_2026.xlsx

This script reads every sheet and inserts data into the Supabase tables
created by 001_personal_finance_schema.sql.
"""

import sys, os, json
import pandas as pd
from datetime import datetime
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
USER_ID = os.environ.get("SEED_USER_ID", "")  # UUID of the auth.users row to own all data

if not all([SUPABASE_URL, SUPABASE_KEY, USER_ID]):
    print("ERROR: Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and SEED_USER_ID env vars")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
xlsx_path = sys.argv[1] if len(sys.argv) > 1 else "Family_Finance_Dashboard_2026.xlsx"
xls = pd.ExcelFile(xlsx_path)


# ── 1. SETTINGS → categories + accounts ─────────────────────────────

def seed_settings():
    df = pd.read_excel(xls, "Settings", header=None)

    # Expense categories: column 0, rows 3+
    expense_cats = df.iloc[3:, 0].dropna().tolist()
    # Income categories: column 2, rows 3+
    income_cats = df.iloc[3:, 2].dropna().tolist()
    # Accounts: column 4, rows 3+
    accounts_raw = df.iloc[3:, 4].dropna().tolist()

    categories = []
    for name in expense_cats:
        categories.append({
            "user_id": USER_ID,
            "name": str(name).strip(),
            "type": "expense",
            "icon": "Circle",
            "color": "#ef4444",
            "is_system": False,
        })
    for name in income_cats:
        categories.append({
            "user_id": USER_ID,
            "name": str(name).strip(),
            "type": "income",
            "icon": "Circle",
            "color": "#22c55e",
            "is_system": False,
        })

    print(f"  Inserting {len(categories)} categories...")
    sb.table("categories").insert(categories).execute()

    # Fetch back for ID lookup
    result = sb.table("categories").select("id, name, type").eq("user_id", USER_ID).execute()
    cat_map = {(r["name"], r["type"]): r["id"] for r in result.data}

    # Accounts
    type_map = {
        "checking": "checking", "savings": "savings", "credit": "credit_card",
        "card": "credit_card", "paypal": "other", "venmo": "other", "cash": "cash",
    }
    accounts = []
    for name in accounts_raw:
        name = str(name).strip()
        atype = "other"
        lower = name.lower()
        for key, val in type_map.items():
            if key in lower:
                atype = val
                break
        is_asset = atype in ("checking", "savings", "cash", "investment")
        accounts.append({
            "user_id": USER_ID,
            "name": name,
            "type": atype,
            "institution": name.split()[0] if name else "",
            "balance": 0,
            "is_asset": is_asset,
            "is_active": True,
        })

    print(f"  Inserting {len(accounts)} accounts...")
    sb.table("accounts").insert(accounts).execute()

    result = sb.table("accounts").select("id, name").eq("user_id", USER_ID).execute()
    acct_map = {r["name"].lower(): r["id"] for r in result.data}

    return cat_map, acct_map


# ── 2. TRANSACTIONS ──────────────────────────────────────────────────

def seed_transactions(cat_map, acct_map):
    df = pd.read_excel(xls, "Transactions", header=None)
    # Data starts at row 3, columns: 0=#, 1=Date, 2=Description, 3=Amount,
    # 4=Type, 5=Category, 6=Account, 7=Member, 8=Payment Method, 9=Imported, 10=Notes
    rows = []
    for i in range(3, len(df)):
        row = df.iloc[i]
        if pd.isna(row[1]) or pd.isna(row[3]):
            continue
        date_val = row[1]
        if isinstance(date_val, str):
            date_str = date_val[:10]
        else:
            date_str = pd.Timestamp(date_val).strftime("%Y-%m-%d")

        tx_type_raw = str(row[4]).strip().lower() if pd.notna(row[4]) else "expense"
        tx_type = "income" if tx_type_raw == "income" else "transfer" if tx_type_raw == "transfer" else "expense"

        cat_name = str(row[5]).strip() if pd.notna(row[5]) else None
        cat_id = None
        if cat_name:
            cat_id = cat_map.get((cat_name, tx_type)) or cat_map.get((cat_name, "expense"))

        acct_name = str(row[6]).strip().lower() if pd.notna(row[6]) else None
        acct_id = None
        if acct_name:
            for key, aid in acct_map.items():
                if acct_name in key or key in acct_name:
                    acct_id = aid
                    break

        rows.append({
            "user_id": USER_ID,
            "account_id": acct_id,
            "category_id": cat_id,
            "type": tx_type,
            "amount": abs(float(row[3])),
            "description": str(row[2]).strip() if pd.notna(row[2]) else "",
            "date": date_str,
            "is_recurring": False,
            "notes": str(row[10]).strip() if pd.notna(row[10]) else None,
        })

    # Insert in batches of 500
    print(f"  Inserting {len(rows)} transactions...")
    for i in range(0, len(rows), 500):
        sb.table("transactions").insert(rows[i:i+500]).execute()


# ── 3. BILLS ─────────────────────────────────────────────────────────

def seed_bills(cat_map, acct_map):
    df = pd.read_excel(xls, "Bills", header=None)
    # Row 2 = header: 0=Bill Name, 1=Category, 2=Account, 3=Due Day, 4=Frequency, 5=Budget Amt
    rows = []
    for i in range(3, len(df)):
        row = df.iloc[i]
        name = row[0]
        if pd.isna(name) or str(name).strip().upper() in ("", "TOTAL", "NAN"):
            continue

        cat_name = str(row[1]).strip() if pd.notna(row[1]) else None
        cat_id = cat_map.get((cat_name, "expense")) if cat_name else None

        acct_name = str(row[2]).strip().lower() if pd.notna(row[2]) else None
        acct_id = None
        if acct_name:
            for key, aid in acct_map.items():
                if acct_name in key or key in acct_name:
                    acct_id = aid
                    break

        freq_raw = str(row[4]).strip().lower() if pd.notna(row[4]) else "monthly"
        freq = freq_raw if freq_raw in ("weekly", "biweekly", "monthly", "quarterly", "yearly") else "monthly"

        due_day = int(row[3]) if pd.notna(row[3]) and int(row[3]) > 0 else 1
        amount = float(row[5]) if pd.notna(row[5]) else 0

        rows.append({
            "user_id": USER_ID,
            "name": str(name).strip(),
            "amount": amount,
            "frequency": freq,
            "category_id": cat_id,
            "account_id": acct_id,
            "due_day": min(due_day, 28),
            "next_due_date": f"2026-04-{min(due_day, 28):02d}",
            "is_autopay": False,
            "is_active": True,
        })

    print(f"  Inserting {len(rows)} bills...")
    sb.table("bills").insert(rows).execute()


# ── 4. BUDGETS ───────────────────────────────────────────────────────

def seed_budgets(cat_map):
    df = pd.read_excel(xls, "Budget", header=None)
    # Row 2-3 = headers, data from row 4+
    # Col 0=Category, 1=Annual Budget, 2=Jan Budget, 3=Jan Actual, ...
    months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    rows = []
    for i in range(4, len(df)):
        row = df.iloc[i]
        cat_name = str(row[0]).strip() if pd.notna(row[0]) else ""
        if not cat_name or cat_name.startswith("──") or cat_name.upper() in ("TOTAL", ""):
            continue

        cat_id = cat_map.get((cat_name, "expense")) or cat_map.get((cat_name, "income"))
        if not cat_id:
            continue

        for m_idx, month in enumerate(months):
            budget_col = 2 + (m_idx * 2)     # Budget column
            actual_col = 3 + (m_idx * 2)     # Actual column
            budget_amt = float(row[budget_col]) if pd.notna(row[budget_col]) and float(row[budget_col]) > 0 else 0
            actual_amt = float(row[actual_col]) if pd.notna(row[actual_col]) else 0

            if budget_amt > 0:
                rows.append({
                    "user_id": USER_ID,
                    "category_id": cat_id,
                    "amount": budget_amt,
                    "period": "monthly",
                    "month": f"2026-{month}",
                    "spent": actual_amt,
                })

    print(f"  Inserting {len(rows)} budget entries...")
    for i in range(0, len(rows), 500):
        sb.table("budgets").insert(rows[i:i+500]).execute()


# ── 5. DEBT → assets (liabilities) ──────────────────────────────────

def seed_debt():
    df = pd.read_excel(xls, "Debt", header=None)
    # Row 2=header, data from row 3+: 0=Name, 1=Lender, 2=Type, 3=Balance, 4=Rate, 5=Min
    type_map = {
        "mortgage": "mortgage", "auto loan": "auto_loan", "student loan": "student_loan",
        "credit card": "credit_card_debt", "medical": "other_liability",
    }
    rows = []
    for i in range(3, len(df)):
        row = df.iloc[i]
        name = str(row[0]).strip() if pd.notna(row[0]) else ""
        if not name or name.upper() in ("TOTAL DEBT", ""):
            continue
        balance = float(row[3]) if pd.notna(row[3]) and float(row[3]) > 0 else 0
        if balance == 0:
            continue

        raw_type = str(row[2]).strip().lower() if pd.notna(row[2]) else "other"
        asset_type = type_map.get(raw_type, "other_liability")
        rate = float(row[4]) * 100 if pd.notna(row[4]) and float(row[4]) < 1 else (float(row[4]) if pd.notna(row[4]) else None)

        rows.append({
            "user_id": USER_ID,
            "name": name,
            "type": asset_type,
            "value": balance,
            "is_liability": True,
            "institution": str(row[1]).strip() if pd.notna(row[1]) else None,
            "interest_rate": rate,
        })

    print(f"  Inserting {len(rows)} debt/liability entries...")
    sb.table("assets").insert(rows).execute()


# ── 6. INVESTMENTS → assets ──────────────────────────────────────────

def seed_investments():
    df = pd.read_excel(xls, "Investments", header=None)
    # Row 2=header, data from row 3+: 0=Name, 1=Type, 2=Member, 3=Institution, 4=Jan Balance
    type_map = {
        "401k": "retirement", "ira": "retirement", "roth ira": "retirement",
        "traditional ira": "retirement", "brokerage": "investment",
        "hsa": "other_asset", "529": "other_asset", "crypto": "crypto", "other": "other_asset",
    }
    rows = []
    for i in range(3, len(df)):
        row = df.iloc[i]
        name = str(row[0]).strip() if pd.notna(row[0]) else ""
        if not name or name.upper() in ("PORTFOLIO TOTAL", ""):
            continue
        raw_type = str(row[1]).strip().lower() if pd.notna(row[1]) else "other"
        asset_type = type_map.get(raw_type, "other_asset")
        value = float(row[4]) if pd.notna(row[4]) else 0  # Jan balance

        rows.append({
            "user_id": USER_ID,
            "name": name,
            "type": asset_type,
            "value": value,
            "is_liability": False,
            "institution": str(row[3]).strip() if pd.notna(row[3]) else None,
        })

    if rows:
        print(f"  Inserting {len(rows)} investment entries...")
        sb.table("assets").insert(rows).execute()
    else:
        print("  No investment data with balances to insert.")


# ── RUN ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Reading: {xlsx_path}")
    print("\n1. Seeding categories & accounts...")
    cat_map, acct_map = seed_settings()
    print(f"   → {len(cat_map)} categories, {len(acct_map)} accounts")

    print("\n2. Seeding transactions...")
    seed_transactions(cat_map, acct_map)

    print("\n3. Seeding bills...")
    seed_bills(cat_map, acct_map)

    print("\n4. Seeding budgets...")
    seed_budgets(cat_map)

    print("\n5. Seeding debt (liabilities)...")
    seed_debt()

    print("\n6. Seeding investments (assets)...")
    seed_investments()

    print("\n✅ Done! All data seeded into Supabase.")
