import { test, expect } from '@playwright/test'

test.describe('auth flow (unauthenticated)', () => {
  test('redirects from / to /login with ?next=/', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login\?next=%2F$/)
  })

  test('redirects from /briefing to /login with ?next=/briefing', async ({ page }) => {
    await page.goto('/briefing')
    await expect(page).toHaveURL(/\/login\?next=%2Fbriefing$/)
  })

  test('login page renders the form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('signup page shows the disabled message', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: /signups disabled/i })).toBeVisible()
  })

  test('forgot password page renders the form', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /send reset email/i })).toBeVisible()
  })
})

test.describe('protected surface redirects (unauthenticated)', () => {
  const SURFACES: ReadonlyArray<{ path: string; expectedNext: string }> = [
    { path: '/ledger',   expectedNext: '%2Fledger' },
    { path: '/plan',     expectedNext: '%2Fplan' },
    { path: '/bills',    expectedNext: '%2Fbills' },
    { path: '/accounts', expectedNext: '%2Faccounts' }
  ]

  for (const { path, expectedNext } of SURFACES) {
    test(`${path} redirects to /login?next=${expectedNext}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${expectedNext}$`))
    })
  }

  test('protected surface preserves query string in ?next= round-trip', async ({ page }) => {
    await page.goto('/ledger?account=chase&month=05')
    // Expect: /login?next=%2Fledger%3Faccount%3Dchase%26month%3D05
    await expect(page).toHaveURL(/\/login\?next=%2Fledger%3Faccount%3Dchase%26month%3D05$/)
  })
})

test.describe('shell integration (requires authenticated user)', () => {
  test.skip('tab navigation switches surfaces', () => {
    // Phase 2M: seed a test user, sign in via storage state, click each tab,
    // assert URL changes and active-tab aria-current updates.
  })

  test.skip('Cmd-K opens the spotlight palette', () => {
    // Phase 2M: dispatch a keydown event with metaKey+k after auth,
    // assert the Dialog is visible and the input is focused.
  })

  test.skip('spotlight jump navigates to selected surface', () => {
    // Phase 2M: open spotlight, click a Jump item, assert URL changes
    // and dialog closes.
  })
})
