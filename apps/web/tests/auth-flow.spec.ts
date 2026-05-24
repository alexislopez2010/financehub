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
