import type { Account, Transaction, Category, Budget, Bill, Asset } from '@/types/database'

export const mockAccounts: Account[] = [
  { id: '1', user_id: 'u1', name: 'Chase Checking', type: 'checking', institution: 'Chase', balance: 8420.50, currency: 'USD', is_asset: true, is_active: true, color: '#3b82f6', created_at: '2026-01-01', updated_at: '2026-04-01' },
  { id: '2', user_id: 'u1', name: 'Marcus Savings', type: 'savings', institution: 'Goldman Sachs', balance: 25000.00, currency: 'USD', is_asset: true, is_active: true, color: '#22c55e', created_at: '2026-01-01', updated_at: '2026-04-01' },
  { id: '3', user_id: 'u1', name: 'Apple Card', type: 'credit_card', institution: 'Apple', balance: -2145.30, currency: 'USD', is_asset: false, is_active: true, color: '#a855f7', created_at: '2026-01-01', updated_at: '2026-04-01' },
  { id: '4', user_id: 'u1', name: 'Fidelity 401k', type: 'investment', institution: 'Fidelity', balance: 87650.00, currency: 'USD', is_asset: true, is_active: true, color: '#f59e0b', created_at: '2026-01-01', updated_at: '2026-04-01' },
  { id: '5', user_id: 'u1', name: 'Robinhood', type: 'investment', institution: 'Robinhood', balance: 12300.00, currency: 'USD', is_asset: true, is_active: true, color: '#22c55e', created_at: '2026-01-01', updated_at: '2026-04-01' },
]

export const mockCategories: Category[] = [
  { id: 'c1', user_id: 'u1', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#22c55e', is_system: true, created_at: '2026-01-01' },
  { id: 'c2', user_id: 'u1', name: 'Freelance', type: 'income', icon: 'Laptop', color: '#3b82f6', is_system: false, created_at: '2026-01-01' },
  { id: 'c3', user_id: 'u1', name: 'Housing', type: 'expense', icon: 'Home', color: '#f59e0b', is_system: true, created_at: '2026-01-01' },
  { id: 'c4', user_id: 'u1', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#22c55e', is_system: true, created_at: '2026-01-01' },
  { id: 'c5', user_id: 'u1', name: 'Dining', type: 'expense', icon: 'UtensilsCrossed', color: '#ef4444', is_system: true, created_at: '2026-01-01' },
  { id: 'c6', user_id: 'u1', name: 'Transportation', type: 'expense', icon: 'Car', color: '#6366f1', is_system: true, created_at: '2026-01-01' },
  { id: 'c7', user_id: 'u1', name: 'Entertainment', type: 'expense', icon: 'Gamepad2', color: '#a855f7', is_system: true, created_at: '2026-01-01' },
  { id: 'c8', user_id: 'u1', name: 'Utilities', type: 'expense', icon: 'Zap', color: '#f59e0b', is_system: true, created_at: '2026-01-01' },
  { id: 'c9', user_id: 'u1', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', is_system: true, created_at: '2026-01-01' },
  { id: 'c10', user_id: 'u1', name: 'Health', type: 'expense', icon: 'Heart', color: '#ef4444', is_system: true, created_at: '2026-01-01' },
  { id: 'c11', user_id: 'u1', name: 'Subscriptions', type: 'expense', icon: 'Repeat', color: '#8b5cf6', is_system: true, created_at: '2026-01-01' },
  { id: 'c12', user_id: 'u1', name: 'Insurance', type: 'expense', icon: 'Shield', color: '#06b6d4', is_system: true, created_at: '2026-01-01' },
]

export const mockTransactions: Transaction[] = [
  { id: 't1', user_id: 'u1', account_id: '1', category_id: 'c1', type: 'income', amount: 6500, description: 'Monthly Salary', merchant: 'Employer Inc', date: '2026-03-31', is_recurring: true, created_at: '2026-03-31', updated_at: '2026-03-31' },
  { id: 't2', user_id: 'u1', account_id: '1', category_id: 'c2', type: 'income', amount: 2200, description: 'Freelance Project', merchant: 'Client XYZ', date: '2026-03-28', is_recurring: false, created_at: '2026-03-28', updated_at: '2026-03-28' },
  { id: 't3', user_id: 'u1', account_id: '3', category_id: 'c3', type: 'expense', amount: 2100, description: 'Rent Payment', merchant: 'Property Mgmt', date: '2026-03-01', is_recurring: true, created_at: '2026-03-01', updated_at: '2026-03-01' },
  { id: 't4', user_id: 'u1', account_id: '3', category_id: 'c4', type: 'expense', amount: 156.43, description: 'Weekly Groceries', merchant: 'Whole Foods', date: '2026-03-29', is_recurring: false, created_at: '2026-03-29', updated_at: '2026-03-29' },
  { id: 't5', user_id: 'u1', account_id: '3', category_id: 'c5', type: 'expense', amount: 78.50, description: 'Dinner', merchant: 'Nobu', date: '2026-03-27', is_recurring: false, created_at: '2026-03-27', updated_at: '2026-03-27' },
  { id: 't6', user_id: 'u1', account_id: '3', category_id: 'c7', type: 'expense', amount: 15.99, description: 'Netflix', merchant: 'Netflix', date: '2026-03-15', is_recurring: true, created_at: '2026-03-15', updated_at: '2026-03-15' },
  { id: 't7', user_id: 'u1', account_id: '1', category_id: 'c8', type: 'expense', amount: 245.00, description: 'Electric Bill', merchant: 'City Power', date: '2026-03-10', is_recurring: true, created_at: '2026-03-10', updated_at: '2026-03-10' },
  { id: 't8', user_id: 'u1', account_id: '3', category_id: 'c6', type: 'expense', amount: 65.00, description: 'Gas', merchant: 'Shell', date: '2026-03-25', is_recurring: false, created_at: '2026-03-25', updated_at: '2026-03-25' },
  { id: 't9', user_id: 'u1', account_id: '3', category_id: 'c9', type: 'expense', amount: 234.99, description: 'AirPods Pro', merchant: 'Apple Store', date: '2026-03-22', is_recurring: false, created_at: '2026-03-22', updated_at: '2026-03-22' },
  { id: 't10', user_id: 'u1', account_id: '3', category_id: 'c5', type: 'expense', amount: 42.30, description: 'Lunch', merchant: 'Chipotle', date: '2026-03-20', is_recurring: false, created_at: '2026-03-20', updated_at: '2026-03-20' },
  { id: 't11', user_id: 'u1', account_id: '1', category_id: 'c10', type: 'expense', amount: 150.00, description: 'Gym Membership', merchant: 'Equinox', date: '2026-03-01', is_recurring: true, created_at: '2026-03-01', updated_at: '2026-03-01' },
  { id: 't12', user_id: 'u1', account_id: '3', category_id: 'c4', type: 'expense', amount: 89.21, description: 'Groceries', merchant: 'Trader Joe\'s', date: '2026-03-18', is_recurring: false, created_at: '2026-03-18', updated_at: '2026-03-18' },
  { id: 't13', user_id: 'u1', account_id: '3', category_id: 'c11', type: 'expense', amount: 14.99, description: 'Spotify', merchant: 'Spotify', date: '2026-03-12', is_recurring: true, created_at: '2026-03-12', updated_at: '2026-03-12' },
  { id: 't14', user_id: 'u1', account_id: '1', category_id: 'c12', type: 'expense', amount: 380.00, description: 'Car Insurance', merchant: 'Geico', date: '2026-03-05', is_recurring: true, created_at: '2026-03-05', updated_at: '2026-03-05' },
  { id: 't15', user_id: 'u1', account_id: '3', category_id: 'c7', type: 'expense', amount: 24.99, description: 'Movie Tickets', merchant: 'AMC Theatres', date: '2026-03-16', is_recurring: false, created_at: '2026-03-16', updated_at: '2026-03-16' },
  // February transactions
  { id: 't16', user_id: 'u1', account_id: '1', category_id: 'c1', type: 'income', amount: 6500, description: 'Monthly Salary', merchant: 'Employer Inc', date: '2026-02-28', is_recurring: true, created_at: '2026-02-28', updated_at: '2026-02-28' },
  { id: 't17', user_id: 'u1', account_id: '3', category_id: 'c3', type: 'expense', amount: 2100, description: 'Rent Payment', merchant: 'Property Mgmt', date: '2026-02-01', is_recurring: true, created_at: '2026-02-01', updated_at: '2026-02-01' },
  { id: 't18', user_id: 'u1', account_id: '3', category_id: 'c4', type: 'expense', amount: 312.50, description: 'Groceries', merchant: 'Whole Foods', date: '2026-02-15', is_recurring: false, created_at: '2026-02-15', updated_at: '2026-02-15' },
  { id: 't19', user_id: 'u1', account_id: '3', category_id: 'c5', type: 'expense', amount: 185.00, description: 'Valentine Dinner', merchant: 'Chez Pierre', date: '2026-02-14', is_recurring: false, created_at: '2026-02-14', updated_at: '2026-02-14' },
  { id: 't20', user_id: 'u1', account_id: '1', category_id: 'c8', type: 'expense', amount: 210.00, description: 'Electric Bill', merchant: 'City Power', date: '2026-02-10', is_recurring: true, created_at: '2026-02-10', updated_at: '2026-02-10' },
  // January transactions
  { id: 't21', user_id: 'u1', account_id: '1', category_id: 'c1', type: 'income', amount: 6500, description: 'Monthly Salary', merchant: 'Employer Inc', date: '2026-01-31', is_recurring: true, created_at: '2026-01-31', updated_at: '2026-01-31' },
  { id: 't22', user_id: 'u1', account_id: '1', category_id: 'c2', type: 'income', amount: 1800, description: 'Freelance Work', merchant: 'Client ABC', date: '2026-01-20', is_recurring: false, created_at: '2026-01-20', updated_at: '2026-01-20' },
  { id: 't23', user_id: 'u1', account_id: '3', category_id: 'c3', type: 'expense', amount: 2100, description: 'Rent Payment', merchant: 'Property Mgmt', date: '2026-01-01', is_recurring: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 't24', user_id: 'u1', account_id: '3', category_id: 'c4', type: 'expense', amount: 275.00, description: 'Groceries', merchant: 'Whole Foods', date: '2026-01-12', is_recurring: false, created_at: '2026-01-12', updated_at: '2026-01-12' },
]

export const mockBudgets: Budget[] = [
  { id: 'b1', user_id: 'u1', category_id: 'c3', amount: 2200, period: 'monthly', month: '2026-03', spent: 2100, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b2', user_id: 'u1', category_id: 'c4', amount: 400, period: 'monthly', month: '2026-03', spent: 245.64, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b3', user_id: 'u1', category_id: 'c5', amount: 200, period: 'monthly', month: '2026-03', spent: 120.80, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b4', user_id: 'u1', category_id: 'c6', amount: 150, period: 'monthly', month: '2026-03', spent: 65, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b5', user_id: 'u1', category_id: 'c7', amount: 100, period: 'monthly', month: '2026-03', spent: 55.97, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b6', user_id: 'u1', category_id: 'c8', amount: 300, period: 'monthly', month: '2026-03', spent: 245, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b7', user_id: 'u1', category_id: 'c9', amount: 200, period: 'monthly', month: '2026-03', spent: 234.99, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b8', user_id: 'u1', category_id: 'c10', amount: 200, period: 'monthly', month: '2026-03', spent: 150, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b9', user_id: 'u1', category_id: 'c11', amount: 50, period: 'monthly', month: '2026-03', spent: 30.98, created_at: '2026-03-01', updated_at: '2026-03-31' },
  { id: 'b10', user_id: 'u1', category_id: 'c12', amount: 400, period: 'monthly', month: '2026-03', spent: 380, created_at: '2026-03-01', updated_at: '2026-03-31' },
]

export const mockBills: Bill[] = [
  { id: 'bl1', user_id: 'u1', name: 'Rent', amount: 2100, frequency: 'monthly', category_id: 'c3', due_day: 1, next_due_date: '2026-04-01', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'bl2', user_id: 'u1', name: 'Electric', amount: 245, frequency: 'monthly', category_id: 'c8', due_day: 10, next_due_date: '2026-04-10', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-10' },
  { id: 'bl3', user_id: 'u1', name: 'Netflix', amount: 15.99, frequency: 'monthly', category_id: 'c11', due_day: 15, next_due_date: '2026-04-15', is_autopay: true, is_active: true, url: 'https://netflix.com', created_at: '2026-01-01', updated_at: '2026-03-15' },
  { id: 'bl4', user_id: 'u1', name: 'Spotify', amount: 14.99, frequency: 'monthly', category_id: 'c11', due_day: 12, next_due_date: '2026-04-12', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-12' },
  { id: 'bl5', user_id: 'u1', name: 'Car Insurance', amount: 380, frequency: 'monthly', category_id: 'c12', due_day: 5, next_due_date: '2026-04-05', is_autopay: false, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-05' },
  { id: 'bl6', user_id: 'u1', name: 'Gym (Equinox)', amount: 150, frequency: 'monthly', category_id: 'c10', due_day: 1, next_due_date: '2026-04-01', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'bl7', user_id: 'u1', name: 'Internet', amount: 79.99, frequency: 'monthly', category_id: 'c8', due_day: 20, next_due_date: '2026-04-20', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-20' },
  { id: 'bl8', user_id: 'u1', name: 'Phone', amount: 85, frequency: 'monthly', category_id: 'c8', due_day: 18, next_due_date: '2026-04-18', is_autopay: true, is_active: true, created_at: '2026-01-01', updated_at: '2026-03-18' },
]

export const mockAssets: Asset[] = [
  { id: 'a1', user_id: 'u1', name: 'Primary Residence', type: 'property', value: 450000, is_liability: false, notes: 'Condo purchased 2023', created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a2', user_id: 'u1', name: 'Tesla Model 3', type: 'vehicle', value: 28000, is_liability: false, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a3', user_id: 'u1', name: '401k', type: 'retirement', value: 87650, is_liability: false, institution: 'Fidelity', created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a4', user_id: 'u1', name: 'Brokerage', type: 'investment', value: 12300, is_liability: false, institution: 'Robinhood', created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a5', user_id: 'u1', name: 'Bitcoin', type: 'crypto', value: 8500, is_liability: false, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a6', user_id: 'u1', name: 'Mortgage', type: 'mortgage', value: 320000, is_liability: true, institution: 'Wells Fargo', interest_rate: 5.25, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a7', user_id: 'u1', name: 'Auto Loan', type: 'auto_loan', value: 15000, is_liability: true, institution: 'Capital One', interest_rate: 4.5, created_at: '2026-01-01', updated_at: '2026-03-01' },
  { id: 'a8', user_id: 'u1', name: 'Student Loans', type: 'student_loan', value: 22000, is_liability: true, institution: 'Navient', interest_rate: 5.0, created_at: '2026-01-01', updated_at: '2026-03-01' },
]

// Monthly summary data for charts
export const monthlySummary = [
  { month: 'Oct', income: 6500, expenses: 4200, savings: 2300 },
  { month: 'Nov', income: 7100, expenses: 4800, savings: 2300 },
  { month: 'Dec', income: 8200, expenses: 5600, savings: 2600 },
  { month: 'Jan', income: 8300, expenses: 4500, savings: 3800 },
  { month: 'Feb', income: 6500, expenses: 4100, savings: 2400 },
  { month: 'Mar', income: 8700, expenses: 3628, savings: 5072 },
]

export const netWorthHistory = [
  { month: 'Oct', assets: 570000, liabilities: 365000, netWorth: 205000 },
  { month: 'Nov', assets: 575000, liabilities: 363500, netWorth: 211500 },
  { month: 'Dec', assets: 582000, liabilities: 362000, netWorth: 220000 },
  { month: 'Jan', assets: 588000, liabilities: 360500, netWorth: 227500 },
  { month: 'Feb', assets: 592000, liabilities: 359000, netWorth: 233000 },
  { month: 'Mar', assets: 619870, liabilities: 357000, netWorth: 262870 },
]

export const spendingByCategory = [
  { name: 'Housing', value: 2100, color: '#f59e0b' },
  { name: 'Insurance', value: 380, color: '#06b6d4' },
  { name: 'Groceries', value: 245.64, color: '#22c55e' },
  { name: 'Utilities', value: 245, color: '#f59e0b' },
  { name: 'Shopping', value: 234.99, color: '#ec4899' },
  { name: 'Health', value: 150, color: '#ef4444' },
  { name: 'Dining', value: 120.80, color: '#ef4444' },
  { name: 'Transport', value: 65, color: '#6366f1' },
  { name: 'Entertainment', value: 55.97, color: '#a855f7' },
  { name: 'Subscriptions', value: 30.98, color: '#8b5cf6' },
]
